import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sprite_path = os.path.join(ROOT, "assets", "img", "sprite.svg")

with open(sprite_path, encoding="utf-8") as fh:
    sprite = fh.read()

# versión inline: sin display:none (más compatible con <use>), oculta por tamaño
sprite_inline = sprite.replace(
    'style="display:none"',
    'style="position:absolute;width:0;height:0;overflow:hidden"'
).strip()

count = 0
for path in glob.glob(os.path.join(ROOT, "*.html")):
    with open(path, encoding="utf-8") as fh:
        html = fh.read()

    if 'assets/img/sprite.svg#' not in html:
        continue

    # 1. limpiar inyecciones previas
    html = re.sub(r'<!--sprites-->.*?<!--/sprites-->\s*', '', html, flags=re.S)

    # 2. apuntar las referencias al sprite inline
    html = html.replace('href="assets/img/sprite.svg#', 'href="#')
    html = html.replace("href='assets/img/sprite.svg#", "href='#")

    # 3. inyectar el sprite justo después de <body>
    block = "<!--sprites-->\n" + sprite_inline + "\n<!--/sprites-->\n"
    html = re.sub(r'(<body[^>]*>)', r'\1\n' + block.replace('\\', '\\\\'), html, count=1)

    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    count += 1
    print("sprite inline ->", os.path.basename(path))

print(f"\n{count} páginas actualizadas")
