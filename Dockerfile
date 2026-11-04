# syntax=docker/dockerfile:1
# Stage 1: build the React screens (frontend/dist).
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# The Demo Guide reads the narration lines (frontend/src/lib/demoGuide/narration.js imports ../../../../scripts/demo/narration.json).
COPY scripts/demo/narration.json /scripts/demo/narration.json
RUN npm run build

# Stage 2: the Flask API (served by waitress through scripts/serve_uat.py) plus the built screens.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY *.py ./
COPY scripts/*.py ./scripts/
COPY Documents ./Documents
COPY --from=web /web/dist ./frontend/dist
COPY deploy/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /data
# Database, uploads and the session secret live in the volume mounted at /data.
ENV DATABASE_URL=sqlite:////data/usls_gs_demo.sqlite3 \
    USLS_UPLOAD_DIR=/data/uploads \
    SECRET_KEY_FILE=/data/secret_key \
    RAG_INDEX_DIR=/data/rag_index \
    FLASK_HOST=0.0.0.0 \
    FLASK_PORT=5000
EXPOSE 5000
ENTRYPOINT ["entrypoint.sh"]
CMD ["python", "scripts/serve_uat.py"]
