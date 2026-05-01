# TorxFlow — Image Sorter (frontend)

Dutch end-user UI for sorting vehicle photos. **Repository language:** English (code, comments, docs). **Product UI copy:** Dutch (`nl`).

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Point `VITE_CLASSIFY_API_URL` at your [inventory-photo-kit](https://github.com/…) `/classify` server (e.g. `http://127.0.0.1:8790`). Classification runs on the server; this app maps labels to slots and handles ZIP export.

## Classify API summary

After each successful run, a one-line summary is printed to the **browser developer console** (F12 → Console), not as a large on-screen block.
