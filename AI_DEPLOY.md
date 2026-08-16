# 🤖 AI 部署提示词（给任何 AI 助手直接粘贴使用）

> 把下面整段复制给 Claude / Codex / DSH 等任何 AI 助手，它就能帮你完成部署。
> 前提：本机已安装 Node.js ≥ 18（桌面版需要）、Python 3 + Pillow（生成资产需要，`pip install pillow`）。
> 本文件针对「网页 + 桌面双端」完整部署；只想要网页版时告诉 AI 跳过第 4 步。

---

## 任务

请帮我部署本仓库的「桌面宠物进度提醒系统」，按以下步骤执行，遇到问题先自查再询问。

### 0. 环境确认

- 确认 `node --version` ≥ 18、`python --version` ≥ 3.8，`python -c "import PIL"` 可用（不可用则 `pip install pillow`）。
- 确认当前工作目录为本仓库根目录（含 `pets/`、`docs/`、`AI_DEPLOY.md` 的那层）。

### 1. 生成宠物资产

```bash
# 用内置占位宠物（开箱即用；用户若有自己的 spritesheet.webp，放到 assets/ 后改第一行路径）
python pets/xilian/tools/make_placeholder.py assets/spritesheet_placeholder.webp
python pets/xilian/tools/build_sprite.py assets/spritesheet_placeholder.webp pets/xilian/web pets/xilian/web_manifest_template.json
```

检查 `pets/xilian/web/` 下生成了 `sprite.b64`、`sprite2x.b64`、`manifest.json`、`icon.png`。

### 2. 配置插件路径

编辑 `pets/xilian/plugin/host.js` 顶部 `CONFIG` 块：

```js
const CONFIG = {
  workspaceRoot: '<本仓库的绝对路径>',   // 例如 C:/Users/xxx/xilian-desktop-pet
  desktopAppDir: '',                       // 第 4 步部署桌面版后回填
  desktopExe: '',
}
```

> 注意：路径用正斜杠；Windows 中文路径在部分 harness 中会乱码，务必用 `workspaceRoot` 显式指定。

### 3. 注册并激活网页插件（DSH 环境）

1. 读取 `pets/xilian/plugin/host.js` 与 `pets/xilian/plugin/client.js` 全文。
2. 用 `cordis_define` 创建插件：kind `new`，idPrefix 任选（如 `pet`），name `deskpet`，
   `code.host` = host.js 全文，`code.client` = client.js 全文。
3. 用 `cordis_run`（mode `run`）激活；若有批准请求，提示用户批准。
4. 验证：网页右下角出现宠物；用户使用 `todo_write` 更新任务清单时，宠物气泡随之变化。

### 4. 部署桌面版（Electron）

```bash
cd pets/xilian/electron
npm install electron --save-dev --cache ./.npm-cache
npm start
```

- 桌面宠物窗口应出现在屏幕右下角（透明、置顶、可拖动；右键有菜单）。
- 回填第 2 步 `CONFIG.desktopAppDir` = `<仓库绝对路径>/pets/xilian/electron`，
  `desktopExe` 留空（自动推导）。
- 更新插件（`cordis_define` 追加新包 + `cordis_run` update）使看门狗生效。
- 验证单实例协调：
  - 桌面版运行时 → 网页版自动隐身；
  - 刷新网页 → 15~30 秒内桌面版被看门狗自动拉起；
  - 右键桌面版「退出」→ 网页版自动回归。

### 5. 收尾

- 告诉用户两个版本的交互方式（网页版：点徽章开面板/拖拽；桌面版：右键菜单）。
- 如用户希望所有会话自动带宠物公约，把 `preset/persona-section.md` 的内容追加到其 Agent 预设的 persona 段（或按其中说明操作）。

### 已知坑（遇到先查这里，详见 docs/troubleshooting.md）

- `subprocess.spawn` 的 spec 必须带 `graceMs`（正整数）——仓库代码已带，勿删。
- 网页版刷新后消失是 harness 机制限制（动态 Client 不随刷新重投递）：看门狗会自动拉起桌面版；若只要网页版，重新 `cordis_run`（mode run）当前包即可。
- 改路径后若宠物读不到资产，检查 `CONFIG.workspaceRoot` 是否与 `pets/xilian` 所在层一致。
