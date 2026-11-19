import os, glob, sys
from lxml import html as LH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pages = sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "*.html")))

problems = []
rows = []

for page in pages:
    path = os.path.join(ROOT, page)
    with open(path, encoding="utf-8") as fh:
        raw = fh.read()
    doc = LH.fromstring(raw)

    if not doc.xpath('//meta[@name="viewport"]'):
        problems.append(f"{page}: falta meta viewport")
    if not doc.xpath("//title"):
        problems.append(f"{page}: falta <title>")
    if not doc.xpath('//meta[@name="description"]'):
        problems.append(f"{page}: falta meta description")
    if page != "404.html" and not doc.xpath('//link[@rel="canonical"]'):
        problems.append(f"{page}: falta canonical")
    if "image/jpeg;base64" in raw or "image/png;base64" in raw:
        problems.append(f"{page}: contiene imágenes base64")

    ids = doc.xpath("//@id")
    dups = {i for i in ids if ids.count(i) > 1}
    if dups:
        problems.append(f"{page}: ids duplicados: {sorted(dups)}")

    for ref in doc.xpath("//@href | //@src | //@poster"):
        if not ref or ref.startswith(("http", "mailto:", "tel:", "#", "data:", "javascript:")):
            continue
        target = ref.split("#")[0].split("?")[0]
        if not target:
            continue
        resolved = os.path.normpath(os.path.join(ROOT, target.lstrip("/")))
        if not os.path.exists(resolved):
            problems.append(f"{page}: enlace roto -> {ref}")

    amz = 0
    for a in doc.xpath('//a[contains(@href,"amazon.com")]'):
        href, rel = a.get("href"), (a.get("rel") or "").lower()
        amz += 1
        if "tag=validsumshop-20" not in href:
            problems.append(f"{page}: Amazon sin etiqueta -> {href}")
        if "sponsored" not in rel or "nofollow" not in rel:
            problems.append(f"{page}: Amazon sin rel sponsored/nofollow -> {href}")

    for a in doc.xpath('//a[contains(@href,"go.hotmart.com")]'):
        if "sponsored" not in (a.get("rel") or "").lower():
            problems.append(f"{page}: Hotmart sin rel sponsored -> {a.get('href')}")

    for a in doc.xpath('//a[starts-with(@href,"#")]'):
        frag = a.get("href")[1:]
        if frag and not doc.xpath(f'//*[@id="{frag}"]'):
            problems.append(f"{page}: ancla inexistente #{frag}")

    # símbolos usados deben existir en el sprite inline
    symbols = set(doc.xpath("//symbol/@id"))
    for u in doc.xpath("//use/@href"):
        name = u.lstrip("#")
        if name and name not in symbols:
            problems.append(f"{page}: símbolo inexistente -> {u}")

    rows.append((page, round(len(raw.encode()) / 1024), amz, len(symbols)))

print("=== PÁGINAS ===")
for page, kb, amz, sym in rows:
    print(f"  {page:20} {kb:>4} KB   Amazon: {amz:>2}   sprite: {sym}")
print(f"\n=== PROBLEMAS: {len(problems)} ===")
for p in problems:
    print("  !", p)
if not problems:
    print("  Ninguno.")
