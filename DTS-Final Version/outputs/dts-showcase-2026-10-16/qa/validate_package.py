from pathlib import Path
import json,csv,re
from html.parser import HTMLParser
from urllib.parse import unquote,urlsplit
from PIL import Image,ImageOps,ImageDraw
from pypdf import PdfReader
import pdfplumber

OUT=Path(__file__).resolve().parents[1]
QA=OUT/'qa'
plan=json.loads((OUT/'showcase-plan.json').read_text(encoding='utf-8'))
scenes=plan['scenes']
assert len(scenes)==32
assert [s['id'] for s in scenes]==[f'S{i:02}' for i in range(1,33)]
assert sum(s['duration'] for s in scenes)==1920
assert sum(len(s['shots']) for s in scenes)==96
assert sum(s['voiceover_words'] for s in scenes)==3279
for i,s in enumerate(scenes):
    assert (s['start'],s['end'])==(i*60,(i+1)*60)
    assert len(s['voiceover'])==len(s['shots'])==3
    assert (OUT/s['reference_image']).exists()
    assert [t['start'] for t in s['shots']]==[i*60+j*20 for j in range(3)]
    assert [t['end'] for t in s['shots']]==[i*60+(j+1)*20 for j in range(3)]
rows=list(csv.DictReader((OUT/'shot-list.csv').open(encoding='utf-8-sig',newline='')))
assert len(rows)==96
assert [r['Shot'] for r in rows]==[t['id'] for s in scenes for t in s['shots']]
assert [r['Voiceover'] for r in rows]==[v for s in scenes for v in s['voiceover']]
script=(OUT/'SCRIPT.md').read_text(encoding='utf-8')
assert all(f'## {s["id"]} ' in script for s in scenes)
board=(OUT/'STORYBOARD.md').read_text(encoding='utf-8')
assert len(re.findall(r'^## Frame \d+ - ',board,re.M))==32

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.scripts=0
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=='script':self.scripts+=1
        for a in ('href','src'):
            if a in d:self.links.append(d[a])
files=[OUT/'storyboard.html',*sorted((OUT/'boards').glob('*.html'))]
assert len(files)==33
for f in files:
    parser=Links();parser.feed(f.read_text(encoding='utf-8'))
    assert parser.scripts==0
    for link in parser.links:
        u=urlsplit(link)
        assert not u.scheme, (f,link)
        if u.path:assert (f.parent/unquote(u.path)).exists(),(f,link)

pdf=OUT/'DTS-Showcase-Production-Book.pdf'
reader=PdfReader(pdf)
assert len(reader.pages)==40,len(reader.pages)
for i,s in enumerate(scenes):
    text=reader.pages[i+3].extract_text()
    assert s['id']+' '+s['title'] in text,(i+4,s['id'])
    assert all(t['id'] in text for t in s['shots'])
outside=[]
with pdfplumber.open(pdf) as p:
    for n,page in enumerate(p.pages,1):
        outside.extend((n,c['text']) for c in page.chars if c['x0']<0 or c['x1']>page.width+.1 or c['top']<0 or c['bottom']>page.height+.1)
assert not outside,outside

def contact_captures():
    canvas=Image.new('RGB',(4*480,8*355),'#e8eef0')
    d=ImageDraw.Draw(canvas)
    for i,s in enumerate(scenes):
        x=(i%4)*480;y=(i//4)*355
        im=Image.open(OUT/s['reference_image']).convert('RGB')
        canvas.paste(ImageOps.contain(im,(470,326)),(x+5,y+22))
        d.text((x+8,y+4),s['id']+' '+s['title'][:45],fill='black')
    canvas.save(QA/'all-captures-final.png')

def contact_pages():
    pages=sorted(QA.glob('final-page-*.png'))
    if not pages:return
    assert len(pages)==40,len(pages)
    for i in range(0,len(pages),4):
        images=[Image.open(f).convert('RGB') for f in pages[i:i+4]]
        w,h=images[0].size
        sheet=Image.new('RGB',(w*2,h*2),'#d9dfe3')
        for j,im in enumerate(images):sheet.paste(im,((j%2)*w,(j//2)*h))
        sheet.save(QA/f'final-review-{i//4+1:02}.png')

contact_captures();contact_pages()
result={'scenes':32,'shots':96,'masterSeconds':1920,'spokenWords':3279,'htmlFiles':33,'localLinks':'PASS','pdfPages':40,'scenePageMapping':'PASS','outOfPageCharacters':len(outside),'status':'PASS'}
(QA/'package-validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
