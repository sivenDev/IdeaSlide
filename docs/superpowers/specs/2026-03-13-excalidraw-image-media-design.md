# IdeaSlide Excalidraw 图片插入与 `.is` 媒体存储设计

**日期**: 2026-03-13
**状态**: 已批准（待实现）
**范围**: 为编辑器增加图片插入与持久化能力，采用 `media/` 目录存储二进制媒体

## 1. 目标与边界

### 目标
- 支持 Excalidraw 自带图片插入入口与粘贴图片文件。
- 图片随 `.is` 保存并可稳定重开与继续编辑。
- 二进制媒体落盘到 zip 的 `media/`，不内嵌到 `slides/*.json`。

### 非目标（首版）
- 不做拖拽文件到画布。
- 不做图片压缩/转码。
- 不做云端同步与增量协议。

## 2. 方案选择

采用 **方案 B：规范化媒体层**。

- `slides/{id}.json` 保存 Excalidraw scene（`elements/appState/files`）。
- `media/` 保存原始媒体 bytes。
- 前端负责 `Excalidraw files <-> IPC media[]` 双向转换。

## 3. 数据模型

### 3.1 前端内存模型

扩展 `Slide`：
- 现有：`id`, `elements`, `appState`
- 新增：`files`

`files` 首版可用 `Record<string, any>`，但实现必须满足 Excalidraw 当前版本最小字段契约：
- `id`（与 fileId 一致）
- `mimeType`
- 图片内容字段（按 Excalidraw 0.18 运行时要求回填）

备注：实现时以 Excalidraw 0.18 实际 API/类型为准，若字段不满足则不得宣称完成。

### 3.2 IPC 模型（TypeScript <-> Rust）

扩展 `IsFileData`：
- `manifest`
- `slides`
- `media: Array<{ id: string; mimeType: string; ext: string; bytesBase64: string }>`

新增 `media/index.json`（zip 内权威索引）：
- 内容：`Array<{ id: string; mimeType: string; ext: string; path: string }>`
- 目的：避免仅靠文件名反推 `id/ext` 造成歧义。

### 3.3 Zip 存储与安全规则

zip 内容：
- `manifest.json`
- `slides/{slideId}.json`
- `media/index.json`
- `media/{id}.{ext}`
- `thumbnails/`

路径安全规则（必须前后端一致）：
- `id` 仅允许 `[A-Za-z0-9_-]+`（推荐 UUID）。
- `ext` 仅允许白名单映射：`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`。
- 禁止路径分隔符与 `..`。
- Rust 写盘前二次校验，不合法直接返回错误。

## 4. 读写流程

### 4.1 保存流程（前端）

1. `SlideCanvas` 回调上抛 `elements + appState + files`。
2. 状态层更新 slide 三元数据并标记 dirty（详见第 6 节）。
3. 计算 `usedFileIds`：
   - 以所有 slides 中 `elements` 里 `type === "image"` 的 `fileId` 并集为准。
   - `files` 仅作为元信息与二进制来源，不作为“是否被引用”的唯一依据。
4. 从 `files` 中提取 `usedFileIds` 对应条目，按 fileId 去重，生成 `media[]`。
5. 同步裁剪各 slide 的 `content.files`（移除未引用条目）。
6. 生成 `IsFileData(manifest, slides, media)` 调用 `save_file`。

### 4.2 写盘流程（Rust）

1. 写 `manifest.json`。
2. 写 `slides/{id}.json`。
3. 生成并写 `media/index.json`。
4. 遍历 `media[]`：base64 解码写 `media/{id}.{ext}`。
5. 保持原子写：`.is.tmp` + rename。

### 4.3 打开流程（Rust + 前端）

1. Rust 读取 manifest/slides。
2. 读取 `media/index.json`；若缺失则回退扫描 `media/`（兼容旧文件）。
3. 组装 `media[]` 返回前端。
4. 前端按 `id` 回填 Excalidraw `files`，并传入 `SlideCanvas.initialData.files`。

