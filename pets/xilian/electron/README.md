# 桌面宠物应用（Electron）

无边框、透明、始终置顶的桌面宠物窗口；与网页插件共用 `pets/xilian/` 资产与状态文件。

## 文件

- `main.js` — 主进程：透明置顶窗口、位置记忆（`bounds.json`）、心跳（5s 写 `desktop_alive.json`）、
  原生通知（窗口未聚焦时）、点击穿透（`setIgnoreMouseEvents`）、右键菜单、拖拽 IPC。
- `preload.js` — 安全桥（contextIsolation）。
- `index.html` / `renderer.js` — 宠物动画 + 任务气泡（2s 读 `task.json`）+ JS 拖拽走跑镜像 + 点击看指令。
- `config.json` —（可选）覆盖资产根目录：`{"assetRoot": "C:/path/to/pets/xilian"}`；
  缺省时默认资产根 = 本目录上一级（仓库布局 `pets/xilian/`）。

## 安装与运行

```bash
npm install electron --save-dev --cache ./.npm-cache   # 首次；缓存留在本目录
npm start
```

## 交互

| 操作 | 行为 |
|------|------|
| 拖动 | 移动窗口（慢走/快跑动画 + 左拖镜像） |
| 单击 | 显示当前底层指令 / 等待原因 / 完成提示 |
| 双击 | 退出 |
| 右键 | 菜单：切动画 / 恢复任务动画 / 气泡开关 / 系统通知开关 / 大小± / 退出 |
| 悬停 | 只有光标在身体上才响应（透明区点击穿透） |

## 与插件的关系

- 数据：读 `../web/`（精灵图）、`../state.json`（scale/notify 双向同步）、`../task.json`（任务状态）；
  写 `desktop_alive.json`（心跳）并在退出时删除 + 清除 `state.json` 的 `webClosed`。
- 独立性：**不依赖插件进程**，插件更新/重启不影响它；也可完全脱离插件单独运行（作为静态宠物）。
