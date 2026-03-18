import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SaveIndicator } from "./SaveIndicator";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  showPreview: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onGoHome: () => void;
  onTogglePreview: () => void;
  onAddSlide: () => void;
  onStartPreview: () => void;
  onStartFullscreen: () => void;
  onStartFromBeginning: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewIdea,
  onOpenFile,
  onSave,
  onGoHome,
  onAddSlide,
  onStartPreview,
  onStartFullscreen,
  onStartFromBeginning,
}: ToolbarProps) {
  const [showPresentMenu, setShowPresentMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPresentMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPresentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPresentMenu]);

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <div
      className={`h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-1 ${isMac ? "pl-20" : "pr-36"}`}
      onMouseDown={(e) => {
        // Only drag when clicking the toolbar background itself, not buttons/inputs
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-drag-region]')) {
          getCurrentWindow().startDragging();
        }
      }}
    >
      {/* Left: Home + filename */}
      <button
        onClick={onGoHome}
        className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100"
        title="Back to home"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <span className="text-sm font-medium text-gray-800 mr-1">
        {fileName || "Untitled"}
      </span>
      <SaveIndicator isDirty={isDirty} isSaving={isSaving} />

      {/* Spacer */}
      <div className="flex-1" data-drag-region />

      {/* Right: file ops + slide + present */}
      <div className="flex items-center gap-1">
      <button
        onClick={onNewIdea}
        className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100"
        title="New file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </button>
      <button
        onClick={onOpenFile}
        className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100"
        title="Open file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <button
        onClick={onSave}
        className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100"
        title="Save"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <button
        onClick={onAddSlide}
        className="px-2.5 py-1 rounded-md border border-blue-500 bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
        title="Add slide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Slide
      </button>

      <div className="w-2" />

      {/* Present button with dropdown */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setShowPresentMenu((prev) => !prev)}
          className="px-3 py-1 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1.5"
          title="Present"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Present
        </button>

        {showPresentMenu && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
            <button
              onClick={() => { onStartPreview(); setShowPresentMenu(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Preview
            </button>
            <button
              onClick={() => { onStartFullscreen(); setShowPresentMenu(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              Fullscreen
            </button>
            <button
              onClick={() => { onStartFromBeginning(); setShowPresentMenu(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              From Beginning
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
