# IdeaSlide 幻灯片放映功能设计文档

**日期**: 2026-03-12
**状态**: 已批准
**实现方案**: 一次性完整实现

## 概述

为 IdeaSlide 添加幻灯片放映功能，支持预览模式和全屏放映两种模式，提供键盘导航和缩略图快速跳转功能。

## 需求总结

### 功能需求

1. **两种放映模式**
   - **预览模式**: 在当前窗口内全屏显示，隐藏工具栏和侧边栏
   - **全屏放映**: 使用 Tauri 原生全屏 API，真正的系统级全屏

2. **导航方式**
   - **键盘导航**: 方向键、空格、Backspace、Home、End、Esc
   - **缩略图导航**: 按 Tab 或 g 键显示所有幻灯片缩略图，点击跳转

3. **Excalidraw 处理**
   - 使用 `viewModeEnabled` 属性启用只读视图模式
   - 禁用编辑功能，但保留缩放和平移能力

4. **触发方式**
   - 工具栏按钮（带下拉菜单）
   - 预览面板顶部快捷按钮

5. **全屏实现**
   - 使用 Tauri 的 `appWindow.setFullscreen(true)` API
   - 跨平台一致的系统级全屏体验

## 架构设计

### 整体架构

```
App.tsx
├── LaunchScreen (文件选择)
├── EditorLayout (编辑模式)
└── PresentationMode (新增 - 放映模式)
    ├── PreviewPresentation (预览模式组件)
    ├── FullscreenPresentation (全屏放映组件)
    └── ThumbnailNavigator (缩略图导航)
```

### 设计决策

- **独立组件**: `PresentationMode` 与 `EditorLayout` 平级，在 `App.tsx` 中切换
- **共享逻辑**: 预览和全屏模式共享大部分逻辑，只是容器和样式不同
- **状态隔离**: 放映模式的当前页码独立管理，不影响编辑模式的 `currentSlideIndex`

### 状态管理

在 `useSlideStore` 中添加：

```typescript
interface SlideStoreState extends Presentation {
  presentationMode: 'none' | 'preview' | 'fullscreen';
}

type SlideStoreAction =
  | // ... 现有 actions
  | {
      type: 'START_PRESENTATION';
      payload: { mode: 'preview' | 'fullscreen' }
    }
  | { type: 'EXIT_PRESENTATION' }
```

**注意**: `presentationStartIndex` 不需要存储在全局 store 中，作为 `PresentationMode` 组件的 props 传入即可。

## 组件设计

### 1. PresentationMode 组件

**职责**:
- 根据 `presentationMode` 状态渲染预览或全屏组件
- 管理放映时的当前幻灯片索引（独立于编辑模式）
- 处理键盘事件（方向键、空格、Esc）
- 提供缩略图导航的显示/隐藏逻辑

**Props**:
```typescript
interface PresentationModeProps {
  slides: Slide[];
  startIndex: number;
  mode: 'preview' | 'fullscreen';
  onExit: () => void;
}
```

**内部状态**:
- `currentIndex: number` - 当前显示的幻灯片索引
- `showThumbnails: boolean` - 是否显示缩略图导航

### 2. PreviewPresentation 组件

**实现细节**:
- 在当前窗口内全屏显示（CSS `position: fixed; inset: 0`）
- 背景色: `#1a1a1a`
- 渲染 Excalidraw 组件，启用 `viewModeEnabled`
- 显示页码指示器（如 "3 / 10"）在右下角
- 按 Tab 键显示缩略图导航浮层

### 3. FullscreenPresentation 组件

**实现细节**:
- 组件挂载时调用 `setFullscreen(true)`
- 组件卸载时调用 `setFullscreen(false)`
- 其他渲染逻辑与 `PreviewPresentation` 相同
- 使用 `useEffect` 的 cleanup 函数确保退出时恢复窗口状态

### 4. ThumbnailNavigator 组件

**实现细节**:
- 半透明黑色背景遮罩: `rgba(0, 0, 0, 0.85)`
- 网格布局: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); max-width: 1400px`
- 复用现有的 `useSlideThumbnails` hook
- 当前幻灯片高亮显示（蓝色边框）
- 点击缩略图跳转并关闭浮层
- 按 Esc 或 Tab 关闭
- **内存管理**: 缩略图导航关闭时不销毁已生成的缩略图，依赖 `useSlideThumbnails` 的缓存机制

### 5. 复用 SlideCanvas 组件

**不创建新的 SlideRenderer 组件**，而是扩展现有的 `SlideCanvas` 组件：

**添加 Props**:
```typescript
interface SlideCanvasProps {
  // ... 现有 props
  viewMode?: boolean; // 新增：是否为只读视图模式
}
```

**在放映模式下的 Excalidraw 配置**:
```typescript
<Excalidraw
  initialData={{
    elements: slide.elements,
    appState: {
      ...slide.appState,
      viewModeEnabled: viewMode,
      zenModeEnabled: viewMode,
    },
    collaborators: new Map(), // 必须初始化，避免 forEach 错误
    scrollToContent: true,
  }}
  UIOptions={{
    canvasActions: {
      loadScene: false,
      export: false,
      saveAsImage: false,
    },
  }}
