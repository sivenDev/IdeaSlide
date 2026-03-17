import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getRecentFiles, createNewPresentation, openFile, openRecentFile, addRecentFile } from "../lib/tauriCommands";
import type { RecentFile } from "../types";

function formatRelativeTime(isoString: string): string {
  try {
    const now = new Date();
    const opened = new Date(isoString);

    if (isNaN(opened.getTime())) {
      return "未知时间";
    }

    const diffMs = now.getTime() - opened.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (opened.toDateString() === yesterday.toDateString()) return "昨天";

    if (diffDays < 7) return `${diffDays} 天前`;

    return opened.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  } catch {
    return "未知时间";
  }
}

interface LaunchScreenProps {
  onFileOpened: (filePath: string, slides: any[]) => void;
}

export function LaunchScreen({ onFileOpened }: LaunchScreenProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentFiles();
  }, []);

  async function loadRecentFiles() {
    try {
      const files = await getRecentFiles();
      setRecentFiles(files);
    } catch (err) {
      console.error("Failed to load recent files:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleNewIdea() {
    const { slides } = createNewPresentation();
    onFileOpened("", slides);
  }

  async function handleOpenFile() {
    try {
      setError(null);
      const { path, slides } = await openFile();
      addRecentFile(path).catch(console.error);
      onFileOpened(path, slides);
    } catch (err) {
      if (err instanceof Error && err.message !== "File selection cancelled") {
        setError(err.message);
      }
    }
  }

  async function handleOpenRecent(filePath: string) {
    try {
      setError(null);
      const slides = await openRecentFile(filePath);
      onFileOpened(filePath, slides);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file");
    }
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <div
      className="h-screen flex"
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('button, a, input, [data-no-drag]')) {
          getCurrentWindow().startDragging();
        }
      }}
    >
      {/* Left panel — gradient */}
      <div className={`w-[45%] bg-gradient-to-br from-[#667eea] to-[#764ba2] flex flex-col justify-center px-10 relative overflow-hidden ${isMac ? "pt-8 pb-16" : "py-12"}`}>
        {/* Geometric decorations */}
        <div className="absolute -top-10 -right-10 w-[200px] h-[200px] rounded-full bg-white/5" />
        <div className="absolute -bottom-15 -left-8 w-[250px] h-[250px] rounded-full bg-white/[0.03]" />
        <div className="absolute top-1/2 right-5 w-[100px] h-[100px] border border-white/[0.08] rounded-2xl rotate-45" />

        <div className="relative z-10">
          <div className="text-[11px] tracking-[3px] uppercase text-white/50 mb-3">Welcome to</div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">IdeaSlide</h1>
          <div className="w-10 h-0.5 bg-white/40 mt-4 rounded-full" />
          <p className="text-[13px] text-white/60 mt-4 leading-relaxed">
            Where ideas take shape —<br />
            <span className="text-white/45">powered by AI, drawn by you.</span>
          </p>

          {/* AI badge */}
          <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-gradient-to-br from-white/[0.12] to-white/5 border border-white/[0.15] backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="text-[10px] text-white/70 font-medium tracking-wider">AI-Powered</span>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-white/10 border border-white/20 rounded-lg text-white text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2.5 mt-7">
            <button
              onClick={handleNewIdea}
              className="w-full py-3 px-5 rounded-[10px] bg-white/[0.15] backdrop-blur-md border border-white/20 hover:bg-white/[0.22] transition-all text-white text-[13px] font-medium text-left flex items-center gap-3"
            >
              <span className="text-base">✦</span>
              New Idea
            </button>
            <button
              onClick={handleOpenFile}
              className="w-full py-3 px-5 rounded-[10px] bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.14] transition-all text-white/90 text-[13px] font-medium text-left flex items-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Open File
            </button>
          </div>
        </div>

        {/* Version — bottom left */}
        <div className="absolute bottom-5 left-10 z-10">
          <span className="text-[10px] text-white/25 font-medium tracking-wide">v0.1.0</span>
        </div>
      </div>

      {/* Right panel — recent files */}
      <div className={`flex-1 bg-white flex flex-col px-8 py-10 ${isMac ? "pt-16" : "pt-16 pr-12"}`}>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Files</h2>

        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : recentFiles.length > 0 ? (
          <div className="flex-1 overflow-y-auto -mx-3">
            {recentFiles.map((file, i) => (
              <button
                key={file.path}
                onClick={() => handleOpenRecent(file.path)}
                className={`w-full text-left px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <div className="font-medium text-gray-900 text-sm">{file.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-gray-400 truncate mr-4">{file.path}</div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {file.modified
                      ? new Date(file.modified).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No recent files</div>
        )}
      </div>
    </div>
  );
}
