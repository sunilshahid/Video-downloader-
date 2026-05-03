# STAGE 1: Build Next.js UI
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# STAGE 2: Python Backend
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install ffmpeg for media merging
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg nodejs npm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements & install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and entrypoint
COPY backend/main.py backend/
COPY backend/entrypoint.sh backend/
RUN chmod +x backend/entrypoint.sh

# Copy exported Next.js UI from builder
COPY --from=builder /app/out ./out

# Expose FastAPI port
EXPOSE 8000

# The prompt requests the container to use an entrypoint script to auto update yt-dlp
ENTRYPOINT ["./backend/entrypoint.sh"]