/>
```

**注意**: 保持与现有 `SlideCanvas` 的一致性，不引入 `gridSize: null` 等未经验证的配置。

## 交互设计

### 键盘导航

**键位映射**:
- `ArrowRight`, `ArrowDown`, `Space`, `Enter` → 下一张
- `ArrowLeft`, `ArrowUp`, `Backspace` → 上一张
- `Home` → 第一张
- `End` → 最后一张
- `Escape` → 退出放映
- `Tab` 或 `g` → 切换缩略图导航显示/隐藏

**边界处理**:
- 在第一张时按"上一张"键 → 无操作
- 在最后一张时按"下一张"键 → 无操作

**实现方式**:
- 在 `PresentationMode` 组件中使用 `useEffect` 监听 `keydown` 事件
- 使用事件捕获阶段 (`addEventListener` 的第三个参数为 `true`)
- 防止 Excalidraw 捕获某些键盘事件

### 缩略图导航交互

**显示逻辑**:
- 按 Tab 或 g 键显示缩略图网格
- 显示时背景半透明遮罩，缩略图居中显示
- 当前幻灯片高亮显示（蓝色边框: `#3b82f6`）

**操作**:
- 点击缩略图 → 跳转到该页并关闭缩略图视图
- 按 Esc 或再次按 Tab → 关闭缩略图视图
- 缩略图视图打开时，方向键仍然可以切换幻灯片（实时更新高亮）

### 触发放映

**工具栏按钮**:
- 在 `Toolbar` 组件添加"放映"按钮（图标：播放三角形 ▶）
- 点击显示下拉菜单：
  - "预览模式" → 从当前幻灯片开始预览
  - "全屏放映" → 从当前幻灯片开始全屏
  - "从头放映" → 从第一张开始全屏

**预览面板按钮**:
- 在 `SlidePreviewPanel` 顶部添加小的播放图标按钮
- 点击 → 从当前幻灯片开始全屏放映
- 悬停显示 tooltip："放映幻灯片"

## Tauri 全屏集成

### 使用 Tauri v2 内置 API

**不需要创建自定义 Rust 命令**。Tauri v2 已经在前端提供了全屏 API：

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

// 进入全屏
await getCurrentWindow().setFullscreen(true);

// 退出全屏
await getCurrentWindow().setFullscreen(false);
```

### 全屏状态管理流程

**进入全屏**:
1. 用户点击"全屏放映"
2. 更新 store: `dispatch({ type: 'START_PRESENTATION', payload: { mode: 'fullscreen' } })`
3. `App.tsx` 检测到 `presentationMode === 'fullscreen'`，渲染 `FullscreenPresentation`
4. `FullscreenPresentation` 组件挂载时调用 `getCurrentWindow().setFullscreen(true)`

**退出全屏**:
1. 用户按 Esc 或点击退出按钮
2. `FullscreenPresentation` 组件卸载前调用 `getCurrentWindow().setFullscreen(false)`
3. 更新 store: `dispatch({ type: 'EXIT_PRESENTATION' })`
4. `App.tsx` 切换回 `EditorLayout`

**错误处理**:
```typescript
try {
  await getCurrentWindow().setFullscreen(true);
} catch (error) {
  console.error('Failed to enter fullscreen:', error);
  // 显示 toast 提示但继续放映
}
```

## 视觉设计

### 放映模式样式

**背景和容器**:
- 深色背景: `#1a1a1a`
- 幻灯片内容居中: `display: flex; align-items: center; justify-content: center`
- 保持 Excalidraw 画布的原始比例

**页码指示器**:
- 位置: 右下角，距离边缘 24px
- 样式: 半透明白色背景 `rgba(255, 255, 255, 0.1)`
- 内容: `"3 / 10"` 格式
- 字体: `font-size: 14px; font-weight: 500`
- 圆角: `border-radius: 8px; padding: 8px 16px`

