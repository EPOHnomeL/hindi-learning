"""Render selected handbook pages to PNG so we can read them visually.
Usage: python scripts/render_pages.py 1 2 3 10 20
"""
import sys, fitz, os

doc = fitz.open("Handbook.pdf")
os.makedirs("scripts/_pages", exist_ok=True)
pages = [int(a) for a in sys.argv[1:]] or [1, 2, 3]
for p in pages:
    page = doc[p-1]
    txt = page.get_text().strip()
    print(f"page {p}: text_chars={len(txt)}")
    pix = page.get_pixmap(dpi=130)
    out = f"scripts/_pages/page_{p:03d}.png"
    pix.save(out)
    print(f"  saved {out} ({pix.width}x{pix.height})")
