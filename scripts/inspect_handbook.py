"""Inspect the structure of Handbook.pdf: page count, table of contents, and a
sample of text from the early pages so we can understand what the handbook teaches."""
import fitz  # PyMuPDF

doc = fitz.open("Handbook.pdf")
print(f"Pages: {doc.page_count}")
print(f"Metadata: {doc.metadata}")
print("\n=== TABLE OF CONTENTS (outline) ===")
toc = doc.get_toc()
if toc:
    for lvl, title, page in toc:
        print(f"{'  '*(lvl-1)}{title}  -> p.{page}")
else:
    print("(no embedded TOC)")

print("\n=== TEXT FROM FIRST 6 PAGES ===")
for i in range(min(6, doc.page_count)):
    page = doc[i]
    text = page.get_text().strip()
    print(f"\n----- PAGE {i+1} (chars: {len(text)}) -----")
    print(text[:1500])