**缩略图导航浮层**:
- 遮罩: `background: rgba(0, 0, 0, 0.85)`
- 网格布局: `display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px`
- 缩略图卡片:
  - 默认边框: `border: 2px solid transparent`
  - 当前幻灯片: `border-color: #3b82f6`（蓝色高亮）
  - 悬停效果: `border-color: rgba(255, 255, 255, 0.3)`
  - 阴影: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)`
- 页码标签: 显示在缩略图左上角

**工具栏按钮**:
- 播放图标（▶）+ "放映" 文字
- 使用 Lucide React 的 `Play` 组件
- 下拉菜单使用 Tailwind 样式

**预览面板按钮**:
- 小型播放图标按钮，尺寸: `32x32px`
- 放在预览面板标题栏右侧
- 悬停时显示 tooltip

## 错误处理

### 错误处理策略

**Tauri 全屏 API 失败**:
- 捕获 `setFullscreen()` 异常
- 显示 toast 提示: "无法进入全屏模式，但放映功能仍可使用"
- 降级到非全屏的放映视图

**Excalidraw 渲染失败**:
- 使用 `ErrorBoundary` 包裹每个幻灯片的渲染
- 失败时显示占位符: "此幻灯片无法显示"
- 允许继续导航到其他幻灯片

**缩略图生成失败**:
- 复用现有的 `useSlideThumbnails` hook
- 如果某个缩略图生成失败，显示灰色占位符
- 不阻塞缩略图导航的显示

### 边界情况处理

**空演示文稿**:
- 如果 `slides.length === 0`，禁用放映按钮
- 按钮显示为灰色不可点击状态

**单张幻灯片**:
- 导航键仍然响应，但不切换页面
- 页码显示 "1 / 1"
- 缩略图导航仍然可以打开

**放映过程中编辑数据变化**:
- 放映模式通过 props 接收 `slides` 数组
- 使用 `slides` 的引用，不创建深拷贝
- 退出放映后回到编辑模式，看到最新数据

**窗口失焦/最小化**:
- 全屏模式下窗口失焦不自动退出
- 用户需要手动按 Esc 退出
- 异常退出时，`useEffect` cleanup 函数会恢复窗口状态

**多显示器场景**:
- Tauri 的 `setFullscreen` 会在当前显示器全屏
- 不特殊处理多显示器（未来可扩展）

## 无障碍访问

### 键盘焦点管理

**进入放映模式**:
- 放映容器自动获得焦点（`tabIndex={0}` 和 `autoFocus`）
- 确保键盘事件能被正确捕获

**缩略图导航**:
- 打开时焦点移到缩略图网格容器
- 支持 Tab 键在缩略图间导航
- 当前幻灯片的缩略图自动获得焦点

**退出放映**:
- 焦点返回到触发放映的按钮（工具栏或预览面板）

### ARIA 标签

```typescript
// 放映容器
<div role="application" aria-label="幻灯片放映模式">

// 页码指示器
<div role="status" aria-live="polite" aria-label={`第 ${current} 张，共 ${total} 张`}>

// 缩略图导航
<div role="dialog" aria-label="幻灯片导航">
  <button role="button" aria-label={`跳转到第 ${index + 1} 张幻灯片`}>
