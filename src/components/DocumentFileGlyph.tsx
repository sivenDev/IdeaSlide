import { getFileTypeDefinitionByPath } from "../lib/fileTypeRegistry";

export function DocumentFileGlyph({
  fileType,
  path,
  className = "",
}: {
  fileType?: string | null;
  path?: string;
  className?: string;
}) {
  const resolvedType = fileType ?? (path ? getFileTypeDefinitionByPath(path)?.type : undefined);
  const badge = resolvedType === "ideasketch" ? "IS" : resolvedType === "markdown" ? "MD" : "?";
  const tone = resolvedType === "ideasketch" ? "blue" : resolvedType === "markdown" ? "slate" : "muted";

  return (
    <span className={`ideanote-file-glyph is-${tone} ${className}`.trim()} aria-hidden="true">
      {badge === "IS" ? <>IS</> : badge === "MD" ? <>MD</> : <>?</>}
    </span>
  );
}
