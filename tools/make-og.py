"""Genera la imagen de compartir (Open Graph) de 1200x630."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")
FONTS = r"C:\Windows\Fonts"

W, H = 1200, 630


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


# --- base: foto del taller recortada a 1200x630 -------------------------------
src = Image.open(os.path.join(OUT, "taller-1000.jpg")).convert("RGB")
ratio = max(W / src.width, H / src.height)
src = src.resize((round(src.width * ratio) + 1, round(src.height * ratio) + 1), Image.LANCZOS)
left = (src.width - W) // 2
top = int((src.height - H) * 0.42)
base = src.crop((left, top, left + W, top + H))

# un poco de desenfoque para que el texto respire
blur = base.filter(ImageFilter.GaussianBlur(2))
base = Image.blend(base, blur, 0.55)

# --- degradado cálido de izquierda a derecha --------------------------------
grad = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(grad)
for x in range(W):
    t = x / W
    # opaco a la izquierda, transparente hacia la derecha
    v = int(232 * max(0.0, 1 - (t / 0.78)) ** 1.15)
    gd.line([(x, 0), (x, H)], fill=v)

overlay = Image.new("RGB", (W, H), (32, 19, 14))
base = Image.composite(overlay, base, grad)

# viñeta inferior
vg = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vg)
for y in range(H):
    t = y / H
    if t > 0.55:
        vd.line([(0, y), (W, y)], fill=int(110 * (t - 0.55) / 0.45))
base = Image.composite(Image.new("RGB", (W, H), (26, 15, 11)), base, vg)

draw = ImageDraw.Draw(base)

# --- textos -----------------------------------------------------------------
MARGIN = 74

brand_f = font("segoeuib.ttf", 24)
h1_f = font("georgiab.ttf", 62)
lead_f = font("segoeui.ttf", 28)
pill_f = font("segoeuib.ttf", 24)

y = 118

draw.text((MARGIN, y), "VELAS Y JABONES CON LIA", font=brand_f, fill=(214, 170, 128))
y += 52

for i, line in enumerate(["Aprende a hacer velas", "y jabones artesanales"]):
    draw.text((MARGIN, y), line, font=h1_f, fill=(255, 248, 237))
    y += 74

y += 14
draw.text((MARGIN, y), "desde cero, paso a paso y a tu ritmo", font=lead_f, fill=(233, 211, 190))

# --- píldora de prueba social ----------------------------------------------
y += 66
label = "4,9 de 5  ·  283 evaluaciones en Hotmart"
tw = draw.textlength(label, font=pill_f)
pad_x, pad_y = 22, 14
box = [MARGIN, y, MARGIN + tw + pad_x * 2, y + 24 + pad_y * 2]
draw.rounded_rectangle(box, radius=999, fill=(255, 253, 249))
draw.text((MARGIN + pad_x, y + pad_y - 2), label, font=pill_f, fill=(44, 30, 24))

# --- precio ----------------------------------------------------------------
y = box[3] + 26
price_f = font("georgiab.ttf", 46)
small_f = font("segoeuib.ttf", 26)
draw.text((MARGIN, y), "$35", font=price_f, fill=(255, 248, 237))
pw = draw.textlength("$35", font=price_f)
draw.text((MARGIN + pw + 12, y + 22), "USD", font=small_f, fill=(212, 184, 158))
draw.text((MARGIN + pw + 78, y + 16), "antes $69,99", font=font("segoeui.ttf", 24), fill=(196, 166, 140))

out = os.path.join(OUT, "og-image.jpg")
base.save(out, "JPEG", quality=88, optimize=True, progressive=True)
print(f"OK -> {out} ({os.path.getsize(out) // 1024} KB)")
