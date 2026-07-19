from __future__ import annotations

import io
import json
import os
import time
from urllib.parse import urlsplit
import urllib.error
import urllib.request
import uuid

import requests
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

from config import (
    CATEGORY_TEMPLATES,
    MJ_SYSTEM_PROMPT,
    MODEL_NAME,
    OLLAMA_URL,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_MODEL,
    REFINE_SYSTEM_PROMPT,
    SDXL_SYSTEM_PROMPT,
    STORAGE_DB_PATH,
    TAGS,
    TITLE_SYSTEM_PROMPT,
)
from db import (
    create_saved_prompt,
    create_user_template,
    delete_saved_prompt,
    delete_user_template,
    init_db,
    list_saved_prompts,
    list_user_templates,
    update_user_template,
)

def _is_openrouter_model(name: str) -> bool:
    return isinstance(name, str) and name == OPENROUTER_MODEL


def _openrouter_chat_stream(model: str, system: str, user: str):
    if not OPENROUTER_API_KEY:
        yield "[OpenRouter error: OPENROUTER_API_KEY not set in .env]"
        return

    url = f"{OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/muse-prompt-builder",
        "X-Title": "Muse",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": True,
    }
    try:
        with requests.post(
            url, headers=headers, json=payload, stream=True, timeout=600
        ) as resp:
            if resp.status_code != 200:
                body = resp.text
                yield f"\n[OpenRouter error {resp.status_code}: {body}]"
                return
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                line = raw_line.strip()
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = obj.get("choices")
                if not isinstance(choices, list) or not choices:
                    continue
                delta = choices[0].get("delta") or {}
                chunk = delta.get("content") or ""
                if chunk:
                    yield chunk
    except requests.exceptions.RequestException as e:
        yield f"\n[OpenRouter error: {e}]"

