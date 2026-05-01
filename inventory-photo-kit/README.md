# inventory-photo-kit

**Reusable library** for classifying vehicle inventory photos with **Gemini** (Google Gen AI SDK).  
No product UI here — use this from your SaaS backend, workers, or scripts.

## API key first

For local development, put your Gemini key in `apikey_test` inside this folder.
The repository includes `apikey_test` as a placeholder. Replace its first line
with your real key before running locally:

```bash
echo "your-key-here" > apikey_test
```

The library also supports `GEMINI_API_KEY`, `GOOGLE_API_KEY`, and `GEMINI_API_KEY_FILE`.

## What you get

| Module | Role |
|--------|------|
| `photosort.config` | Load YAML from `config/` (override dir with `PHOTOSORT_CONFIG_DIR`) |
| `photosort.image_prep` | Resize + JPEG encode before API |
| `photosort.vision` | One Gemini multimodal call + token usage |
| `photosort.labels` | Map model text → allowed label |
| `photosort.reporting` | Batch totals + ASCII table |
| `photosort.pipeline` | **`classify_batch([("name.jpg", bytes), ...])`** — main entry |

## Setup

```bash
cd inventory-photo-kit
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -e .
# Optional: dev server
pip install -e ".[http]"
```

The quickest local key setup is `apikey_test`. You can also copy `.env.example`
to `.env` and set `GEMINI_API_KEY` or `GOOGLE_API_KEY`.

## Configure

- `config/settings.yaml` — model id, image scaling, timing, generation limits  
- `config/prompts.yaml` — classification prompt + `allowed_labels`

## Use in code

```python
from photosort import classify_batch

result = classify_batch([("photo.jpg", raw_bytes)], emit_summary_table=False)
for item in result["items"]:
    if item["ok"]:
        print(item["file"], item["label"])

# Many files: process 10 per wave; response has mode "chunked", per-chunk "result", plus "merged".
result = classify_batch(lots_of_files, chunk_size=10, emit_summary_table=False)
```

`POST /classify?chunk_size=10` (default) splits large uploads; `chunk_size=0` runs all files in one batch.

## Optional dev HTTP

```bash
uvicorn examples.http_dev:app --host 127.0.0.1 --port 8790
```

- **`http://127.0.0.1:8790/ui/`** — browser test page (served from sibling `photosort-dev-ui` if present; **same server — no second terminal**).
- `GET /` — JSON route list  
- `GET /health` — liveness  
- `POST /classify` — multipart form field **`files`**

## Tests

```bash
pip install -e ".[dev]"
pytest
```

## License

MIT.
