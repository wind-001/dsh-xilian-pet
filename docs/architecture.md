# 架构详解

## 三层职责

| 层 | 组件 | 关键点 |
|----|------|--------|
| ① 插件（大脑） | 动态 Cordis 插件（Host + Client 双半身） | Host 在 harness 进程内：事件状态机、todo 读取、文件导出、看门狗、RPC；Client 在浏览器：`shell.overlay` 渲染宠物 UI |
| ② 桌面应用（显示器） | Electron 独立进程（`pets/xilian/electron/`） | 无边框透明置顶窗口；只读共享文件，不依赖 harness；插件更新/重启不影响它 |
| ③ 共享文件（桥梁） | `pets/xilian/` 目录 | 状态与偏好通过文件传递，双端解耦 |

## 文件桥协议

| 文件 | 写入方 | 读取方 | 内容 |
|------|--------|--------|------|
| `web/sprite.b64` + `manifest.json` | tools/build_sprite.py | 插件 / 桌面版 | 精灵图与动画清单 |
| `task.json` | 插件 Host（状态变化时） | 桌面版（2s 轮询） | `{mode, phase, pct, toolName, toolArgs, message, todoText, at}` |
| `state.json` | 插件 / 桌面版 | 双方 | `{x, y, anim, hidden, scale, notify, webClosed}`（偏好双向同步） |
| `desktop_alive.json` | 桌面版（5s 心跳，退出删除） | 插件看门狗 / 网页版 | `{at}` 时间戳 |
| `debug.log` | 插件 | 排障 | `[task]` 状态机 / `[pet]` 看门狗 / `[rpc]` 心跳 |

## 任务状态机（Host 侧，事件驱动）

```
session/event: tool/call · tool/result · step/start · assistant/message · todo/write
agent/status: running ⇄ idle
approval/request: 需要用户决定
agent/inbox/claimed: 用户已回复

tool/call/result ──► RUNNING ──10s 无事件 + agent 忙──► DEGRADED 🤔
      │                   │
      │                   └──10s 无事件 + agent 闲──► REVIEW ✅（有最终回复）/ IDLE
      ▼
approval/request ──► WAITING ❗（最高优先级，置顶闪烁）
      └── inbox/claimed ──► RUNNING
```

- 运行态三阶段进度：由 todo 完成率映射（0-30% 🧠 / 30-70% ✍️ / 70-99% 🔧）。
- 每个状态变化写一次 `task.json`（内存缓存 + 队列串行写盘，开销极小）。

## 单实例协调（看门狗）

插件 Host 每 5 秒检查：

```
desktopAlive = desktop_alive.json 心跳新鲜（<15s）
clientAlive  = 网页客户端最近 15s 内有 RPC 心跳
webClosed    = state.json 中用户手动关闭了网页版

需要宠物 = !desktopAlive && (!clientAlive || webClosed)
→ 满足则 subprocess.spawn 拉起 Electron（60s 冷却；用户"关页后退出桌面版"有 10 分钟宽限）
```

网页版每 5 秒轮询 `desktop-alive` RPC：桌面版在线 → 渲染 null（隐身）；离线 → 回归。

## RPC 接口（插件 Host ↔ Client）

| 方法 | 方向 | 说明 |
|------|------|------|
| `get-sprite` / `retry-sprite` | C→H | 精灵图（1x/2x，带错误回传） |
| `load-state` / `save-state` | C→H | 偏好读写 |
| `get-task` | C→H | 任务状态快照（1s 轮询） |
| `desktop-alive` | C→H | 桌面版心跳 + webClosed |
| `web-close` | C→H | 手动关闭网页版（写 webClosed） |

## 动画行映射

| 状态 | 行 | 含义 |
|------|----|------|
| idle | 0 | 待机呼吸 |
| running（低/高负载） | 1 / 2 | 行走 / 奔跑 |
| waiting | 4 | 微动（等待） |
| review / celebrate | 6 | 翅膀扇动（庆祝） |
| degraded | 8 | 低头（遇阻） |
| 拖拽中 | 1 / 2 + 镜像 | 慢走 / 快跑 + 左拖翻转 |
