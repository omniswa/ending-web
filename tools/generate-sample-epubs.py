#!/usr/bin/env python3
"""Generate placeholder EPUB files for every book in books.json.

The text is original filler so the reader can be exercised without real books.
Usage: python3 tools/generate-sample-epubs.py
Each book gets a "file" entry in books.json pointing at epubs/<id>.epub.
"""
import json
import random
import zipfile
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_JSON = ROOT / "books.json"
OUT_DIR = ROOT / "epubs"

PARAGRAPHS = [
    "Morning arrived the way it always did here, without ceremony. A thin light slid across the floorboards and found the edge of the table, and for a while nothing else moved. It is a particular kind of quiet, the kind that makes you aware of your own breathing and the small, domestic sounds you had stopped hearing.",
    "There is a habit of attention that only develops slowly. You notice first the obvious things, the shape of a hill or the colour of a door, and only later the way a hinge complains or a window fogs. Most of what is worth knowing about a place arrives in that second layer.",
    "She kept a list in the back of her notebook, not of things to do but of things she had already seen. It was a stubborn kind of record. Whenever the days seemed to blur together, she would turn to it and read a few lines, and the blur would resolve into particulars again.",
    "Questions are easier to carry than answers. An answer must be defended, polished, and eventually corrected, while a question can simply be kept in a pocket and taken out on long walks. By the end of the season he had accumulated a surprising number of them.",
    "The road bent twice before it reached the village, once around a stand of birches and once around an old stone wall that no one remembered building. Travellers tended to slow at the second bend, as though the wall asked it of them.",
    "Rain made the afternoon smaller. The windows blurred, the street emptied, and the hours folded inward until the room seemed to contain everything that mattered: a lamp, a pot of tea going cold, and a stack of pages that had waited patiently for exactly this.",
    "It would be easy to say that nothing happened that week, and in the usual sense it would be true. No one arrived, no one left. But the pears ripened on the windowsill, and a letter was begun and set aside, and a long-standing disagreement quietly lost its edge.",
    "Maps, he liked to say, are arguments about what deserves to be remembered. Every line is a decision, and every blank space is a decision too. The skill lay in knowing which silences to leave alone.",
    "In the evening the light turned the colour of weak honey. Conversations dropped to a murmur, and the dog circled twice before settling. It was the hour in which people forgave one another a little more easily than usual.",
    "There was a bench at the top of the rise, weathered to the grey of driftwood, and over the years it had collected the quiet habits of everyone who sat there. Some carved initials. Some left a coin. Most simply sat and looked at the valley until it looked back.",
    "Learning to wait is its own craft. Seeds, kettles, and old friends all keep their own schedules, and the work consists mostly of staying out of their way. She had come to find a certain relief in that arrangement.",
    "Names have a way of outliving the things they once described. The lane was still called Mill Lane though the mill had burned before anyone's grandmother was born, and the river it served had shifted course to the east.",
    "A good sentence, he thought, is a small room with the door left open. It should be furnished sparely, lit from one side, and arranged so that a visitor can walk in and feel, for a moment, entirely at home.",
    "When the last page was done, she did not close the book at once. She let the final lines settle, the way you let a bell finish ringing, and only then did she look up and notice that the light in the room had changed.",
]

CHAPTER_TITLES = ["The First Light", "A Slow Road", "What the Rain Kept", "Evening, Again"]

DIVIDER_SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 24" width="240" height="24">
  <g fill="none" stroke="#8a8578" stroke-width="1.5" stroke-linecap="round">
    <path d="M10 12h90M140 12h90"/><circle cx="120" cy="12" r="5"/>
  </g>
</svg>
"""

CSS = "body { font-family: serif; } img { max-width: 100%; }\n"


def xhtml(title: str, body: str, css_href: str = "../styles.css") -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><meta charset="utf-8"/><title>{escape(title)}</title><link rel="stylesheet" href="{css_href}"/></head>
<body>
{body}
</body>
</html>
"""