def _ollama_chat_stream(model: str, system: str, user: str):
    """Stream completion tokens from Ollama's /api/generate as plain strings."""
    payload = {
        "model": model,
        "prompt": user,
        "system": system,
        "stream": True,
        "keep_alive": "10m",
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            text = io.TextIOWrapper(resp, encoding="utf-8")
            for line in text:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                chunk = obj.get("response") or ""
                if chunk:
                    yield chunk
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        yield f"\n[Ollama error {e.code}: {err_body}]"
    except urllib.error.URLError as e:
        yield f"\n[Error contacting Ollama: {e.reason}]"
    except OSError as e:
        yield f"\n[Error: {e}]"


def _llm_stream(model: str, system: str, user: str):
    """Dispatch to OpenRouter or Ollama based on the selected model."""
    if _is_openrouter_model(model):
        yield from _openrouter_chat_stream(model, system, user)
        return
    yield from _ollama_chat_stream(model, system, user)


def _collect_llm_response(model: str, system: str, user: str) -> str:
    """Consume streamed tokens into a single string."""
    return "".join(_llm_stream(model, system, user))


def _normalize_generated_title(raw: str, max_len: int = 120) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    text = text.splitlines()[0].strip()
    if len(text) >= 2 and text[0] in "\"'" and text[-1] == text[0]:
        text = text[1:-1].strip()
    parts = text.split()
    collapsed = " ".join(parts)
    if len(collapsed) > max_len:
        collapsed = collapsed[: max_len].rstrip()
        if collapsed.endswith(","):
            collapsed = collapsed[:-1].rstrip()
        collapsed += "\u2026"
    return collapsed


app = Flask(__name__)

TEMPLATES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates.json")
VALID_TEMPLATE_CATEGORIES = set(TAGS.keys())
init_db(STORAGE_DB_PATH, TEMPLATES_PATH, VALID_TEMPLATE_CATEGORIES)


def _ollama_tags_url() -> str:
    parts = urlsplit(OLLAMA_URL)
    if not parts.scheme or not parts.netloc:
        return "http://localhost:11434/api/tags"
    return f"{parts.scheme}://{parts.netloc}/api/tags"


def _normalize_models(payload: dict) -> list[dict]:
    models = payload.get("models")
    if not isinstance(models, list):
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for item in models:
        if not isinstance(item, dict):
            continue
        raw = item.get("name")
        if not isinstance(raw, str):
            continue
        name = raw.strip()
        if not name or name in seen:
            continue
        seen.add(name)

        size_bytes = item.get("size")
        size_gb = None
        if isinstance(size_bytes, (int, float)) and size_bytes > 0:
            size_gb = round(size_bytes / (1024 ** 3), 2)

        details = item.get("details")
        family = None
        param_size = None
        if isinstance(details, dict):
            fam_raw = details.get("family")
            if isinstance(fam_raw, str) and fam_raw.strip():
                family = fam_raw.strip()
            param_raw = details.get("parameter_size")
            if isinstance(param_raw, str) and param_raw.strip():
                param_size = param_raw.strip()

        out.append(
            {
                "name": name,
                "size_gb": size_gb,
                "family": family,
                "parameter_size": param_size,
                "provider": "ollama",
            }
        )
    return out


def _openrouter_model_entries() -> list[dict]:
    disabled = not OPENROUTER_API_KEY
    return [
        {
            "name": OPENROUTER_MODEL,
            "label": OPENROUTER_MODEL,
            "size_gb": None,
            "family": "openrouter",
            "parameter_size": None,
            "provider": "openrouter",
            "disabled": disabled,
        }
    ]


def _load_user_templates() -> list[dict]:
    return list_user_templates(STORAGE_DB_PATH, VALID_TEMPLATE_CATEGORIES)


def _group_templates_by_category() -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {category: [] for category in TAGS.keys()}
    for category, values in CATEGORY_TEMPLATES.items():
        if category not in grouped or not isinstance(values, list):
            continue
        for raw in values:
            if not isinstance(raw, dict):
                continue
            template_id = raw.get("id")
            label = raw.get("label")
            if not isinstance(template_id, str) or not template_id.strip():
                continue
            if not isinstance(label, str) or not label.strip():
                continue
            grouped[category].append(
                {
                    "id": template_id.strip(),
                    "label": label.strip(),
                    "category": category,
                    "tags": _clean_string_list(raw.get("tags")),
                    "is_predefined": True,
                }
            )
    for item in _load_user_templates():
        category = item.get("category")
        if category in grouped:
            grouped[category].append(item)
    return grouped


def _clean_string_list(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str):
            s = item.strip()
            if s:
                out.append(s)
    return out


def build_user_prompt(
    tags: list[str],
    free_text: str,
    selected_by_category: dict | None = None,
) -> str:
    parts: list[str] = []

    if isinstance(selected_by_category, dict) and selected_by_category:
        category_parts: list[str] = []
        for category in TAGS.keys():
            raw_entry = selected_by_category.get(category)
            if not isinstance(raw_entry, dict):
                continue
            merged_items = _clean_string_list(raw_entry.get("all_tags"))
            if merged_items:
                category_parts.append(f"{category}: {', '.join(merged_items)}")
        if category_parts:
            parts.append("Selected tags by category:\n- " + "\n- ".join(category_parts))

    if tags:
        parts.append("Selected tags: " + ", ".join(tags))

    if free_text and free_text.strip():
        parts.append("Additional user notes and details: " + free_text.strip())

    if not parts:
        return "Create a beautiful, highly detailed, and atmospheric image generation prompt."

    context = "\n\n".join(parts)

    return (
        f"Create an outstanding, nuanced, and visually rich image prompt based on the following information:\n\n"
        f"{context}\n\n"
        "Make the prompt as cinematic, evocative, and professionally crafted as possible."
    )


@app.route("/")
def index():
    return render_template(
        "index.html",
        tags=TAGS,
        category_templates=_group_templates_by_category(),
    )


@app.route("/templates", methods=["GET"])
def list_templates():
    return jsonify(_load_user_templates())


@app.route("/templates", methods=["POST"])
def create_template():
    data = request.get_json(silent=True) or {}
    label_raw = data.get("label")
    category = data.get("category")
    if not isinstance(label_raw, str) or not label_raw.strip():
        return jsonify({"error": "label is required"}), 400
    if category not in TAGS:
        return jsonify({"error": "invalid category"}), 400
    new_template = {
        "id": str(uuid.uuid4()),
        "label": label_raw.strip(),
        "category": category,
        "tags": _clean_string_list(data.get("tags")),
        "is_predefined": False,
    }
    created = create_user_template(
        STORAGE_DB_PATH,
        template_id=new_template["id"],
        label=new_template["label"],
        category=new_template["category"],
        tags=new_template["tags"],
        created_at=int(time.time() * 1000),
    )
    return jsonify(created)


@app.route("/templates/<template_id>", methods=["DELETE"])
def delete_template(template_id: str):
    delete_user_template(STORAGE_DB_PATH, template_id)
    return jsonify({"ok": True})


@app.route("/templates/<template_id>", methods=["PUT"])
def update_template(template_id: str):
    data = request.get_json(silent=True) or {}
    label_raw = data.get("label")
    category = data.get("category")
    if not isinstance(label_raw, str) or not label_raw.strip():
        return jsonify({"error": "label is required"}), 400
    if category not in TAGS:
        return jsonify({"error": "invalid category"}), 400
    updated = update_user_template(
        STORAGE_DB_PATH,
        template_id=template_id,
        label=label_raw.strip(),
        category=category,
        tags=_clean_string_list(data.get("tags")),
    )
    if updated is None:
        return jsonify({"error": "template not found"}), 404
    return jsonify(updated)


@app.route("/saved-prompts", methods=["GET"])
def list_saved_prompts_route():
    return jsonify(list_saved_prompts(STORAGE_DB_PATH))


@app.route("/saved-prompts", methods=["POST"])
def create_saved_prompt_route():
    data = request.get_json(silent=True) or {}
    name_raw = data.get("name")
    if not isinstance(name_raw, str) or not name_raw.strip():
        return jsonify({"error": "name is required"}), 400
    mode_raw = data.get("mode")
    mode = mode_raw.strip().lower() if isinstance(mode_raw, str) else "mj"
    if mode not in {"mj", "sdxl"}:
        mode = "mj"

    positive_raw = data.get("positive")
    if not isinstance(positive_raw, str) or not positive_raw.strip():
        return jsonify({"error": "positive is required"}), 400
    title_raw = data.get("title")
    title = _normalize_generated_title(title_raw) if isinstance(title_raw, str) else ""
    negative_raw = data.get("negative")
    negative = negative_raw.strip() if isinstance(negative_raw, str) else ""
    tags = _clean_string_list(data.get("tags"))
    free_text_raw = data.get("freeText")
    free_text = free_text_raw if isinstance(free_text_raw, str) else ""
    created_at_raw = data.get("createdAt")
    created_at = (
        int(created_at_raw)
        if isinstance(created_at_raw, (int, float)) and created_at_raw > 0
        else int(time.time() * 1000)
    )

    created = create_saved_prompt(
        STORAGE_DB_PATH,
        prompt_id=str(uuid.uuid4()),
        name=name_raw.strip(),
        title=title,
        mode=mode,
        positive=positive_raw.strip(),
        negative=negative,
        tags=tags,
        free_text=free_text,
        created_at=created_at,
    )
    return jsonify(created)


@app.route("/saved-prompts/<prompt_id>", methods=["DELETE"])
def delete_saved_prompt_route(prompt_id: str):
    delete_saved_prompt(STORAGE_DB_PATH, prompt_id)
    return jsonify({"ok": True})


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}
    raw_tags = data.get("tags")
    if not isinstance(raw_tags, list):
        raw_tags = []
    tags: list[str] = []
    for t in raw_tags:
        if isinstance(t, str) and t.strip():
            tags.append(t.strip())
    selected_by_category_raw = data.get("selected_by_category")
    selected_by_category: dict[str, dict] = {}
    if isinstance(selected_by_category_raw, dict):
        for category, value in selected_by_category_raw.items():
            if category not in TAGS or not isinstance(value, dict):
                continue
            all_tags = _clean_string_list(value.get("all_tags"))
            predefined_tags = _clean_string_list(value.get("predefined_tags"))
            custom_tags = _clean_string_list(value.get("custom_tags"))
            template_ids = _clean_string_list(value.get("template_ids"))
            template_tags = _clean_string_list(value.get("template_tags"))
            selected_by_category[category] = {
                "all_tags": all_tags,
                "predefined_tags": predefined_tags,
                "custom_tags": custom_tags,
                "template_ids": template_ids,
                "template_tags": template_tags,
            }
            tags.extend(all_tags)
    if tags:
        deduped: list[str] = []
        seen: set[str] = set()
        for tag in tags:
            lowered = tag.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            deduped.append(tag)
        tags = deduped

    missing_categories: list[str] = []
    for category, payload in selected_by_category.items():
        has_user_intent = any(
            payload.get(key) for key in ("predefined_tags", "custom_tags", "template_ids")
        )
        has_resolved_tags = bool(payload.get("all_tags"))
        if has_user_intent and not has_resolved_tags:
            missing_categories.append(category)
    if missing_categories:
        return (
            jsonify(
                {
                    "error": "missing_category_tags",
                    "missing_categories": sorted(missing_categories),
                    "message": "Some selected categories have no tags.",
                }
            ),
            400,
        )

    free_text_raw = data.get("free_text")
    if isinstance(free_text_raw, str):
        free_text = free_text_raw.strip()
    elif free_text_raw is None:
        free_text = ""
    else:
        free_text = str(free_text_raw).strip()

    output_mode_raw = data.get("output_mode", "mj")
    if isinstance(output_mode_raw, str):
        output_mode = output_mode_raw.strip().lower()
    else:
        output_mode = "mj"
    if output_mode == "sdxl":
        system_prompt = SDXL_SYSTEM_PROMPT
    else:
        system_prompt = MJ_SYSTEM_PROMPT

    model_raw = data.get("model", "")
    selected_model = model_raw.strip() if isinstance(model_raw, str) else ""
    model_name = selected_model or MODEL_NAME

    user_prompt = build_user_prompt(
        tags,
        free_text,
        selected_by_category=selected_by_category,
    )

    return Response(
        stream_with_context(_llm_stream(model_name, system_prompt, user_prompt)),
        mimetype="text/plain",
    )


