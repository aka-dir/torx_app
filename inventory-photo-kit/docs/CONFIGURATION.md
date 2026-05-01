# Configuration (model, API key, prompts)

Keep changes in a few places; the UI only talks to `POST /classify` on your Python server.

## API key (Gemini)

1. **Environment** (recommended for production): set `GEMINI_API_KEY` or `GOOGLE_API_KEY` in `.env` next to this project (see `.env.example`).
2. **Text file**: set `GEMINI_API_KEY_FILE` to the full path of a UTF-8 file whose first line is the key.
3. **Local default file**: if the env vars above are empty, the server looks for `apikey_test` in the `inventory-photo-kit` folder.
4. **Legacy default file names**: if no key is found yet, the server looks for `apikey__.txt` in:
   - the `inventory-photo-kit` folder, then
   - the parent folder (e.g. same directory as `proje_koku` / workspace root).

Model id and image sizing live in `config/settings.yaml` (`model:`). Change the model string there when Google ships new IDs.

## Prompts and labels

Edit `config/prompts.yaml` (`allowed_labels`, `classify_prompt`). The Torxflow UI maps those labels to coarse slots in `torxflow-sort-demo-main/.../src/lib/inventoryClassify.ts` (`modelLabelToSlotId`).

## Other vision providers

`photosort/vision.py` is the only module that calls Gemini. To add another API:

1. Implement the same function shape as `classify_image` (JPEG bytes in → text + token usage dict).
2. Swap the implementation or branch on `config/settings.yaml` `provider:` and call your SDK.

## Frontend → backend URL

The Vite app uses `VITE_CLASSIFY_API_URL` (default `http://127.0.0.1:8790`). Set it in `.env` in the Torxflow app if the API runs elsewhere.
