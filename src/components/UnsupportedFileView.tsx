import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

interface UnsupportedFileViewProps {
  fileName: string;
  fullPath?: string;
  message?: string;
}

export function UnsupportedFileView({ fileName, fullPath, message }: UnsupportedFileViewProps) {
  return (
    <div className="flex h-full items-center justify-center bg-[#f7f8fa] px-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-600">◇</div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">Unsupported File</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {message || `IdeaNote cannot edit “${fileName}” yet. The file has not been read or modified.`}
        </p>
        {fullPath && (
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => revealItemInDir(fullPath)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Reveal in Finder
            </button>
            <button type="button" onClick={() => openPath(fullPath)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700">
              Open Externally
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
