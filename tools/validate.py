"""Validación estática sin dependencias: python3 tools/validate.py."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import sys

ROOT = Path(__file__).resolve().parent.parent

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.schemas = []
        self.schema = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.schema = ''

    def handle_data(self, text):
        if self.schema is not None:
            self.schema += text

    def handle_endtag(self, tag):
        if tag == 'script' and self.schema is not None:
            self.schemas.append(self.schema)
            self.schema = None

pages = {p.name: Page(p.read_text()) for p in sorted(ROOT.glob('*.html'))}
problems = []
refs = 0
for name, page in pages.items():
    def fail(message):
        problems.append(f'{name}: {message}')
    tags = page.tags
    ids = [a['id'] for _, a in tags if 'id' in a]
    for key, count in Counter(ids).items():
        if count > 1:
            fail(f'id duplicado {key}')
    for tag, attr, value in [('meta', 'name', 'viewport'), ('meta', 'name', 'description')]:
        if not any(t == tag and a.get(attr) == value for t, a in tags):
            fail(f'falta {value}')
    if sum(t == 'h1' for t, _ in tags) != 1:
        fail('debe haber un solo h1')
    if not any(t == 'title' for t, _ in tags):
        fail('falta title')
    if name != '404.html' and not any(t == 'link' and a.get('rel') == 'canonical' for t, a in tags):
        fail('falta canonical')
    for schema in page.schemas:
        try:
            json.loads(schema)
        except ValueError as error:
            fail(f'JSON-LD inválido: {error}')
    for tag, attrs in tags:
        if tag == 'img' and 'alt' not in attrs:
            fail('imagen sin alt')
        if tag == 'a' and attrs.get('target') == '_blank' and 'noopener' not in attrs.get('rel', ''):
            fail('enlace externo sin noopener')
        if tag == 'a':
            href = attrs.get('href', '')
            if 'go.hotmart.com/' in href and 'sponsored' not in attrs.get('rel', ''):
                fail('Hotmart sin sponsored')
            if 'amazon.com/' in href and ('tag=validsumshop-20' not in href or 'sponsored' not in attrs.get('rel', '')):
                fail('Amazon sin atribución/sponsored')
        values = [attrs[k] for k in ('href', 'src', 'poster', 'data-src') if attrs.get(k)]
        if attrs.get('srcset'):
            values += [part.strip().split()[0] for part in attrs['srcset'].split(',')]
        for value in values:
            url = urlsplit(value)
            if url.scheme or url.netloc:
                continue
            refs += 1
            path = unquote(url.path).lstrip('/') or name
            target = ROOT / path
            if not target.is_file():
                fail(f'recurso local inexistente {value}')
            elif url.fragment and path in pages:
                target_ids = {a.get('id') for _, a in pages[path].tags}
                if unquote(url.fragment) not in target_ids:
                    fail(f'ancla inexistente {value}')
    raw = (ROOT / name).read_text()
    if 'abacus.jasoncameron.dev' in raw or "fbq('track', 'InitiateCheckout')" in raw:
        fail('contador externo o conversión falsa heredada')
    print(f'{name}: {len(tags)} etiquetas, {len(page.schemas)} bloques JSON-LD')
print(f'\n{len(pages)} páginas; {refs} referencias locales; {len(problems)} problemas.')
for message in problems:
    print('ERROR:', message)
sys.exit(1 if problems else 0)
