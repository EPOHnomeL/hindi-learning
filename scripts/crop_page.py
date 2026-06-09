"""Render one half (left/right page) of a spread at high DPI for close reading.
Usage: python scripts/crop_page.py <pdf_page> <left|right> [dpi]
"""
import sys, fitz, os
doc = fitz.open("Handbook.pdf")
p = int(sys.argv[1]); side = sys.argv[2] if len(sys.argv) > 2 else "left"
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 220
page = doc[p-1]
r = page.rect
clip = fitz.Rect(r.x0, r.y0, r.x0 + r.width/2, r.y1) if side == "left" \
       else fitz.Rect(r.x0 + r.width/2, r.y0, r.x1, r.y1)
pix = page.get_pixmap(dpi=dpi, clip=clip)
os.makedirs("scripts/_pages", exist_ok=True)
out = f"scripts/_pages/page_{p:03d}_{side}.png"
pix.save(out)
print(f"saved {out} ({pix.width}x{pix.height})")