兼容策略：
- 旧 `.is` 无 `media/`：按空媒体处理。
- `content.files` 缺失：按 `{}` 处理。
- 引用缺失媒体：该图片降级为失效占位，文档整体可编辑。

## 5. 错误处理

- 保存时 `id/ext` 非法：直接失败并提示“媒体路径不合法”。
- 保存时 base64 非法：失败并提示“媒体数据损坏，请重新插入图片”。
- 打开时单媒体解码失败：记录日志并跳过，不阻塞其余内容。
- 自动保存失败：保持 dirty，不覆盖成功状态；手动保存弹窗提示。

## 6. 性能与 dirty 判定

### 6.1 已知风险

- 自动保存为 2s debounce 且全量写包，媒体大时会产生明显开销。
- IPC 使用 JSON/base64，存在编码/内存成本。

### 6.2 首版防护

- 按 `fileId` 去重。
- 仅打包 `usedFileIds` 媒体。
- “媒体不变短路”仅用于前端转换层：
  - 比较键：`usedFileIds` + 每个媒体条目 `(id,mimeType,size)`。
  - 命中时跳过重复编码，但仍执行后端全量写包流程。
- 软限制阈值：
  - 单图 > 10MB：提示。
  - 总媒体 > 100MB：提示。
  - 提示不阻止保存，但需明确告知自动保存可能变慢。

### 6.3 dirty 规则（必须实现）

任一条件成立即 dirty：
- `elementsFingerprint` 变化。
- `filesFingerprint` 变化。

`filesFingerprint` 计算基准：按 `fileId` 排序后拼接 `(id,mimeType,size)`。

## 7. 变更清单（按文件）

前端：
- `src/types.ts`：`Slide` 增加 `files`。
- `src/components/SlideCanvas.tsx`：注入 `initialData.files`，`onChange` 上抛 `files`。
- `src/hooks/useSlideStore.tsx`：`UPDATE_SLIDE` 保存 `files`，dirty 纳入 `filesFingerprint`。
- `src/components/EditorLayout.tsx`：`handleSlideChange` 接收 `files`，更新指纹判定。
- `src/lib/tauriCommands.ts`：实现 `files <-> media[]`、`usedFileIds` 过滤、软限制提示。

后端：
- `src-tauri/src/file_format.rs`：扩展 `IsFileData.media`，新增 `media/index.json` 读写，增加 `id/ext` 校验。
- `src-tauri/src/commands.rs`：同步类型扩展。
- `src-tauri/src/lib.rs`：如有签名影响做最小同步。

## 8. 测试

### 8.1 手动测试

1. 插入单图 -> 保存 -> 重开 -> 再编辑 -> 再保存，图片保持正常。
2. 同图跨多页复用，`media/` 中仅一份。
3. 粘贴图片文件后自动保存，重开不丢图。
4. 删除含图元素并保存，未引用媒体不再写入。
5. 旧 `.is`（无 `media/`）可打开并再保存。
6. 构造损坏单媒体，验证“局部降级、整体可用”。
7. 超阈值图片触发提示（10MB/100MB）。

### 8.2 Rust 自动化测试（新增）

- `roundtrip_with_media`：含媒体的写入/读取一致性。
- `compat_without_media_dir`：旧格式兼容。
- `skip_corrupted_single_media`：单媒体损坏时整体可读。
- `reject_illegal_media_id_or_ext`：路径安全规则生效。

## 9. 实施顺序

1. 扩展 `Slide/files` 与状态流。
2. 完成 `tauriCommands` 转换层。
3. 扩展 Rust `file_format` 的 `media/index.json` + `media/` 读写。
4. 联调保存/打开与自动保存。
5. 执行手测 + Rust 单测并修正。

## 10. 验收标准

满足以下全部条件即通过：
- 图片可插入、保存、重开、再编辑、再保存。
- 媒体二进制位于 `media/`，不内嵌 JSON 大块。
- `usedFileIds` 规则生效（无未引用媒体残留）。
- 旧文件兼容。
- 单媒体故障不导致整文件不可用。
- 路径安全校验生效。
- 阈值提示可触发且文案明确。