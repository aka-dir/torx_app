# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web

# Local Docker image skips Identity Platform in the built SPA.
# Vite reads this at build time, not at container runtime.
ARG VITE_SKIP_AUTH=true
ENV VITE_SKIP_AUTH=${VITE_SKIP_AUTH}

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build


FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WEB_DIST_DIR=/app/web/dist \
    SKIP_AUTH=1 \
    DEV_GARAGE_ID=local-dev \
    GCS_BUCKET= \
    GCP_PROJECT= \
    PORT=8076

COPY inventory-photo-kit/ ./inventory-photo-kit/
COPY backend/ ./backend/
COPY --from=web-build /app/web/dist ./web/dist

RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -e ./inventory-photo-kit \
    && python -m pip install --no-cache-dir -e ./backend

EXPOSE 8076

CMD ["sh", "-c", "uvicorn app.main:app --app-dir /app/backend --host 0.0.0.0 --port ${PORT:-8076}"]
