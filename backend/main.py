import json
import subprocess
import asyncio
import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="StreamRipper API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/info")
async def get_info(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    cmd = ["yt-dlp", "-J", "--no-playlist", url]
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            raise HTTPException(status_code=400, detail=f"yt-dlp error: {stderr.decode()}")
            
        data = json.loads(stdout)
        
        formats = []
        best_audio = None
        
        for fmt in data.get("formats", []):
            if fmt.get("vcodec") == "none" and fmt.get("acodec") != "none":
                if best_audio is None or (fmt.get("abr", 0) > best_audio.get("abr", 0)):
                    best_audio = {"url": fmt.get("url"), "abr": fmt.get("abr")}

        for fmt in data.get("formats", []):
            if fmt.get("vcodec") != "none":
                format_info = {
                    "format_id": fmt.get("format_id"),
                    "ext": fmt.get("ext"),
                    "resolution": fmt.get("resolution") or f"{fmt.get('width')}x{fmt.get('height')}",
                    "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
                    "vcodec": fmt.get("vcodec"),
                    "acodec": fmt.get("acodec"),
                    "url": fmt.get("url"),
                }
                formats.append(format_info)
                
        return {
            "title": data.get("title", "Video"),
            "thumbnail": data.get("thumbnail"),
            "duration": data.get("duration", 0),
            "formats": formats,
            "best_audio_url": best_audio["url"] if best_audio else None
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse yt-dlp output")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download")
async def download_video(request: Request, video_url: str, audio_url: Optional[str] = None, filename: str = "video.mp4"):
    cmd = ["ffmpeg"]
    if audio_url:
        cmd.extend(["-i", video_url, "-i", audio_url])
    else:
        cmd.extend(["-i", video_url])
        
    cmd.extend([
        "-c", "copy",
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov",
        "pipe:1"
    ])
    
    # Subprocess pipe for memory safety and no disk writes
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    async def stream_generator():
        try:
            while True:
                if await request.is_disconnected():
                    process.terminate()
                    break
                
                chunk = process.stdout.read(65536) # Read 64KB chunk
                if not chunk:
                    break
                yield chunk
        except asyncio.CancelledError:
            process.terminate()
        finally:
            process.terminate()
            process.wait()
            
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }
    
    return StreamingResponse(
        stream_generator(),
        media_type="video/mp4",
        headers=headers
    )

# Mount the static frontend if it exists
frontend_path = os.path.join(os.path.dirname(__file__), "..", "out")
if os.path.exists(frontend_path):
    app.mount("/_next", StaticFiles(directory=os.path.join(frontend_path, "_next")), name="next")
    
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        full_path = os.path.join(frontend_path, path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return FileResponse(full_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))