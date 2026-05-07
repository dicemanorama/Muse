from __future__ import annotations

import io
import json
import os
from urllib.parse import urlsplit
import urllib.error
import urllib.request
import uuid

import requests
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

from config import (
    GROQ_API_KEY,
    GROQ_BASE_URL,
    GROQ_MODELS,
    MJ_SYSTEM_PROMPT,
    MODEL_NAME,
    OLLAMA_URL,
    REFINE_SYSTEM_PROMPT,
    SDXL_SYSTEM_PROMPT,
    TAGS,
)

GROQ_MODEL_IDS = {m["id"] for m in GROQ_MODELS}


def _is_groq_model(name: str) -> bool:
    return isinstance(name, str) and name in GROQ_MODEL_IDS


def _groq_chat_stream(model: str, system: str, user: str):
    if not GROQ_API_KEY:
        yield "[Groq error: GROQ_API_KEY not set in .env]"
        return

    url = f"{GROQ_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
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
                yield f"\n[Groq error {resp.status_code}: {body}]"
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
        yield f"\n[Groq error: {e}]"

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
    """Dispatch to Groq or Ollama based on the selected model."""
    if _is_groq_model(model):
        yield from _groq_chat_stream(model, system, user)
        return
    yield from _ollama_chat_stream(model, system, user)


app = Flask(__name__)

REPOS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "repos.json")


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


def _groq_model_entries() -> list[dict]:
    disabled = not GROQ_API_KEY
    entries: list[dict] = []
    for m in GROQ_MODELS:
        entries.append(
            {
                "name": m["id"],
                "label": m["label"],
                "size_gb": None,
                "family": "groq",
                "parameter_size": m.get("parameter_size"),
                "provider": "groq",
                "disabled": disabled,
            }
        )
    return entries


def _load_repos() -> list[dict]:
    try:
        with open(REPOS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return []
    if not isinstance(data, list):
        return []
    return data


def _save_repos(items: list[dict]) -> None:
    with open(REPOS_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


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
    repo_subject: str = "",
    repo_style: str = "",
) -> str:
    parts: list[str] = []
    
    if repo_subject or repo_style:
        parts.append(f"Repo inspiration — Subject: {repo_subject} | Style: {repo_style}")
    
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
    return render_template("index.html", tags=TAGS)


@app.route("/repos", methods=["GET"])
def list_repos():
    return jsonify(_load_repos())


@app.route("/repos", methods=["POST"])
def create_repo():
    data = request.get_json(silent=True) or {}
    name_raw = data.get("name")
    if isinstance(name_raw, str) and name_raw.strip():
        name = name_raw.strip()
    else:
        name = "New Repo"

    new_repo = {
        "id": str(uuid.uuid4()),
        "name": name,
        "subjects": _clean_string_list(data.get("subjects")),
        "styles": _clean_string_list(data.get("styles")),
    }
    repos = _load_repos()
    repos.append(new_repo)
    _save_repos(repos)
    return jsonify(new_repo)


@app.route("/repos/<repo_id>", methods=["PUT"])
def update_repo(repo_id: str):
    data = request.get_json(silent=True) or {}
    repos = _load_repos()
    for repo in repos:
        if isinstance(repo, dict) and repo.get("id") == repo_id:
            name_raw = data.get("name")
            if isinstance(name_raw, str) and name_raw.strip():
                repo["name"] = name_raw.strip()
            if "subjects" in data:
                repo["subjects"] = _clean_string_list(data.get("subjects"))
            if "styles" in data:
                repo["styles"] = _clean_string_list(data.get("styles"))
            _save_repos(repos)
            return jsonify(repo)
    return jsonify({"error": "not found"}), 404


@app.route("/repos/<repo_id>", methods=["DELETE"])
def delete_repo(repo_id: str):
    repos = _load_repos()
    new_repos = [
        r for r in repos if not (isinstance(r, dict) and r.get("id") == repo_id)
    ]
    if len(new_repos) != len(repos):
        _save_repos(new_repos)
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

    repo_subject_raw = data.get("repo_subject", "")
    repo_subject = (
        repo_subject_raw.strip() if isinstance(repo_subject_raw, str) else ""
    )
    repo_style_raw = data.get("repo_style", "")
    repo_style = repo_style_raw.strip() if isinstance(repo_style_raw, str) else ""
    model_raw = data.get("model", "")
    selected_model = model_raw.strip() if isinstance(model_raw, str) else ""
    model_name = selected_model or MODEL_NAME

    user_prompt = build_user_prompt(tags, free_text, repo_subject, repo_style)

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


@app.route("/models", methods=["GET"])
def list_models():
    groq_entries = _groq_model_entries()
    groq_error = None
    if not GROQ_API_KEY:
        groq_error = "GROQ_API_KEY not set in .env - Groq models disabled."

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
                    "models": groq_entries,
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
                    "models": groq_entries,
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
                    "models": groq_entries,
                    "default_model": MODEL_NAME,
                    "error": f"Failed to read models from Ollama: {e}",
                }
            ),
            200,
        )

    payload = {
        "models": _normalize_models(data) + groq_entries,
        "default_model": MODEL_NAME,
    }
    if groq_error:
        payload["error"] = groq_error
    return jsonify(payload)


@app.route("/warmup", methods=["POST"])
def warmup():
    data = request.get_json(silent=True) or {}
    model_raw = data.get("model", "")
    model_name = (model_raw.strip() if isinstance(model_raw, str) else "") or MODEL_NAME

    if _is_groq_model(model_name):
        if not GROQ_API_KEY:
            return jsonify(
                {
                    "ok": False,
                    "model": model_name,
                    "error": "GROQ_API_KEY not set in .env",
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
