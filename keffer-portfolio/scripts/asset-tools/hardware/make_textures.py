"""Small PS2-style textures, with a sourced Switch HOME screenshot."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math, random

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'artwork/hardware/textures'
OUT.mkdir(parents=True, exist_ok=True)
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
MONO = '/System/Library/Fonts/Supplemental/Andale Mono.ttf'
def font(n, bold=False): return ImageFont.truetype(BOLD if bold else FONT, n)
def save(im, name): im.save(OUT / (name + '.png'), optimize=True)

COLORS = {
    'space': '#33373c', 'edge': '#555b63', 'black': '#101216', 'rubber': '#292b30',
    'silver': '#b6bec5', 'bright': '#d7dce0', 'white': '#eeeef0', 'ivory': '#cfd1d4',
    'blue': '#063a91', 'blueEdge': '#165eb4', 'shieldBlue': '#245abd', 'shieldDark': '#164496',
    'red': '#ed351c', 'gold': '#d6aa36', 'bronze': '#332c26', 'bronzeEdge': '#6b6255',
    'cyan': '#04b9d3', 'coral': '#fa443c', 'glass': '#0b1423', 'lens': '#223c53',
    'green': '#63e5aa', 'darkSilver': '#8a929c', 'cream': '#e5d9b3', 'gray': '#757c85',
    'charcoal': '#363232', 'deepBlue': '#10285d', 'lightBlue': '#87bedb', 'ink': '#06080b',
    'screen': '#bcc6ce', 'steel': '#a0aab8', 'whiteBright': '#ffffff', 'warmGray': '#a19c98',
}
random.seed(31)
palette = Image.new('RGB', (256, 128))
pd = ImageDraw.Draw(palette)
for i, (name, color) in enumerate(COLORS.items()):
    rgb = tuple(bytes.fromhex(color[1:])); ox=i%8*32; oy=i//8*32
    for y in range(32):
        for x in range(32):
            n=random.choice([-2,-1,0,0,0,1,2])
            palette.putpixel((ox+x,oy+y), tuple(max(0,min(255,v+n)) for v in rgb))
save(palette,'finish-palette')
(OUT/'palette.json').write_text(json.dumps({k:i for i,k in enumerate(COLORS)},indent=2))

# Glyph sheet: actual UV-mapped legends, not hundreds of text meshes.
glyphs='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' + '←↑→↓+-=<>?!@#$%&*()[]:;.,/\\' + '⌘'
for variant, color in [('light','#c6c9cf'),('dark','#373b40')]:
    im=Image.new('RGBA',(512,256),(0,0,0,0)); d=ImageDraw.Draw(im)
    for i,c in enumerate(glyphs):
        d.text((i%16*32+16,i//16*32+16),c,font=font(18),fill=color,anchor='mm')
    save(im,'keys-'+variant)
(OUT/'glyphs.json').write_text(json.dumps({c:[i%16*32,i//16*32,32,32] for i,c in enumerate(glyphs)}))

# Decals drawn at final pixel resolution.
atlas=Image.new('RGBA',(512,512)); d=ImageDraw.Draw(atlas); regions={}
def label(name,text,rect,size=22,color='#d6d9dd',bold=False):
    x,y,w,h=rect; regions[name]=rect
    d.text((x+w/2,y+h/2),text,font=font(size,bold),fill=color,anchor='mm')
regions['apple']=[0,0,128,128]
# Faceted, monochrome Apple silhouette, including the right bite and separate leaf.
pts=[(65,36),(80,30),(96,33),(103,43),(92,52),(90,65),(96,77),(105,82),(97,99),(87,113),(77,117),(64,113),(54,117),(43,114),(30,96),(23,77),(23,57),(30,41),(43,33),(54,33)]
d.polygon(pts,fill='#c9cbd0');d.polygon([(62,28),(66,14),(81,6),(80,19),(72,28)],fill='#c9cbd0')
label('panasonic','Panasonic',(128,0,256,48),30,'#dce7ef',True)
label('letsnote',"Let's note",(128,48,256,40),24,'#363c43')
label('bose','BOSE',(0,128,160,64),42,'#424b56',True)
label('dsi','Nintendo DSi XL',(160,128,240,48),24,'#b5a69b')
label('switch','NINTENDO SWITCH',(0,200,256,48),22,'#949ca6',True)
label('model','CF-SX1',(256,200,128,48),18,'#343a41')
label('L','L',(400,0,48,48),24,'#69717c')
label('R','R',(448,0,48,48),24,'#69717c')
label('start','START',(0,260,96,32),12,'#a3a5a7')
label('select','SELECT',(96,260,96,32),12,'#a3a5a7')
label('power','POWER',(192,260,96,32),12,'#a3a5a7')
label('dvd','DVD MULTI',(288,260,144,32),14,'#5e666e',True)
label('macbook','MacBook Pro',(0,300,224,36),18,'#9299a4')
label('macmini','Mac mini',(224,300,180,36),19,'#737b86')
label('designed','Designed by Apple in California',(0,352,384,28),14,'#8b929c')
label('2ds','New Nintendo 2DS XL',(0,400,384,40),23,'#64748a')
darkmark=atlas.crop((0,0,128,128))
darkmark.paste((38,43,49),mask=darkmark.getchannel('A'))
atlas.paste(darkmark,(384,384))
regions['apple-dark']=[384,384,128,128]
save(atlas,'decals');(OUT/'decals.json').write_text(json.dumps(regions,indent=2))

def screen(name,w,h,kind):
    im=Image.new('RGB',(w,h));d=ImageDraw.Draw(im)
    if kind in ['mac','panasonic','phone']:
        for y in range(h):
            for x in range(w):
                u=x/w;v=y/h
                wave=math.sin(u*7+v*3)+math.cos(v*9-u*4)
                if kind=='mac':
                    bands=[(33,57,63),(36,85,75),(164,101,48),(199,139,68),(108,66,49)]
                    c=bands[int((u*2+v*2+0.25*wave)*1.5)%len(bands)]
                    im.putpixel((x,y),tuple(int(a*(0.75+0.25*(1-v))) for a in c))
                elif kind=='panasonic':
                    val=max(0,min(1,0.35+0.15*wave+v*.3));im.putpixel((x,y),(int(10+30*val),int(70+90*val),int(132+98*val)))
                else:
                    r=((u-.5)**2*3+(v-.5)**2)**.5
                    c=int(25+70*max(0,1-abs(r-.45)*6));im.putpixel((x,y),(c,int(c*.8),int(c*.72)))
        d=ImageDraw.Draw(im)
    if kind=='mac':
        d.rectangle((0,0,w,13),fill='#d8d2bc');d.text((7,2),'●  Finder   File   Edit   View   Go   Window   Help',font=font(8),fill='#252830')
        d.text((w-49,2),'Mon  9:41',font=font(8),fill='#252830')
        dx=w//2-104;d.rounded_rectangle((dx,h-40,dx+208,h-7),radius=8,fill='#949c99')
        for i,c in enumerate(['#569de0','#dedee0','#ed6653','#528bc5','#d7d8de','#eee5c4','#659e51','#736ca5']):
            x=dx+8+i*24;d.rounded_rectangle((x,h-35,x+19,h-15),radius=4,fill=c);d.line((x+4,h-28,x+14,h-22),fill='white',width=2)
    elif kind=='panasonic':
        d.rectangle((0,0,w,h),fill='#11151d')
        d.rectangle((0,0,w,20),fill='#252c36')
        mono=ImageFont.truetype(MONO,10)
        tiny=ImageFont.truetype(MONO,9)
        d.text((10,5),'arch@letsnote: ~',font=tiny,fill='#b5bdc8')
        d.text((12,29),'[arch@letsnote ~]$ neofetch',font=mono,fill='#d8e1e7')
        logo=["                   -`", "                  .o+`", "                 `ooo/", "                `+oooo:", "               `+oooooo:", "               -+oooooo+:", "             `/:-:++oooo+:", "            `/++++/+++++++:", "           `/++++++++++++++:", "          `/+++ooooooooooooo/`", "         ./ooosssso++osssssso+`", "        .oossssso-````/ossssss+`", "       -osssssso.      :ssssssso.", "      :osssssss/        osssso+++.", "     /ossssssss/        +ssssooo/-", "   `/ossssso+/:-        -:/+osssso+-", "  `+sso+:-`                 `.-/+oso:", " `++:.                           `-/+/", " .`                                 `/"]
        for i,line in enumerate(logo):d.text((6,57+i*10),line,font=tiny,fill='#1793d1')
        info=[('arch@letsnote',''),('-------------',''),('OS','Arch Linux x86_64'),('Host','Panasonic CF-SX1'),('CPU','Intel Core i5'),('GPU','Intel HD Graphics 3000'),('Display','1600 x 900'),('Shell','bash'),('Theme','Mariana Blue')]
        for i,(key,value) in enumerate(info):
            y=62+i*17
            d.text((257,y),key+(':' if value else ''),font=mono,fill='#1793d1')
            if value:d.text((309,y),value,font=mono,fill='#d1d7df')
        for i,c in enumerate(['#262d36','#ca686b','#7fa878','#d5b476','#7fa3c1','#a88fb2','#70aaa7','#ccd1d7']):d.rectangle((257+i*24,227,279+i*24,239),fill=c)
        d.text((12,267),'[arch@letsnote ~]$ _',font=mono,fill='#d8e1e7')
    elif kind=='phone':
        d.text((w/2,40),'Monday, September 14',font=font(10),fill='#dad4d2',anchor='mm')
        d.text((w/2,76),'9:41',font=font(45),fill='#ece8e5',anchor='mm')
        d.rounded_rectangle((w/2-32,h-13,w/2+32,h-9),radius=2,fill='#e2e3e5')
        for x in [26,w-26]:d.ellipse((x-11,h-56,x+11,h-34),fill='#434447')
    elif kind in ['dsi-top','ds-bottom','2ds-top']:
        d.rectangle((0,0,w,h),fill='#dce1e2')
        for x in range(0,w,8):d.line((x,0,x,h),fill='#d0d7d9')
        for y in range(0,h,8):d.line((0,y,w,y),fill='#d0d7d9')
        d.rectangle((0,0,w,19),fill='#b0bbc2');d.text((8,5),'09 / 14     9:41',font=font(9),fill='#405766')
        if kind=='dsi-top':
            d.text((w/2,h/2-12),'Nintendo DSi',font=font(25),fill='#536a78',anchor='mm')
            d.text((w/2,h/2+18),'PHOTO ALBUM',font=font(10),fill='#697e8a',anchor='mm')
        elif kind=='2ds-top':
            d.rectangle((0,19,w,h),fill='#163e6c')
            for cx,cy in [(w/2,48),(w/2-24,88),(w/2+24,88)]:d.polygon([(cx,cy),(cx-24,cy+40),(cx+24,cy+40)],fill='#e1b83e')
            d.text((w/2,h-21),'HYLIAN SHIELD',font=font(11),fill='#dad8c2',anchor='mm')
        else:
            for i,c in enumerate(['#6c99bd','#da9350','#819b55','#b17487']):
                x=18+i*(w-36)//4;d.rounded_rectangle((x,53,x+37,93),radius=4,fill='#eef0ee',outline=c,width=2);d.rectangle((x+10,63,x+27,81),fill=c)
            d.text((w/2,h-24),'Touch to start',font=font(11),fill='#4c5b67',anchor='mm')
    elif kind=='switch':
        # Actual Nintendo Switch HOME UI (2017 screenshot; URL in source ledger).
        source=ROOT/'scripts/asset-tools/hardware/references/switch-home-original.png'
        im=Image.open(source).convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
    save(im,name)
screen('screen-macbook',512,320,'mac')
screen('screen-panasonic',512,288,'panasonic')
screen('screen-iphone',192,416,'phone')
screen('screen-dsi',256,192,'dsi-top')
screen('screen-2ds',400,240,'2ds-top')
screen('screen-touch',320,240,'ds-bottom')
screen('screen-switch',512,288,'switch')
print('Created palette, glyph sheets, decal atlas, and seven screen textures:',OUT)