def build_chapters(book: dict, rng: random.Random) -> list[str]:
    chapters = []
    for index, title in enumerate(CHAPTER_TITLES):
        parts = [f"<h1>{escape(title)}</h1>"]
        if index == 0:
            parts.append(
                f"<p><em>Sample edition.</em> This is placeholder text for &#8220;{escape(book['title'])}&#8221; "
                f"by {escape(book['author'])}, generated so you can try the reader. "
                f"Point the <code>file</code> field of this book in books.json at a real EPUB to replace it.</p>"
            )
        picks = rng.sample(PARAGRAPHS, 8)
        for i, text in enumerate(picks):
            parts.append(f"<p>{escape(text)}</p>")
            if index == 1 and i == 3:
                parts.append('<p style="text-align:center"><img src="../images/divider.svg" alt="Decorative divider"/></p>')
            if index == 2 and i == 4:
                parts.append("<h2>A smaller heading</h2>")
        if index < len(CHAPTER_TITLES) - 1:
            parts.append(f'<p><a href="ch{index + 2}.xhtml">Continue to {escape(CHAPTER_TITLES[index + 1])}</a></p>')
        chapters.append(xhtml(title, "\n".join(parts)))
    return chapters


def build_epub(book: dict, path: Path) -> None:
    rng = random.Random(book["id"])
    chapters = build_chapters(book, rng)
    manifest = "\n    ".join(
        f'<item id="ch{i + 1}" href="text/ch{i + 1}.xhtml" media-type="application/xhtml+xml"/>' for i in range(len(chapters))
    )
    spine = "\n    ".join(f'<itemref idref="ch{i + 1}"/>' for i in range(len(chapters)))
    opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:3nding:{escape(book['id'])}</dc:identifier>
    <dc:title>{escape(book['title'])}</dc:title>
    <dc:creator>{escape(book['author'])}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-10-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="divider" href="images/divider.svg" media-type="image/svg+xml"/>
    {manifest}
  </manifest>
  <spine toc="ncx">
    {spine}
  </spine>
</package>
"""
    nav_items = "\n".join(
        f'      <li><a href="text/ch{i + 1}.xhtml">{escape(t)}</a></li>' for i, t in enumerate(CHAPTER_TITLES)
    )
    nav = xhtml("Contents", f'<nav epub:type="toc" id="toc"><h1>Contents</h1>\n    <ol>\n{nav_items}\n    </ol></nav>', "styles.css")
    points = "\n".join(
        f'    <navPoint id="np{i + 1}" playOrder="{i + 1}"><navLabel><text>{escape(t)}</text></navLabel><content src="text/ch{i + 1}.xhtml"/></navPoint>'
        for i, t in enumerate(CHAPTER_TITLES)
    )
    ncx = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:3nding:{escape(book['id'])}"/></head>
  <docTitle><text>{escape(book['title'])}</text></docTitle>
  <navMap>
{points}
  </navMap>
</ncx>
"""
    container = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
"""
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        deflate = zipfile.ZIP_DEFLATED
        z.writestr("META-INF/container.xml", container, compress_type=deflate)
        z.writestr("OEBPS/content.opf", opf, compress_type=deflate)
        z.writestr("OEBPS/nav.xhtml", nav, compress_type=deflate)
        z.writestr("OEBPS/toc.ncx", ncx, compress_type=deflate)
        z.writestr("OEBPS/styles.css", CSS, compress_type=deflate)
        z.writestr("OEBPS/images/divider.svg", DIVIDER_SVG, compress_type=deflate)
        for i, content in enumerate(chapters):
            z.writestr(f"OEBPS/text/ch{i + 1}.xhtml", content, compress_type=deflate)


def main() -> None:
    books = json.loads(BOOKS_JSON.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(exist_ok=True)
    for book in books:
        target = OUT_DIR / f"{book['id']}.epub"
        build_epub(book, target)
        book["file"] = f"epubs/{target.name}"
    BOOKS_JSON.write_text(json.dumps(books, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {len(books)} sample EPUBs in {OUT_DIR}")


if __name__ == "__main__":
    main()
