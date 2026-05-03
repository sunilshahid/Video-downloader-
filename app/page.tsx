"use client";

import { useState } from "react";
import { Search, Info, Loader2, Download, Video } from "lucide-react";
import Image from "next/image";

type VideoFormat = {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  url: string;
};

type VideoInfo = {
  title: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
  best_audio_url: string | null;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState<VideoInfo | null>(null);

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    setInfo(null);

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        let errMessage = "Failed to fetch metadata";
        try {
          const errorData = await res.json();
          errMessage = errorData.detail || errMessage;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }
      const data = await res.json();
      setInfo(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (format: VideoFormat) => {
    if (!info) return;
    
    const params = new URLSearchParams();
    params.append("video_url", format.url);
    if (format.acodec === "none" && info.best_audio_url) {
      params.append("audio_url", info.best_audio_url);
    }
    const safeTitle = info.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    params.append("filename", `${safeTitle}_${format.resolution}.${format.ext}`);

    const downloadUrl = `/api/download?${params.toString()}`;
    
    // Trigger download via anchor
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function formatBytes(bytes: number | null, decimals = 2) {
    if (bytes === null) return 'Unknown size';
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center py-24 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-3xl space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-indigo-500/10 mb-2">
            <Video className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            StreamRipper
          </h1>
          <p className="text-neutral-400 text-lg">
            Directly pipe video streams to your device. No server storage.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            className="w-full bg-neutral-900 border border-neutral-800 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 text-neutral-100 rounded-2xl py-5 pl-12 pr-32 outline-none transition-all placeholder:text-neutral-600 shadow-xl shadow-black/20"
            placeholder="Paste video URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchInfo()}
          />
          <button
            onClick={fetchInfo}
            disabled={loading || !url}
            className="absolute inset-y-2 right-2 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium rounded-xl transition-all flex items-center justify-center min-w-[100px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch"}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {info && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
              {info.thumbnail && (
                <div className="w-full md:w-64 shrink-0 rounded-xl overflow-hidden bg-neutral-950 aspect-video relative ring-1 ring-neutral-800">
                  <Image 
                    src={info.thumbnail} 
                    alt={info.title} 
                    fill 
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="space-y-2 flex-1">
                <h2 className="text-xl font-semibold text-white line-clamp-2 leading-tight">
                  {info.title}
                </h2>
                <div className="flex items-center gap-3 text-sm text-neutral-400">
                  <span>{Math.floor(info.duration / 60)}:{String(info.duration % 60).padStart(2, '0')}</span>
                  <span className="w-1 h-1 rounded-full bg-neutral-700" />
                  <span>{info.formats.length} formats</span>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-800">
              <div className="max-h-[400px] overflow-y-auto divide-y divide-neutral-800/50">
                {info.formats.filter(f => f.resolution !== 'audio only').map((format, idx) => (
                  <div key={`${format.format_id}-${idx}`} className="flex items-center justify-between p-4 hover:bg-neutral-800/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-16 text-center">
                        <span className="inline-block px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-lg">
                          {format.resolution.split('x').pop()}p
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-neutral-200">
                          {format.ext.toUpperCase()} <span className="text-neutral-500 font-normal">({format.vcodec !== 'none' ? 'Video' : ''}{format.vcodec !== 'none' && format.acodec !== 'none' ? ' & ' : ''}{format.acodec !== 'none' ? 'Audio' : format.vcodec !== 'none' && info.best_audio_url ? ' + Merged Audio' : ''})</span>
                        </span>
                        <span className="text-neutral-500">
                          {formatBytes(format.filesize)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(format)}
                      className="p-2.5 bg-neutral-800/50 hover:bg-indigo-500 hover:text-white text-neutral-300 rounded-xl transition-all"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
