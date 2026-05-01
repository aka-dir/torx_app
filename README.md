# TorxFlow Local Photo Sorter

TorxFlow sorts vehicle inventory photos into fixed Dutch UI slots.

## API Key First

For local development and Docker, put your Gemini key in `inventory-photo-kit\apikey_test`.
This repository includes that file as a placeholder. Replace its first line with
your real key before starting Docker:

```powershell
Set-Content .\inventory-photo-kit\apikey_test "your-key-here"
```

The app reads this file automatically. Do not commit or share real API keys.

## Fast Docker Start

Requirements:

- Docker Desktop installed and running.
- You have to put a Gemini API key in `inventory-photo-kit\apikey_test`.

Start the app:

```powershell
.\start-docker.bat
```

Open:

```text
http://localhost:8076/sorter
```

Stop the app:

```powershell
.\stop-docker.bat
```

It contains:

- `web/` - React + Vite frontend. The browser UI runs on port `5192`.
- `backend/` - FastAPI backend. The API runs on port `8076`.
- `inventory-photo-kit/` - The photo classification kit used by the backend.

The app sorts car inventory photos into fixed slots. It sends uploaded photos to the backend, the backend calls `photosort`, and `photosort` uses Gemini Vision to choose a label.

The user interface is intentionally Dutch for end users. The project docs and code comments are simple English for the team.

## Local Architecture

```text
Browser
  -> http://localhost:5192
  -> web/ React sorter UI
  -> POST http://127.0.0.1:8076/api/classify
  -> backend/ FastAPI
  -> inventory-photo-kit/photosort
  -> Gemini Vision API
```

## How It Works

1. The user opens the Dutch sorter UI in the browser.
2. The user uploads car photos or a ZIP file.
3. The React app removes exact duplicate files in the browser.
4. The React app sends the remaining images to `POST /api/classify`.
5. The FastAPI backend reads each upload into memory.
6. In local mode, the backend skips auth, Google Cloud Storage, and Firestore.
7. The backend calls `inventory-photo-kit` with `(filename, bytes)` pairs.
8. The kit resizes each image to a smaller JPEG before sending it to Gemini.
9. If pHash dedupe is enabled, near-duplicate images reuse one Gemini result.
10. Gemini returns a label and optional vehicle text for each photo.
11. The kit normalizes the model text into allowed labels from `prompts.yaml`.
12. The backend returns the structured report to the React app.
13. The React app maps labels into fixed Dutch UI slots and prepares ZIP export names.

## Important Local Behavior

- Auth is skipped locally with `SKIP_AUTH=1`.
- Google Cloud Storage is skipped locally if `GCS_BUCKET` is empty.
- Firestore run writes are skipped locally if `GCP_PROJECT` is empty.
- Exact duplicate files are detected in the browser and shown as `Duplicaat (zelfde inhoud)`.
- pHash duplicate grouping can be enabled from the UI toggle. It sends `dedupe=1` to the backend.

## Setup

From this folder:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .\inventory-photo-kit
pip install -e .\backend

cd web
npm install
```

You can also create `inventory-photo-kit\.env` or set an environment variable:

```powershell
$env:GEMINI_API_KEY = "your-key-here"
```

For a local key file, create an ignored file:

```powershell
Set-Content .\inventory-photo-kit\apikey_test.local "your-key-here"
$env:GEMINI_API_KEY_FILE = "inventory-photo-kit\apikey_test.local"
```

Do not commit or share real API keys.

## Run Locally

Open two terminals.

Terminal 1:

```powershell
cd backend
$env:SKIP_AUTH="1"
$env:DEV_GARAGE_ID="local-dev"
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8076
```

Terminal 2:

```powershell
cd web
$env:VITE_CLASSIFY_API_URL="http://127.0.0.1:8076"
npm run dev -- --host 0.0.0.0 --port 5192 --strictPort
```

Open:

```text
http://localhost:5192/sorter
```

Backend health check:

```text
http://127.0.0.1:8076/api/health
```

You can also use:

```powershell
.\START_LOCAL.ps1
```

This opens separate PowerShell windows for the backend and frontend.

## Run With Docker

The Docker setup builds the React app and serves it from the FastAPI container.
Docker files live in `docker/`, and the compose service is named `torxflow-sorter`.
The Docker build sets `VITE_SKIP_AUTH=true`, so the browser UI does not ask for
Identity Platform login in local Docker mode.

Put your Gemini key in `inventory-photo-kit\apikey_test` before starting the
container. This file is mounted at runtime and is excluded from the Docker image:

```powershell
Set-Content .\inventory-photo-kit\apikey_test "your-key-here"
```

Build and start:

```powershell
.\start-docker.bat
```

If port `8076` is already in use, choose another host port:

```powershell
.\start-docker.bat 8090
```

Stop Docker:

```powershell
.\stop-docker.bat
```

Or run Docker Compose directly:

```powershell
docker compose -f .\docker\compose.yml up --build -d torxflow-sorter
```

Open:

```text
http://localhost:8076/sorter
```

Backend health check:

```text
http://localhost:8076/api/health
```

The committed `inventory-photo-kit\apikey_test` file is only a placeholder. Do
not commit a real API key or any other secret to GitHub.

## What Is Not Included

This repository does not include generated or private files:

- `.venv/`
- `node_modules/`
- `dist/`
- `.env`
- `.env.local`
- real API key files
- Cloud deployment files

## Main Files

- `web/src/pages/ImageSorter.tsx` - Main upload and sorting screen.
- `web/src/lib/inventoryClassify.ts` - Converts API labels into UI slots.
- `backend/app/routes/classify.py` - Receives photos and calls the classification kit.
- `backend/app/storage.py` - Uploads originals to GCS in production, skips GCS locally.
- `inventory-photo-kit/src/photosort/pipeline.py` - Prepares images, calls Gemini, and returns classification results.
- `inventory-photo-kit/config/prompts.yaml` - Gemini prompt and allowed labels.
- `inventory-photo-kit/config/settings.yaml` - Model, image resize, retry, and dedupe settings.

## Before Pushing To GitHub

Only source files, examples, and Docker setup files should be shared.
Never add real `.env` files, API keys, service account JSON files, or customer photos.
