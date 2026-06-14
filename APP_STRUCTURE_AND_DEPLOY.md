# Muse App Structure and Deploy Runbook

This note documents how the Muse prompt-builder app is organized and how the live DigitalOcean deployment is tied to git.

## Repository Structure

```text
Muse/
+-- .github/
|   +-- workflows/
|       +-- deploy.yml
+-- prompt-builder/
|   +-- app.py
|   +-- config.py
|   +-- db.py
|   +-- storage.db
|   +-- templates.json
|   +-- templates/
|   |   +-- index.html
|   +-- static/
|       +-- script.js
|       +-- style.css
+-- env.example
+-- launch.bat
+-- README.md
+-- requirements.txt
```

## App Structure

- `prompt-builder/app.py` is the Flask application entry point.
- `prompt-builder/config.py` contains prompt system instructions, tag/category data, model defaults, and environment-variable configuration.
- `prompt-builder/db.py` owns SQLite persistence for saved prompts and user-created templates.
- `prompt-builder/templates/index.html` is the main Flask/Jinja HTML template.
- `prompt-builder/static/script.js` contains the browser-side app behavior: mode switching, prompt generation/refinement, favorites, templates, and parameter collection.
- `prompt-builder/static/style.css` contains the app styling.
- `prompt-builder/storage.db` is the default SQLite database file when `STORAGE_DB_PATH` is not overridden.
- `requirements.txt` defines the Python dependencies.

## Runtime Behavior

The UI supports two prompt output modes:

- Midjourney: a single prompt with Midjourney parameter flags appended client-side.
- SDXL / ComfyUI: positive prompt, negative prompt, and generation settings.

The model picker can use:

- OpenRouter, when `OPENROUTER_API_KEY` is configured.
- Ollama, when local Ollama endpoints are available.

Important Flask routes include:

- `GET /` - main UI
- `GET /models` - model metadata for the picker
- `POST /warmup` - model warmup/check
- `POST /generate` - streaming prompt generation
- `POST /refine` - streaming prompt refinement
- `GET /templates`, `POST /templates`, `DELETE /templates/<template_id>`
- `GET /saved-prompts`, `POST /saved-prompts`, `DELETE /saved-prompts/<prompt_id>`

## Local Development

On Windows, use:

```bat
launch.bat
```

That script creates/uses `venv`, installs `requirements.txt`, and runs the Flask app from `prompt-builder/app.py`.

Manual local run:

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python .\prompt-builder\app.py
```

Local Flask defaults to:

```text
http://localhost:5000
```

## Production Server

The live app runs on a DigitalOcean droplet.

Known deployment details:

- SSH host: `159.89.228.0`
- SSH user: `aaron`
- Repo checkout path: `/var/www/muse`
- PM2 process name: `muse`
- Gunicorn bind: `127.0.0.1:5002`
- Gunicorn chdir: `/var/www/muse/prompt-builder`

The PM2 process runs a command equivalent to:

```bash
/var/www/muse/venv/bin/gunicorn \
  -w 2 \
  -b 127.0.0.1:5002 \
  --chdir /var/www/muse/prompt-builder \
  --timeout 600 \
  app:app
```

The app is expected to be reached publicly through nginx or another reverse proxy in front of `127.0.0.1:5002`.

## GitHub Actions Deploy

Deployment is configured in:

```text
.github/workflows/deploy.yml
```

The workflow runs on every push to `main`.

Current deploy script:

```bash
cd /var/www/muse
git pull
source venv/bin/activate
pip install -r requirements.txt
pm2 restart muse
```

The workflow uses `appleboy/ssh-action` with:

- `host: 159.89.228.0`
- `username: aaron`
- `key: ${{ secrets.SSH_PRIVATE_KEY }}`

The private SSH key is stored in GitHub Actions secrets as `SSH_PRIVATE_KEY`. Do not commit private keys or `.env` values.

## Deploy Flow

Normal live update flow:

1. Commit changes locally.
2. Push to `origin/main`.
3. GitHub Actions SSHes into the droplet.
4. The workflow pulls the latest `main` into `/var/www/muse`.
5. Dependencies are refreshed in the server venv.
6. PM2 restarts the `muse` process.

Useful checks:

```bash
ssh aaron@159.89.228.0 'cd /var/www/muse && git status --short --branch && git rev-parse --short HEAD'
ssh aaron@159.89.228.0 'pm2 describe muse'
ssh aaron@159.89.228.0 'curl -s http://127.0.0.1:5002/ | grep -n -A4 mj-version'
```

## Important Deploy Note

The deploy workflow must target `/var/www/muse`.

It previously pointed at `/var/www/tickerpicker/tickerpicker`, which allowed the GitHub Action to report success while updating the wrong application checkout. If live changes do not appear after a successful Action, first verify:

```bash
ssh aaron@159.89.228.0 'cd /var/www/muse && git rev-parse --short HEAD'
```

That commit should match `origin/main`.

## Environment Variables

Environment configuration lives in `.env` on each machine. The repo includes `env.example` as a template.

Common variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `STORAGE_DB_PATH`

On the production server, keep secrets on the droplet and in GitHub Secrets only. Do not commit `.env`.
