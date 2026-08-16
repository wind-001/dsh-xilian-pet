# assets/

本目录存放宠物精灵图（**不入库，版权归提供者所有**）。

- `spritesheet_placeholder.webp` — 内置占位宠物（原创、MIT，开箱即用）。由
  `pets/xilian/tools/make_placeholder.py` 生成，可随时重新生成或删除。
- `spritesheet.webp` —（可选）你自己的宠物精灵图：8 列 × 9 行、每格 192×208、透明背景。
  放置后运行：
  ```bash
  python pets/xilian/tools/build_sprite.py assets/spritesheet.webp pets/xilian/web
  ```
- `previews/` — README 预览图（由 `pets/xilian/tools/make_previews.py` 生成，可用任意精灵图重出）：
  ```bash
  python pets/xilian/tools/make_previews.py --sheet assets/spritesheet_placeholder.webp --out assets/previews
  ```

> 注意：仓库**不包含**任何受版权保护的角色图（《崩坏：星穹铁道》等同人图不可再分发）。
> 当前 README 预览图含用户自备角色素材，公开发布前请自行确认版权，或改用内置占位宠物重新生成。