@app.route("/refine", methods=["POST"])
def refine():
    data = request.get_json(silent=True) or {}

    prompt_raw = data.get("prompt", "")
    prompt_text = prompt_raw.strip() if isinstance(prompt_raw, str) else ""
    if not prompt_text:
        return jsonify({"error": "empty prompt"}), 400

    model_raw = data.get("model", "")
    selected_model = model_raw.strip() if isinstance(model_raw, str) else ""
    model_name = selected_model or MODEL_NAME

    user_prompt = (
        "Refine and improve the following image generation prompt. "
        "Preserve its original subject, style, medium, and intent. "
        "Return ONLY the refined prompt.\n\n"
        f"ORIGINAL PROMPT:\n{prompt_text}"
    )

    return Response(
        stream_with_context(
            _llm_stream(model_name, REFINE_SYSTEM_PROMPT, user_prompt)
        ),
        mimetype="text/plain",
    )


@app.route("/prompt-title", methods=["POST"])
def prompt_title():
    data = request.get_json(silent=True) or {}
    prompt_raw = data.get("prompt", "")
    prompt_text = prompt_raw.strip() if isinstance(prompt_raw, str) else ""
    if not prompt_text:
        return jsonify({"error": "prompt is required"}), 400

    model_raw = data.get("model", "")
    selected_model = model_raw.strip() if isinstance(model_raw, str) else ""
    model_name = selected_model or MODEL_NAME

    user_msg = (
        "Suggest a concise reference title for this image-generation prompt "
        "(positive prompt text only):\n\n"
        f"{prompt_text}"
    )
    raw_title = _collect_llm_response(model_name, TITLE_SYSTEM_PROMPT, user_msg)
    rt = (raw_title or "").strip()
    if rt.startswith("[") and "error" in rt.lower():
        return jsonify({"title": ""})
    title = _normalize_generated_title(raw_title)
    if not title:
        return jsonify({"title": ""})
    return jsonify({"title": title})


