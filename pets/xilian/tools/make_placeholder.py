#!/usr/bin/env python3
"""生成占位宠物精灵图（开源版开箱即用，无版权顾虑）。

用法:
  python make_placeholder.py [输出路径]

输出: 一个 8 列 × 9 行、192x208 网格的简单圆形小宠（不同行 = 不同动作），
      可直接喂给 build_sprite.py 生成网页资产；之后可替换成你自己的精灵图。
依赖: Pillow
"""
import sys
import os
from PIL import Image, ImageDraw

COLS, ROWS = 8, 9
CELL_W, CELL_H = 192, 208
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join('assets', 'spritesheet_placeholder.webp')


def draw_cell(img, cx, cy, variant, offset_y, blink, mouth_arc):
    d = ImageDraw.Draw(img)
    x0, y0 = cx * CELL_W, cy * CELL_H
    cx0, cy0 = x0 + CELL_W // 2, y0 + CELL_H // 2 + offset_y
    r = 70
    # 身体（圆）
    d.ellipse([cx0 - r, cy0 - r, cx0 + r, cy0 + r], fill=(250, 220, 160, 255), outline=(180, 130, 80, 255), width=6)
    # 耳朵
    d.ellipse([cx0 - r + 10, cy0 - r - 34, cx0 - r + 44, cy0 - r], fill=(250, 220, 160, 255), outline=(180, 130, 80, 255), width=6)
    d.ellipse([cx0 + r - 44, cy0 - r - 34, cx0 + r - 10, cy0 - r], fill=(250, 220, 160, 255), outline=(180, 130, 80, 255), width=6)
    # 眼睛
    ey = cy0 - 12
    if variant in (3, 5):  # 闭眼
        d.line([cx0 - 34, ey, cx0 - 14, ey], fill=(60, 40, 20, 255), width=6)
        d.line([cx0 + 14, ey, cx0 + 34, ey], fill=(60, 40, 20, 255), width=6)
    elif variant == 8:  # 低头/伤心（半闭）
        d.arc([cx0 - 40, ey - 8, cx0 - 8, ey + 8], 200, 340, fill=(60, 40, 20, 255), width=5)
        d.arc([cx0 + 8, ey - 8, cx0 + 40, ey + 8], 200, 340, fill=(60, 40, 20, 255), width=5)
    else:
        d.ellipse([cx0 - 38, ey - 16, cx0 - 12, ey + 16], fill=(60, 40, 20, 255))
        d.ellipse([cx0 + 12, ey - 16, cx0 + 38, ey + 16], fill=(60, 40, 20, 255))
        if blink:
            d.ellipse([cx0 - 34, ey - 6, cx0 - 16, ey + 6], fill=(250, 220, 160, 255))
            d.ellipse([cx0 + 16, ey - 6, cx0 + 34, ey + 6], fill=(250, 220, 160, 255))
    # 嘴
    my = cy0 + 22
    if variant == 6:  # 欢呼（张嘴）
        d.ellipse([cx0 - 22, my - 6, cx0 + 22, my + 26], fill=(180, 90, 70, 255), outline=(120, 60, 45, 255), width=4)
    elif variant == 8:  # 伤心（下弯）
        d.arc([cx0 - 26, my - 6, cx0 + 26, my + 26], 20, 160, fill=(60, 40, 20, 255), width=5)
    else:
        d.arc([cx0 - 26, my - 8, cx0 + 26, my + 14], 200, 340, fill=(60, 40, 20, 255), width=5)


def main():
    sheet = Image.new('RGBA', (COLS * CELL_W, ROWS * CELL_H), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            # 行 = 动作变体；列 = 帧（轻微偏移/眨眼差异）
            offset = {0: 0, 1: [0, 4, 8, 4, 0, -4, -8, -4][c], 2: [0, 8, 14, 8, 0, -8, -14, -8][c], 7: [0, 5, 10, 5, 0, -5, -10, -5][c]}.get(r, 0)
            blink = r in (3,) and c in (2, 3)
            draw_cell(sheet, c, r, r, offset, blink, 0)
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    sheet.save(OUT, 'WEBP', lossless=False, quality=85, method=6)
    print('placeholder saved:', OUT, sheet.size)


if __name__ == '__main__':
    main()
