# 网页插件（DeskPet）

动态 Cordis 插件：Host 半身（大脑）+ Client 半身（网页渲染）。

## 文件

- `host.js` — Host 源码。顶部 `CONFIG` 需按环境填写：
  - `workspaceRoot`：仓库绝对路径（必填，中文路径乱码问题的规避方式）；
  - `desktopAppDir` / `desktopExe`：桌面应用路径（看门狗自动拉起用，可选）。
- `client.js` — Client 源码（无路径依赖）。
- `package.json` — 元数据（仅存档用途，动态插件不通过 npm 安装）。

## 注册激活（DSH harness）

```text
1. cordis_define：kind new / idPrefix（如 pet）/ name（如 deskpet）
   code.host = host.js 全文，code.client = client.js 全文
2. cordis_run（mode run）→ 批准
3. 验证：网页右下角出现宠物；todo_write 更新时气泡变化
```

## 依赖的运行时文件（由 tools/ 生成或插件自动创建）

| 文件 | 生成方 |
|------|--------|
| `../web/sprite.b64`、`sprite2x.b64`、`manifest.json`、`icon.png` | `tools/build_sprite.py` |
| `../state.json`、`../task.json`、`../debug.log` | 插件运行期自动读写 |
| `../desktop_alive.json` | 桌面应用心跳 |

## RPC 一览

`get-sprite` / `retry-sprite` / `load-state` / `save-state` / `get-task` / `desktop-alive` / `web-close`
（详见仓库 `docs/architecture.md`）。

> 复现/部署完整流程见仓库根目录 `README.md` 与 `AI_DEPLOY.md`。