@app.route("/models", methods=["GET"])
def list_models():
    openrouter_entries = _openrouter_model_entries()
    openrouter_error = None
    if not OPENROUTER_API_KEY:
        openrouter_error = "OPENROUTER_API_KEY not set in .env - OpenRouter model disabled."

    req = urllib.request.Request(
        _ollama_tags_url(),
        headers={"Content-Type": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw)
    except urllib.error.HTTPError as e:
        return (
            jsonify(
                {
                    "models": openrouter_entries,
                    "default_model": MODEL_NAME,
                    "error": f"Ollama returned HTTP {e.code} from {_ollama_tags_url()}",
                }
            ),
            200,
        )
    except urllib.error.URLError as e:
        return (
            jsonify(
                {
                    "models": openrouter_entries,
                    "default_model": MODEL_NAME,
                    "error": f"Could not reach Ollama at {_ollama_tags_url()}: {e.reason}",
                }
            ),
            200,
        )
    except (OSError, json.JSONDecodeError) as e:
        return (
            jsonify(
                {
                    "models": openrouter_entries,
                    "default_model": MODEL_NAME,
                    "error": f"Failed to read models from Ollama: {e}",
                }
            ),
            200,
        )

    payload = {
        "models": _normalize_models(data) + openrouter_entries,
        "default_model": MODEL_NAME,
    }
    if openrouter_error:
        payload["error"] = openrouter_error
    return jsonify(payload)


@app.route("/warmup", methods=["POST"])
def warmup():
    data = request.get_json(silent=True) or {}
    model_raw = data.get("model", "")
    model_name = (model_raw.strip() if isinstance(model_raw, str) else "") or MODEL_NAME

    if _is_openrouter_model(model_name):
        if not OPENROUTER_API_KEY:
            return jsonify(
                {
                    "ok": False,
                    "model": model_name,
                    "error": "OPENROUTER_API_KEY not set in .env",
                }
            )
        return jsonify({"ok": True, "model": model_name, "load_seconds": 0})

    payload = {
        "model": model_name,
        "prompt": "",
        "stream": False,
        "keep_alive": "10m",
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            obj = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return (
            jsonify({"ok": False, "model": model_name, "error": f"HTTP {e.code}: {body}"}),
            200,
        )
    except urllib.error.URLError as e:
        return (
            jsonify({"ok": False, "model": model_name, "error": f"URL error: {e.reason}"}),
            200,
        )
    except (OSError, json.JSONDecodeError) as e:
        return (
            jsonify({"ok": False, "model": model_name, "error": f"Error: {e}"}),
            200,
        )

    load_ns = obj.get("load_duration")
    load_seconds = None
    if isinstance(load_ns, (int, float)) and load_ns > 0:
        load_seconds = round(load_ns / 1_000_000_000, 2)

    return jsonify({"ok": True, "model": model_name, "load_seconds": load_seconds})


if __name__ == "__main__":
    app.run(debug=True)