```

### 屏幕阅读器支持

- 切换幻灯片时通过 `aria-live` 区域通知页码变化
- 缩略图按钮包含清晰的 `aria-label`
- 键盘快捷键在帮助文档中说明

## 动画和过渡

### 幻灯片切换动画

**默认无动画**:
- 直接切换幻灯片内容，无过渡效果
- 保持简洁，避免干扰内容

**未来扩展**:
- 可选的淡入淡出效果（`opacity` 过渡）
- 配置项：`transitionType: 'none' | 'fade'`
- 过渡时长：300ms

### 缩略图导航动画

**打开/关闭**:
- 遮罩淡入淡出：`transition: opacity 200ms ease-in-out`
- 网格容器缩放：`transition: transform 200ms ease-in-out; transform: scale(0.95) → scale(1)`

**悬停效果**:
- 缩略图边框颜色过渡：`transition: border-color 150ms ease`

## 性能优化

**缩略图懒加载**:
- 缩略图导航打开时才渲染缩略图网格
- 使用现有的 `useSlideThumbnails` 缓存机制
- 缩略图关闭后不销毁已生成的缩略图，保留在内存中

**Excalidraw 实例管理**:
- 每次切换幻灯片时使用 `key={slideId}` 强制重新挂载
- 这是现有 `SlideCanvas` 的行为，保持一致
- 避免复杂的状态同步问题

**键盘事件节流**:
- 使用状态标志防止快速连续切换
- 切换动画进行中时忽略新的导航键
- 避免 Excalidraw 重复挂载导致的卡顿

**内存管理**:
- 放映模式退出时，缩略图缓存保留（由 `useSlideThumbnails` 管理）
- Excalidraw 实例在组件卸载时自动清理
- 不需要手动管理内存释放

**性能目标**:
- 幻灯片切换延迟 < 300ms（包括 Excalidraw 重新挂载）
- 缩略图导航打开延迟 < 500ms
- 50+ 张幻灯片的放映流畅度：60fps

## 测试策略

### 手动测试清单

**基本功能测试**:
- [ ] 从工具栏启动预览模式
- [ ] 从工具栏启动全屏放映
- [ ] 从预览面板按钮启动全屏放映
- [ ] 键盘导航: 方向键、空格、Backspace
- [ ] 按 Esc 退出放映
- [ ] 按 Tab 显示/隐藏缩略图导航
- [ ] 点击缩略图跳转到指定页

**边界情况测试**:
- [ ] 空演示文稿时放映按钮禁用
- [ ] 单张幻灯片的导航行为
- [ ] 第一张/最后一张的边界导航
- [ ] 从中间幻灯片开始放映
- [ ] 放映过程中按 Home/End 键

**Excalidraw 集成测试**:
- [ ] 放映模式下 Excalidraw 工具栏隐藏
- [ ] viewModeEnabled 生效（无法编辑）
- [ ] 可以缩放和平移画布
- [ ] 复杂幻灯片（大量元素）渲染正常

**跨平台测试**:
- [ ] macOS 全屏功能
- [ ] Windows 全屏功能
- [ ] Linux 全屏功能（如果支持）

**无障碍访问测试**:
- [ ] 键盘焦点管理正确
- [ ] ARIA 标签被屏幕阅读器正确读取
- [ ] Tab 键可以在缩略图间导航
- [ ] 页码变化通过 aria-live 通知

**性能测试**:
- [ ] 50+ 张幻灯片的放映流畅度（目标：60fps）
- [ ] 缩略图导航打开延迟 < 500ms
- [ ] 幻灯片切换延迟 < 300ms
- [ ] 快速切换幻灯片无卡顿

### 潜在问题预判

**Excalidraw viewModeEnabled 兼容性**:
- 问题: 需要验证 Excalidraw 0.18 是否完全支持 `viewModeEnabled`
- 解决: 在实现前先测试该属性的行为

**全屏 API 兼容性**:
- 问题: 某些 Linux 桌面环境可能不支持
- 解决: 已有降级方案（非全屏放映视图）

**键盘事件冲突**:
- 问题: 即使 `viewModeEnabled={true}`，Excalidraw 可能仍捕获某些键
- 解决: 在放映容器层面监听，使用事件捕获阶段

**内存泄漏风险**:
- 问题: 频繁挂载/卸载 Excalidraw 实例可能导致内存泄漏
- 解决: 在开发过程中使用 Chrome DevTools 监控内存使用

## 实现顺序

建议按以下顺序实现：

1. **状态管理扩展** - 修改 `useSlideStore`，添加 `presentationMode` 状态
2. **扩展 SlideCanvas** - 添加 `viewMode` prop，支持只读视图
3. **PresentationMode 核心组件** - 键盘导航和状态管理
4. **PreviewPresentation 组件** - 预览模式实现
5. **FullscreenPresentation 组件** - 全屏放映实现（使用 Tauri API）
6. **ThumbnailNavigator 组件** - 缩略图导航
7. **UI 触发按钮** - 工具栏和预览面板按钮
8. **App.tsx 路由集成** - 连接所有组件
9. **无障碍访问** - 添加 ARIA 标签和焦点管理
10. **样式优化和测试** - 视觉调整和功能测试

## 未来扩展

可能的功能扩展方向：

- **演讲者备注**: 在预览面板显示备注，全屏时在第二显示器显示
- **激光笔/标注**: 放映时临时标注和高亮
- **自动播放**: 设置每张幻灯片的停留时间，自动切换
- **录制功能**: 录制放映过程为视频
- **远程控制**: 使用手机作为遥控器
- **多显示器支持**: 演讲者视图和观众视图分离

## 总结

本设计提供了完整的幻灯片放映功能，包括预览模式和全屏放映两种模式，支持键盘导航和缩略图快速跳转。设计充分考虑了 Excalidraw 集成、Tauri 桌面应用特性、错误处理和性能优化，为用户提供专业的演示体验。
