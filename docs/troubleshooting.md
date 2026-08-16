# 排障手册（踩坑实录）

## 1. 网页版刷新后消失

- **原因**：harness 机制限制——动态插件 Client 端代码只在运行激活时投递，页面 F5 不重新投递（已用 RPC 日志坐实；Host 事件目录无页面连接钩子）。
- **现象**：刷新后网页里没有宠物；桌面版若未运行则暂时无宠物。
- **应对**：
  - 看门狗（若配置了 `desktopAppDir`）会在客户端沉默 15~30 秒后**自动拉起桌面版**；
  - 只要网页版：让 AI 用 `cordis_run`（mode `run`）重新激活当前包，5 秒内回归，状态从 `state.json` 恢复。

## 2. 看门狗不拉起桌面版

- 检查 `debug.log` 的 `[pet]` 行：
  - `desktop app not configured` → `CONFIG.desktopAppDir` 未填；
  - `spawn failed: ... graceMs ...` → spawn spec 缺少 `graceMs`（代码已带，勿删）；
  - `no subprocess service` → 运行环境未提供 subprocess 服务（正常 harness 都有）。
- 检查条件：页面开着且未手动关闭网页版时（clientAlive=true）**不会**拉起——这是设计行为。

## 3. 中文路径乱码（Windows）

- harness 的 `sandboxPolicy.workspaceRoot` 对含中文的路径可能返回乱码（如 `刘康鑫` → 乱码）。
- **务必**在 `host.js` 的 `CONFIG.workspaceRoot` 显式填写绝对路径；候选路径按 `workspaceRoot → sandbox 根 → 相对路径` 依次尝试。

## 4. 宠物身体不可见（历史 bug）

- 症状：只有头顶徽章/气泡，身体 0×0。
- 原因（已修）：`res` 是字符串 `'1x'/'2x'`，直接参与除法得到 `NaN`，CSS 尺寸全非法。
- 规则：**`res` 做除法前必须转数字**（`res === '2x' ? 2 : 1`），并对尺寸做 `Number.isFinite` 兜底。

## 5. 无法拖拽宠物

- 历史原因（已修）：重构 Client 时误删了「拖拽监听 effect」与「帧动画 effect」。
- 排查法：检查 Client 代码里是否存在 `window.addEventListener('mousemove', ...)` 的 effect 和推进 `frame` 的 interval；两者缺一不可。

## 6. 气泡/徽章位置偏移（历史 bug）

- 原因（已修）：容器所有子元素绝对定位导致容器宽度为 0，`left: 50%` 基准错误。
- 规则：容器需显式 `width/height = 宠物尺寸`，百分比定位才有正确基准。

## 7. 桌面版"点不到"或"到处误触"

- 已实现**点击穿透**：`setIgnoreMouseEvents(true, {forward: true})`，仅光标悬停身体时恢复交互。
- 若仍误触：检查渲染进程的悬停判定（`syncIgnore`）是否在拖动中被跳过（拖动中必须保持交互）。

## 8. 进度播报不更新

- 宠物显示的是**最后一次 `todo/write`** 的内容——先确认任务清单真的更新了（用 `todo_write`）。
- 数据链路：`session/event` 监听 todo/write → 内存缓存 → `get-task`/`task.json`。日志 `[todo] live update` 可确认事件是否到达。
- todo 数据**不在** `sessionProjections` 里（返回空）；正确读法是事件监听 + `sessionQuery.readSession(sid)` 种子扫描（会话 ID 在 `SessionRecord.header.id`）。

## 9. 状态文件被写乱 / 字段丢失

- `state.json` 由插件与桌面版共同读写：**合并写入**（读旧值 → 改字段 → 整文件写回），不要整体覆盖未知字段。
- 插件 `saveState` 必须保留 `webClosed` 等非插件字段。

## 10. 通知不弹

- 网页版：需用户授权浏览器通知权限（面板「🔔 系统提醒」首次开启时请求）。
- 桌面版：仅在**窗口未聚焦**时弹（`win.isFocused()` 检查）；通知图标需 `web/icon.png`（build_sprite.py 已生成）。
