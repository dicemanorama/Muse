from __future__ import annotations

import json
import os
import sqlite3
from typing import Any


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str, templates_json_path: str, valid_categories: set[str]) -> None:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with _connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saved_prompts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mode TEXT NOT NULL,
                positive TEXT NOT NULL,
                negative TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                free_text TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_templates (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                category TEXT NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.commit()
    _migrate_templates_from_json_if_empty(db_path, templates_json_path, valid_categories)


def _decode_tags(raw: Any) -> list[str]:
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
    else:
        parsed = raw
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    for item in parsed:
        if isinstance(item, str):
            value = item.strip()
            if value:
                out.append(value)
    return out


def _migrate_templates_from_json_if_empty(
    db_path: str, templates_json_path: str, valid_categories: set[str]
) -> None:
    with _connect(db_path) as conn:
        row = conn.execute("SELECT COUNT(*) AS count FROM user_templates").fetchone()
        count = int(row["count"]) if row and "count" in row.keys() else 0
        if count > 0:
            return

        try:
            with open(templates_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return
        if not isinstance(data, list):
            return

        imported = 0
        for item in data:
            if not isinstance(item, dict):
                continue
            template_id = item.get("id")
            label = item.get("label")
            category = item.get("category")
            if not isinstance(template_id, str) or not template_id.strip():
                continue
            if not isinstance(label, str) or not label.strip():
                continue
            if category not in valid_categories:
                continue
            tags = _decode_tags(item.get("tags"))
            conn.execute(
                """
                INSERT OR IGNORE INTO user_templates
                (id, label, category, tags_json, created_at)
                VALUES (?, ?, ?, ?, strftime('%s','now') * 1000)
                """,
                (template_id.strip(), label.strip(), category, json.dumps(tags)),
            )
            imported += 1
        if imported:
            conn.commit()


def list_user_templates(db_path: str, valid_categories: set[str]) -> list[dict]:
    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, label, category, tags_json
            FROM user_templates
            ORDER BY created_at ASC, id ASC
            """
        ).fetchall()
    out: list[dict] = []
    for row in rows:
        category = row["category"]
        if category not in valid_categories:
            continue
        out.append(
            {
                "id": row["id"],
                "label": row["label"],
                "category": category,
                "tags": _decode_tags(row["tags_json"]),
                "is_predefined": False,
            }
        )
    return out


def create_user_template(
    db_path: str, template_id: str, label: str, category: str, tags: list[str], created_at: int
) -> dict:
    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO user_templates (id, label, category, tags_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (template_id, label, category, json.dumps(tags), created_at),
        )
        conn.commit()
    return {
        "id": template_id,
        "label": label,
        "category": category,
        "tags": tags,
        "is_predefined": False,
    }


def delete_user_template(db_path: str, template_id: str) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM user_templates WHERE id = ?", (template_id,))
        conn.commit()


def list_saved_prompts(db_path: str) -> list[dict]:
    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, name, mode, positive, negative, tags_json, free_text, created_at
            FROM saved_prompts
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    out: list[dict] = []
    for row in rows:
        out.append(
            {
                "id": row["id"],
                "name": row["name"],
                "mode": row["mode"],
                "positive": row["positive"],
                "negative": row["negative"],
                "tags": _decode_tags(row["tags_json"]),
                "freeText": row["free_text"],
                "createdAt": int(row["created_at"]),
            }
        )
    return out


def create_saved_prompt(
    db_path: str,
    prompt_id: str,
    name: str,
    mode: str,
    positive: str,
    negative: str,
    tags: list[str],
    free_text: str,
    created_at: int,
) -> dict:
    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO saved_prompts
            (id, name, mode, positive, negative, tags_json, free_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prompt_id,
                name,
                mode,
                positive,
                negative,
                json.dumps(tags),
                free_text,
                created_at,
            ),
        )
        conn.commit()
    return {
        "id": prompt_id,
        "name": name,
        "mode": mode,
        "positive": positive,
        "negative": negative,
        "tags": tags,
        "freeText": free_text,
        "createdAt": created_at,
    }


def delete_saved_prompt(db_path: str, prompt_id: str) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM saved_prompts WHERE id = ?", (prompt_id,))
        conn.commit()
