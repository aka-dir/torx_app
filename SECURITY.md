# Security Notes

This project calls Gemini Vision and may handle customer vehicle photos.

## Do Not Commit

- Real API keys
- `.env` or `.env.local`
- `apikey_test.local`
- Service account JSON files
- Customer photos or ZIP exports
- Local virtual environments or dependency folders

## API Keys

Use one of these local options:

- `GEMINI_API_KEY` environment variable
- `inventory-photo-kit\.env` copied from `.env.example`
- `GEMINI_API_KEY_FILE` pointing to an ignored local file

`inventory-photo-kit\apikey_test` is committed only as a placeholder. Replace it
locally when running Docker, but do not commit a real key.

## Local Development

Local development uses:

- `SKIP_AUTH=1`
- no Google Cloud Storage when `GCS_BUCKET` is empty
- no Firestore writes when `GCP_PROJECT` is empty

Do not use `SKIP_AUTH=1` in production.
