# 定制指南

## 一、更换宠物精灵图

1. 准备一张 **透明背景 PNG/WebP** 精灵图：8 列 × 9 行网格，每格 192×208（若不同，用 `--grid`/`--cell` 调整）。
2. 放到 `assets/` 下（如 `assets/spritesheet.webp`）。
3. 重新生成资产：
   ```bash
   python pets/xilian/tools/build_sprite.py assets/spritesheet.webp pets/xilian/web pets/xilian/web_manifest_template.json
   ```
4. 重启插件（重新激活）与桌面应用，新形象生效。

### 动作行含义（9 行建议按此编排）

| 行 | 建议动作 | 帧数 | 状态映射 |
|----|---------|------|---------|
| 0 | 待机呼吸 | 6 | idle |
| 1 | 向右行走 | 8 | running 低负载 / 拖拽慢 |
| 2 | 向右奔跑 | 8 | running 高负载 / 拖拽快 |
| 3 | 眨眼待机 | 4 | （备用） |
| 4 | 微动/跺脚 | 5 | **waiting** |
| 5 | 闭眼平静 | 8 | （备用） |
| 6 | 庆祝/翅膀扇动 | 6 | **review** / 完成庆祝 |
| 7 | 行走变体 | 6 | （备用） |
| 8 | 低头/忧伤 | 6 | **degraded** |

> 行号与状态映射写在 `client.js` / 桌面版 `renderer.js` 的 `taskRowOf`（网页）与 `rowOf`（桌面）中，可自行调整。

## 二、修改角色名与设定

编辑 `pets/xilian/web_manifest_template.json` 的 `identity`：

```json
"identity": {
  "id": "pet",
  "displayName": "桌宠",
  "description": "我的桌面宠物..."
}
```

重新 build 后生效（displayName 显示在徽章/面板/通知标题）。

## 三、修改气泡文案

- 状态文案集中在两处（保持一致）：
  - 网页版：`plugin/client.js` 的 `taskBubbleText` 与轮询里的 `phaseText`；
  - 桌面版：`electron/renderer.js` 的 `textOf`。
- 可自定义：🧠 思考 / ✍️ 编码 / 🔧 自检 / 💤 等待 / ❗ 等待决定 / 🤔 遇阻 / ✅ 完成。

## 四、调整交互细节

| 想改什么 | 在哪改 |
|---------|--------|
| 拖拽走跑阈值（14px/40px） | 网页 `client.js` 的 `dist > 14`；桌面 `renderer.js` 的 `moved > 40` |
| 动画帧率 | 网页 `frameInterval`（75/90/140ms）；桌面 `setInterval(..., 120)` |
| 气泡停留时长 | 网页 `20000`；桌面 `showBubble` 的 `20000` |
| 状态轮询间隔 | 网页 `check` 的 `ctx.interval(..., 1000)`；桌面 `refresh` 的 `setInterval(..., 2000)` |
| 降级阈值（10s） | `host.js` 的 `armWatchdog` 中 `10000` |
| 看门狗节奏 | `host.js` 的 `petWatchdog` 间隔与 `clientAlive` 窗口（15000） |

## 五、Agent 预设公约（可选，让所有会话自动带宠物）

`preset/persona-section.md` 提供了一段可直接追加到 Agent 预设 persona 的公约文本：
- 会话启动时若工作区存在 `pets/xilian/plugin/*.js` → 自动注册激活宠物；
- 工作期间用 `todo_write` 维护任务清单（宠物播报数据源）；
- 刷新消失时重新激活的规则。

部署方式：复制你部署的 `standard` 预设 → 用户预设目录（如 `~/.dsh/.agent-presets/`），把该段追加进 `agent.cordis.yml` 的 persona 文本，并写 `preset.yml` 元数据；再将该预设设为默认。
