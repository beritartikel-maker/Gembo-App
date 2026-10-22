"""Membuat ikon Gembo Notes (merah, catatan + centang). Jalankan: python3 scripts/make_icons.py"""
from PIL import Image, ImageDraw
import os
RED=(211,47,47,255); DARK=(160,28,28,255); WHITE=(255,255,255,255)
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=4096  # supersample

def note(d, cx, cy, w):
    """gambar buku catatan putih dengan centang merah, lebar w, pusat (cx,cy)"""
    h=w*1.16; x0=cx-w/2; y0=cy-h/2; x1=cx+w/2; y1=cy+h/2; r=w*0.12; f=w*0.26
    # badan dengan sudut kanan-atas terlipat
    d.rounded_rectangle([x0,y0,x1,y1],radius=r,fill=WHITE)
    e=w*0.01
    d.polygon([(x1-f,y0-e),(x1+e,y0-e),(x1+e,y0+f+e)],fill=(0,0,0,0))  # potong sudut (transparan)
    d.polygon([(x1-f,y0),(x1,y0+f),(x1-f,y0+f)],fill=(244,199,199,255))  # lipatan
    # garis teks
    lw=w*0.055
    for i,(a,b) in enumerate([(0.0,0.55),(0.14,0.62)]):
        pass
    # centang merah
    ck=[(cx-w*0.22,cy+h*0.05),(cx-w*0.06,cy+h*0.20),(cx+w*0.26,cy-h*0.10)]
    d.line(ck,fill=RED,width=int(w*0.12),joint="curve")
    for p in (ck[0],ck[2]): d.ellipse([p[0]-w*0.06,p[1]-w*0.06,p[0]+w*0.06,p[1]+w*0.06],fill=RED)

def render(size,bg=True,scale=0.56,round_corner=0.0):
    im=Image.new("RGBA",(S,S),(0,0,0,0))
    if bg:
        d=ImageDraw.Draw(im)
        if round_corner: d.rounded_rectangle([0,0,S,S],radius=int(S*round_corner),fill=RED)
        else: d.rectangle([0,0,S,S],fill=RED)
    layer=Image.new("RGBA",(S,S),(0,0,0,0))
    note(ImageDraw.Draw(layer),S/2,S/2,S*scale)
    im.alpha_composite(layer)
    return im.resize((size,size),Image.LANCZOS)

def save(img,path):
    os.makedirs(os.path.dirname(path),exist_ok=True); img.save(path)

# Android (sumber untuk @capacitor/assets)
save(render(1024,True,0.56),f"{R}/mobile/assets/icon-only.png")
save(render(1024,False,0.40),f"{R}/mobile/assets/icon-foreground.png")   # zona aman adaptive icon
bgp=Image.new("RGBA",(1024,1024),RED); save(bgp,f"{R}/mobile/assets/icon-background.png")
for name in ("splash.png","splash-dark.png"):
    sp=Image.new("RGBA",(2732,2732),RED)
    ic=render(900,False,0.9); sp.alpha_composite(ic,((2732-900)//2,(2732-900)//2))
    save(sp,f"{R}/mobile/assets/{name}")
# Web / PWA
save(render(192,True,0.56),f"{R}/public/icons/icon-192.png")
save(render(512,True,0.56),f"{R}/public/icons/icon-512.png")
save(render(180,True,0.62,0.22),f"{R}/public/icons/apple-touch-icon.png")
# Desktop
save(render(512,True,0.60,0.2),f"{R}/desktop/build/icon.png")
ico=render(256,True,0.60,0.2); save(ico,f"{R}/desktop/build/icon.ico")
ico.save(f"{R}/desktop/build/icon.ico",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("ok")
