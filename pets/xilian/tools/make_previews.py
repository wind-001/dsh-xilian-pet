#!/usr/bin/env python3
"""生成 README 预览图（系统截图风格 mock）。

用法:
  python make_previews.py [--sheet <spritesheet.webp>] [--out <目录>]

默认 sheet = assets/spritesheet_placeholder.webp（也可传自己的精灵图，如昔涟）；
输出到 <out>/（默认 assets/previews/）：
  preview-web.jpg      网页版悬浮宠物（浏览器窗口 + 聊天界面）
  preview-desktop.jpg  桌面版置顶透明窗口 + 任务栏
  preview-states.jpg   状态联动（空闲/运行/等待/完成/遇阻 + 气泡）

精灵图布局: 8 列 x 9 行、每格 192x208（与 build_sprite.py 默认一致）。
依赖: Pillow（Windows 使用系统微软雅黑字体渲染中文）
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageFont

GRID = (8, 9)
CELL = (192, 208)


def font(size, bold=False):
    cands = [
        'C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/simsun.ttc',
        '/System/Library/Fonts/PingFang.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ]
    for c in cands:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            pass
    return ImageFont.load_default()


def load_frames(path):
    im = Image.open(path).convert('RGBA')
    cols, rows = GRID
    cw, ch = CELL
    frames = {}
    for r in range(rows):
        for c in range(cols):
            frames[(r, c)] = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
    return frames, cw, ch


def paste_frame(base, frames, row, col, x, y, scale):
    cw, ch = CELL
    f = frames[(row, col)].resize((int(cw * scale), int(ch * scale)), Image.LANCZOS)
    base.paste(f, (x, y), f)


def bubble(d, cx, bottom_y, text, fnt, sticky=False):
    """以 (cx, bottom_y) 为尾巴锚点画气泡。"""
    bbox = d.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    bw = tw + 44
    bh = 46
    x = cx - bw // 2
    y = bottom_y - bh - 14
    fill = (64, 36, 14, 247) if sticky else (30, 26, 54, 247)
    border = (255, 184, 77, 255) if sticky else (178, 132, 255, 255)
    d.rounded_rectangle([x, y, x + bw, y + bh], radius=14, fill=fill, outline=border, width=2)
    d.text((x + (bw - tw) / 2 - bbox[0], y + (bh - (bbox[3] - bbox[1])) / 2 - bbox[1]),
           text, font=fnt, fill=(255, 233, 201, 255) if sticky else (240, 233, 255, 255))
    d.polygon([(cx - 8, y + bh - 1), (cx + 8, y + bh - 1), (cx, y + bh + 10)], fill=fill)


def web_preview(frames, out):
    W, H = 1280, 800
    img = Image.new('RGB', (W, H), (24, 26, 38))
    d = ImageDraw.Draw(img)
    # 浏览器顶栏
    d.rectangle([0, 0, W, 54], fill=(20, 22, 32))
    for i, col in enumerate([(220, 60, 60), (240, 180, 60), (90, 200, 120)]):
        d.ellipse([22 + i * 24, 18, 38 + i * 24, 34], fill=col)
    d.rounded_rectangle([100, 14, 720, 40], radius=13, fill=(38, 41, 56), outline=(60, 64, 84))
    d.text((118, 21), 'http://127.0.0.1:3080', font=font(15), fill=(140, 145, 170))
    # 侧栏
    d.rectangle([0, 54, 220, H - 56], fill=(28, 30, 42))
    for i in range(4):
        d.rounded_rectangle([16, 76 + i * 64, 200, 120 + i * 64], radius=10, fill=(40 + i * 5, 43, 60))
        d.text((28, 87 + i * 64), ['会话 A', '会话 B', '会话 C', '会话 D'][i], font=font(15), fill=(200, 200, 220))
    # 对话消息
    d.rounded_rectangle([260, 100, 660, 152], radius=10, fill=(44, 48, 66))
    d.text((278, 117), '帮我重构一下这个模块，谢谢', font=font(14), fill=(210, 214, 232))
    d.rounded_rectangle([700, 176, 1180, 238], radius=10, fill=(92, 72, 164))
    d.text((722, 193), '好的，正在分析代码结构并制定方案…', font=font(14), fill=(235, 230, 250))
    # 输入框
    d.rounded_rectangle([260, 714, 1210, 766], radius=16, fill=(34, 37, 52), outline=(60, 64, 84))
    d.text((286, 733), '输入消息…', font=font(15), fill=(120, 124, 148))
    # 宠物 + 气泡（右下角）
    sc = 2.0
    pw, ph = int(CELL[0] * sc), int(CELL[1] * sc)
    px, py = W - pw - 48, H - ph - 92
    bubble(d, px + pw // 2, py, '正在编写代码 / 读取文件...', font(17))
    paste_frame(img, frames, 1, 2, px, py, sc)
    img.save(out, 'JPEG', quality=88)
    print('saved', out)


def desktop_preview(frames, out):
    W, H = 1280, 800
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    # 桌面壁纸渐变
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(34 + 60 * t), int(38 + 40 * t), int(64 + 96 * t)))
    # 任务栏
    d.rectangle([0, H - 56, W, H], fill=(24, 26, 34))
    for i, col in enumerate([(70, 120, 220), (90, 160, 90), (220, 160, 70)]):
        d.rounded_rectangle([24 + i * 84, H - 44, 84 + i * 84, H - 14], radius=8, fill=col)
    d.ellipse([W - 48, H - 42, W - 18, H - 12], fill=(60, 64, 84))
    # 其他应用窗口（背景）
    d.rounded_rectangle([90, 90, 760, 560], radius=12, fill=(40, 44, 62), outline=(60, 64, 84), width=2)
    d.rectangle([92, 92, 758, 122], fill=(34, 38, 54))
    d.text((110, 98), '编辑器 - 项目', font=font(14), fill=(200, 204, 224))
    for i in range(6):
        d.rectangle([120, 140 + i * 30, 420, 158 + i * 30], fill=(52, 56, 76))
    # 桌面宠物窗口（右下角悬浮）
    sc = 1.9
    pw, ph = int(CELL[0] * sc), int(CELL[1] * sc)
    px, py = W - pw - 64, H - 56 - ph - 40
    bubble(d, px + pw // 2, py + 4, '任务 5/7 · 当前：「优化气泡布局」', font(16))
    paste_frame(img, frames, 0, 1, px, py, sc)
    # 窗口描边（透明窗口感）
    d.rounded_rectangle([px - 6, py - 6, px + pw + 6, py + ph + 6], radius=16,
                        outline=(200, 210, 255, 120), width=2)
    img.save(out, 'JPEG', quality=88)
    print('saved', out)


def states_preview(frames, out):
    states = [
        (0, 0, '空闲', '等待指令...', (120, 200, 160), False),
        (1, 1, '运行中', '正在编写代码 / 读取文件...', (120, 170, 240), False),
        (4, 0, '等待输入', '我需要你的决定！', (255, 184, 77), True),
        (6, 0, '可复核', '任务完成！快来检查成果吧！', (200, 140, 255), False),
        (8, 0, '遇阻降级', '思考中...（可能遇到阻力）', (255, 140, 120), False),
    ]
    panel_w, panel_h = 320, 420
    gap = 24
    W = 5 * panel_w + 6 * gap
    H = panel_h + 2 * gap + 40
    img = Image.new('RGB', (W, H), (22, 24, 36))
    d = ImageDraw.Draw(img)
    for i, (row, col, title, text, dot, sticky) in enumerate(states):
        x = gap + i * (panel_w + gap)
        y = gap
        d.rounded_rectangle([x, y, x + panel_w, y + panel_h], radius=14,
                            fill=(34, 37, 52), outline=(70, 74, 96), width=2)
        d.ellipse([x + 18, y + 24, x + 34, y + 40], fill=dot)
        d.text((x + 46, y + 16), title, font=font(18, bold=True), fill=(220, 214, 244))
        sc = 1.05
        pw, ph = int(CELL[0] * sc), int(CELL[1] * sc)
        px = x + (panel_w - pw) // 2
        py = y + 70
        paste_frame(img, frames, row, col, px, py, sc)
        bubble(d, x + panel_w // 2, y + 70 + ph + 30, text, font(15), sticky=sticky)
    img.save(out, 'JPEG', quality=88)
    print('saved', out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', default='assets/spritesheet_placeholder.webp')
    ap.add_argument('--out', default='assets/previews')
    args = ap.parse_args()
    frames, _, _ = load_frames(args.sheet)
    os.makedirs(args.out, exist_ok=True)
    web_preview(frames, os.path.join(args.out, 'preview-web.jpg'))
    desktop_preview(frames, os.path.join(args.out, 'preview-desktop.jpg'))
    states_preview(frames, os.path.join(args.out, 'preview-states.jpg'))


if __name__ == '__main__':
    main()
