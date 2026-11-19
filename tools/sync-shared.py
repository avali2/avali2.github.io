"""Actualiza de forma idempotente los bloques compartidos de las páginas existentes."""
import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_PAGES = {"guias.html", "guia-costo-velas.html", "guia-vender-jabones.html"}
report = []

for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    name = os.path.basename(path)
    if name in NEW_PAGES:
        continue
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    original = html
    actions = []

    # 1. quitar el píxel de Meta incrustado (ahora vive en consent.js)
    if "connect.facebook.net/en_US/fbevents.js" in html:
        html = re.sub(r"<script>\s*!function\(f,b,e,v,n,t,s\)[\s\S]*?</script>\s*", "", html, count=1)
        html = re.sub(r"<noscript><img[^>]*facebook\.com/tr[^>]*></noscript>\s*", "", html, count=1)
        actions.append("pixel fuera")

    # 2. imagen de compartir unificada
    html = html.replace("https://avali2.github.io/assets/img/taller-800.jpg",
                        "https://avali2.github.io/assets/img/og-image.jpg")
    if 'property="og:image"' in html and 'property="og:image:width"' not in html:
        html = html.replace(
            '<meta property="og:image" content="https://avali2.github.io/assets/img/og-image.jpg">',
            '<meta property="og:image" content="https://avali2.github.io/assets/img/og-image.jpg">\n'
            '<meta property="og:image:width" content="1200">\n'
            '<meta property="og:image:height" content="630">', 1)
        actions.append("og:image 1200x630")

    # 3. enlace "Guías" en la navegación
    if 'href="guias.html"' not in html and re.search(r'<a href="calculadora\.html"', html):
        html = re.sub(r'(\s*)<a href="calculadora\.html"', r'\1<a href="guias.html">Guías</a>\1<a href="calculadora.html"', html, count=1)
        actions.append("nav guías")

    # 4. enlace "Guías" en el pie
    if 'href="guias.html"' in html and "<li><a href=\"guias.html\">" not in html:
        html = html.replace(
            '<li><a href="bienestar.html">Bienestar en casa</a></li>',
            '<li><a href="bienestar.html">Bienestar en casa</a></li>\n'
            '          <li><a href="guias.html">Guías prácticas</a></li>', 1)
        actions.append("footer guías")

    # 5. estilos y script de consentimiento
    if "consent.css" not in html and "site.css" in html:
        html = html.replace('<link rel="stylesheet" href="assets/css/site.css">',
                            '<link rel="stylesheet" href="assets/css/site.css">\n'
                            '<link rel="stylesheet" href="assets/css/consent.css">', 1)
        actions.append("consent.css")
    if "consent.js" not in html and "site.js" in html:
        html = html.replace('<script src="assets/js/site.js" defer></script>',
                            '<script src="assets/js/consent.js" defer></script>\n'
                            '<script src="assets/js/site.js" defer></script>', 1)
        actions.append("consent.js")

    # 6. dns-prefetch de Meta
    if "dns-prefetch" not in html and 'rel="preconnect" href="https://go.hotmart.com"' in html:
        html = html.replace('<link rel="preconnect" href="https://go.hotmart.com">',
                            '<link rel="preconnect" href="https://go.hotmart.com">\n'
                            '<link rel="dns-prefetch" href="https://connect.facebook.net">', 1)

    if html != original:
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(html)
        report.append((name, actions))

for name, actions in report:
    print(f"{name:22} -> {', '.join(actions) if actions else 'sin cambios'}")
print(f"\n{len(report)} páginas actualizadas")
