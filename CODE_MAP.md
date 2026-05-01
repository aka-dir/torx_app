# Code Map

This document gives simple English explanations for the important code paths.

## `web/`

`web/src/pages/ImageSorter.tsx`

- Shows the photo sorter page.
- Accepts files from drag/drop or file input.
- Calls the backend with the selected files.
- Checks exact duplicate files in the browser.
- Stores the final sorter result in `SorterSessionContext`.

`web/src/lib/inventoryClassify.ts`

- Defines the API result shape.
- Converts model labels into fixed UI slots.
- Sends duplicate files to the unclassified side panel.
- Converts labels into Dutch UI names.

`web/src/features/inventory-product/classifyWithRetries.ts`

- Calls `/api/classify`.
- Retries only files that failed once.
- Merges the retry results back into the original list.

`web/src/hooks/useDoneSessionWorkspace.ts`

- Drives the interactive result screen.
- Handles moving files between slots.
- Handles download and ZIP export behavior.

## `backend/`

`backend/app/main.py`

- Creates the FastAPI app.
- Registers all `/api` routes.
- Enables local CORS when `SKIP_AUTH=1`.
- Serves the built frontend in production.

`backend/app/auth.py`

- Reads the current user from Identity Platform in production.
- Creates a local fake user when `SKIP_AUTH=1`.

`backend/app/routes/classify.py`

- Receives uploaded files.
- Builds a `run_id`.
- Stores originals in GCS in production.
- Calls `photosort.classify_batch`.
- Returns the classification report to the frontend.

`backend/app/storage.py`

- Uses Google Cloud Storage in production.
- Skips cloud upload locally when no bucket is configured.

`backend/app/routes/runs.py`

- Marks a run as complete.
- Deletes uploaded originals in production.
- Returns a no-op result locally.

## `inventory-photo-kit/`

`inventory-photo-kit/src/photosort/pipeline.py`

- Main classification pipeline.
- Prepares images.
- Optionally groups pHash duplicates.
- Calls Gemini for representative images.
- Builds the final JSON report.

`inventory-photo-kit/src/photosort/image_prep.py`

- Opens image bytes with Pillow.
- Applies EXIF rotation.
- Resizes large images.
- Converts images to JPEG for Gemini.

`inventory-photo-kit/src/photosort/vision.py`

- Finds the Gemini API key.
- Calls the Gemini model.
- Returns raw model text and token usage.

`inventory-photo-kit/src/photosort/labels.py`

- Parses Gemini text.
- Finds one allowed label.
- Extracts optional vehicle make/model text.

`inventory-photo-kit/src/photosort/features/phash_dedupe.py`

- Calculates perceptual hashes.
- Groups near-duplicate images.
- Returns which image should be the representative for each group.

`inventory-photo-kit/config/prompts.yaml`

- Holds the Gemini classification prompt.
- Holds the full list of allowed labels.

`inventory-photo-kit/config/settings.yaml`

- Holds model name, resize settings, retry settings, and dedupe settings.
