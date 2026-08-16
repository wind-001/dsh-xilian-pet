#!/usr/bin/env python3
"""从精灵图 spritesheet 生成宠物网页资产。

用法:
  python build_sprite.py <spritesheet.webp> [输出目录] [manifest.json] [--cell 192,208] [--grid 8,9]

输出（默认写入 pets/xilian/web/）:
  sprite.webp / sprite.b64   —— 1x 精灵图（190px 高，q80）
  sprite2x.webp / sprite2x.b64 —— 2x 高清（380px 高，放大时用）
  icon.png                    —— 64x64 通知图标
  manifest.json               —— 存在则更新 cellW/cellH/displayScale，否则新建

默认精灵图布局: 8 列 x 9 行网格，源格 192x208（可用 --cell/--grid 调整）。
依赖: Pillow
"""
import sys
import os
import json
import base64
from PIL import Image

DEFAULT_ANIMS = [
    {"name": "待机·呼吸", "frames": 6},
    {"name": "向左行走", "frames": 8},
    {"name": "向左奔跑", "frames": 8},
    {"name": "待机·眨眼", "frames": 4},
    {"name": "待机·微动", "frames": 5},
    {"name": "闭眼·平静", "frames": 8},
    {"name": "翅膀扇动", "frames": 6},
    {"name": "行走变体", "frames": 6},
    {"name": "低头·忧伤", "frames": 6},
]

DEFAULT_MANIFEST = {
    "identity": {
        "id": "pet",
        "displayName": "桌宠",
        "description": "我的桌面宠物：会跟随任务进度切换动画与气泡，支持网页/桌面双端。",
    },
    "cols": 8,
    "rows": 9,
    "anims": DEFAULT_ANIMS,
}


def parse_args(argv):
    out = {'src': None, 'outdir': 'web', 'manifest': None, 'cell': (192, 208), 'grid': (8, 9)}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--cell' and i + 1 < len(argv):
            w, h = argv[i + 1].split(',')
            out['cell'] = (int(w), int(h))
            i += 2
        elif a == '--grid' and i + 1 < len(argv):
            c, r = argv[i + 1].split(',')
            out['grid'] = (int(c), int(r))
            i += 2
        elif out['src'] is None:
            out['src'] = a
            i += 1
        elif out['outdir'] == 'web':
            out['outdir'] = a
            i += 1
        elif out['manifest'] is None:
            out['manifest'] = a
            i += 1
        else:
            i += 1
    return out


def content_boxes(im, cell, grid):
    cw, ch = cell
    cols, rows = grid
    boxes = {}
    for r in range(rows):
        for c in range(cols):
            boxes[(r, c)] = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)).getchannel('A').getbbox()
    maxw = maxh = 0
    for b in boxes.values():
        if b:
            maxw = max(maxw, b[2] - b[0])
            maxh = max(maxh, b[3] - b[1])
    return boxes, maxw, maxh


def make_sheet(im, boxes, maxw, maxh, cell, grid, target_h, pad, quality, path):
    cw, ch = cell
    cols, rows = grid
    scale = target_h / maxh
    w2 = int(maxw * scale) + pad
    h2 = target_h + pad
    sheet = Image.new('RGBA', (cols * w2, rows * h2), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            b = boxes[(r, c)]
            if not b:
                continue
            f = im.crop((c * cw + b[0], r * ch + b[1], c * cw + b[2], r * ch + b[3]))
            f = f.resize((int((b[2] - b[0]) * scale), int((b[3] - b[1]) * scale)), Image.LANCZOS)
            sheet.paste(f, (c * w2 + (w2 - f.width) // 2, r * h2 + (h2 - f.height) // 2), f)
    sheet.save(path, 'WEBP', lossless=False, quality=quality, method=6)
    return w2, h2


def make_icon(im, cell, grid, path):
    cw, ch = cell
    cols, _ = grid
    cell_img = im.crop((0, 0, cw, ch))
    bbox = cell_img.getchannel('A').getbbox()
    if not bbox:
        bbox = (0, 0, cw, ch)
    f = cell_img.crop(bbox)
    f = f.resize((64, max(1, int(64 * f.height / f.width))), Image.LANCZOS)
    canvas = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    canvas.paste(f, ((64 - f.width) // 2, (64 - f.height) // 2), f)
    canvas.save(path)


def main():
    args = parse_args(sys.argv[1:])
    if not args['src']:
        print(__doc__)
        sys.exit(1)
    os.makedirs(args['outdir'], exist_ok=True)
    im = Image.open(args['src']).convert('RGBA')
    boxes, maxw, maxh = content_boxes(im, args['cell'], args['grid'])

    manifest_path = args['manifest'] or os.path.join(args['outdir'], 'manifest.json')
    if os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path, encoding='utf-8'))
    else:
        manifest = json.loads(json.dumps(DEFAULT_MANIFEST, ensure_ascii=False))
    manifest['cols'], manifest['rows'] = args['grid']

    w1, h1 = make_sheet(im, boxes, maxw, maxh, args['cell'], args['grid'], 190, 4, 80, os.path.join(args['outdir'], 'sprite.webp'))
    b64 = base64.b64encode(open(os.path.join(args['outdir'], 'sprite.webp'), 'rb').read()).decode()
    open(os.path.join(args['outdir'], 'sprite.b64'), 'w').write(b64)
    manifest['cellW'] = w1
    manifest['cellH'] = h1
    manifest['displayScale'] = 1.15

    make_sheet(im, boxes, maxw, maxh, args['cell'], args['grid'], 380, 8, 78, os.path.join(args['outdir'], 'sprite2x.webp'))
    b64 = base64.b64encode(open(os.path.join(args['outdir'], 'sprite2x.webp'), 'rb').read()).decode()
    open(os.path.join(args['outdir'], 'sprite2x.b64'), 'w').write(b64)

    make_icon(im, args['cell'], args['grid'], os.path.join(args['outdir'], 'icon.png'))

    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('OK: sprite.webp=%dB cell=%dx%d manifest=%s' % (
        os.path.getsize(os.path.join(args['outdir'], 'sprite.webp')), w1, h1, manifest_path))


if __name__ == '__main__':
    main()
