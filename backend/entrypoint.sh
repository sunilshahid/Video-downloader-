#!/bin/bash
set -e

# Auto-update yt-dlp as requested
echo "Checking for yt-dlp updates..."
pip install -U yt-dlp

echo "Starting Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
