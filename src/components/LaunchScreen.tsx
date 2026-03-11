import { useState, useEffect } from "react";
import { getRecentFiles, createNewFile, openFile, openRecentFile } from "../lib/tauriCommands";
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

  async function handleNewFile() {
    try {
      setError(null);
      const { path, slides } = await createNewFile();
      onFileOpened(path, slides);
    } catch (err) {
      if (err instanceof Error && err.message !== "File creation cancelled") {
        setError(err.message);
      }
    }
  }

  async function handleOpenFile() {
    try {
      setError(null);
      const { path, slides } = await openFile();
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ideaSlide</h1>
          <p className="text-gray-600">Create beautiful presentations with Excalidraw</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleNewFile}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="text-4xl mb-2">+</div>
              <div className="font-semibold text-gray-900">New Presentation</div>
              <div className="text-sm text-gray-500 mt-1">Start from scratch</div>
            </button>

            <button
              onClick={handleOpenFile}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="text-4xl mb-2">📁</div>
              <div className="font-semibold text-gray-900">Open File</div>
              <div className="text-sm text-gray-500 mt-1">Browse for .is files</div>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading recent files...</div>
        ) : recentFiles.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Files</h2>
            <div className="space-y-2">
              {recentFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleOpenRecent(file.path)}
                  className="w-full text-left p-3 rounded hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{file.name}</div>
                  <div className="text-sm text-gray-500">{file.path}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
