import { useState, useEffect } from "react";
import { getRecentFiles, createNewPresentation, openFile, openRecentFile, addRecentFile } from "../lib/tauriCommands";
import type { RecentFile } from "../types";

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

  return (
    <div className="h-screen bg-gray-50 flex flex-col items-center px-8 pt-12 pb-8">
      {/* Header */}
      <div className="text-center mb-8 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">ideaSlide</h1>
        <p className="text-sm text-gray-500">Create beautiful presentations with Excalidraw</p>
      </div>

      {error && (
        <div className="max-w-xl w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="max-w-xl w-full flex-shrink-0 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleNewIdea}
            className="p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-center"
          >
            <div className="text-2xl mb-1.5 text-blue-500">+</div>
            <div className="font-medium text-gray-900 text-sm">New Idea</div>
            <div className="text-xs text-gray-400 mt-0.5">Start from scratch</div>
          </button>

          <button
            onClick={handleOpenFile}
            className="p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-center"
          >
            <div className="text-2xl mb-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline text-blue-500">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="font-medium text-gray-900 text-sm">Open File</div>
            <div className="text-xs text-gray-400 mt-0.5">Browse for .is files</div>
          </button>
        </div>
      </div>

      {/* Recent files — scrollable */}
      {loading ? (
        <div className="text-center text-gray-400 text-sm">Loading recent files...</div>
      ) : recentFiles.length > 0 ? (
        <div className="max-w-xl w-full min-h-0 flex flex-col flex-1">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1 flex-shrink-0">Recent Files</h2>
          <div className="flex-1 overflow-y-auto rounded-xl bg-white border border-gray-200">
            {recentFiles.map((file, i) => (
              <button
                key={file.path}
                onClick={() => handleOpenRecent(file.path)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900 text-sm">{file.name}</div>
                  <div className="text-xs text-gray-400 flex-shrink-0 ml-4">
                    {file.modified
                      ? new Date(file.modified).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </div>
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{file.path}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
