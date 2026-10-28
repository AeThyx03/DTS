from pathlib import Path
import json, html, re, textwrap

OUT=Path(__file__).resolve().parent
PLAN=json.loads((OUT/'showcase-plan.json').read_text(encoding='utf-8'))
S=PLAN['scenes']
esc=lambda v:html.escape(str(v),quote=True)

CSS='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font:16px/1.6 "Segoe UI",Arial,sans-serif;background:#f1f4f5;color:#15232b}a{color:#0e5a63}header{max-width:1360px;margin:auto;padding:48px 32px 28px}h1{font-size:clamp(30px,4vw,52px);line-height:1.08;max-width:1050px;margin:16px 0;color:#000}h2,h3{color:#000;line-height:1.2}.kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0e5a63;font-weight:700}.intro{max-width:950px}.facts{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.facts span{background:#ddeef0;color:#0a4249;padding:10px 14px;border-radius:7px}.toc{display:flex;flex-wrap:wrap;gap:7px;margin-top:20px}.toc a,.nav a{padding:6px 11px;background:white;border:1px solid #d6dee3;border-radius:5px;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-width:1360px;margin:auto;gap:26px;padding:0 32px 48px}.card{background:white;border:1px solid #d6dee3;border-radius:12px;padding:22px;break-inside:avoid;scroll-margin-top:20px}.meta{font-size:12px;color:#64747e;margin-bottom:12px}.card h2{font-size:23px;margin:10px 0}.frame{aspect-ratio:16/9;position:relative;overflow:hidden;border-radius:8px;background:#0d2a30;color:white;border:1px solid #17404a;isolation:isolate}.frame img.capture{width:100%;height:100%;object-fit:cover;object-position:top;opacity:.52}.frame .label{position:absolute;top:6%;left:5%;font-size:clamp(8px,.85vw,13px);background:#fff;color:#15232b;padding:3px 7px;letter-spacing:.04em}.frame .headline{position:absolute;left:5%;top:19%;width:88%;font-size:clamp(17px,2.1vw,32px);font-weight:700;line-height:1.14;text-shadow:0 1px 3px #0d2a30}.frame .slot{position:absolute;left:5%;right:5%;top:44%;bottom:20%;border:1px dashed #84a5ab;border-radius:5px;background:rgba(13,42,48,.86);padding:12px;display:flex;flex-direction:column;justify-content:center;gap:4px}.frame .slot strong{font-size:clamp(10px,1.1vw,16px)}.frame .slot small{color:#cadcdf;font-size:clamp(8px,.85vw,13px)}.frame .safe{position:absolute;bottom:0;left:0;right:0;height:17%;display:grid;place-items:center;border-top:1px dashed #84a5ab;background:rgba(8,25,29,.93);font-size:clamp(8px,.8vw,12px);color:#cadcdf}.steps{margin:16px 0;padding-left:20px;font-size:14px}.steps li{margin:8px 0}.note{font-size:13px;color:#3a4c57;background:#f1f4f5;padding:12px;border-left:3px solid #0e5a63}details{margin-top:12px}summary{cursor:pointer;color:#0e5a63;font-weight:600}.vo{font-size:14px}.nav{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:18px}.bottom{max-width:1296px;margin:0 auto 40px;background:#fff;border:1px solid #d6dee3;padding:24px;border-radius:10px}.tokens{display:flex;gap:12px;flex-wrap:wrap}.token{padding:8px 12px;border:1px solid #d6dee3}.single{max-width:1280px;margin:24px auto;padding:0 24px}.single .frame .headline{font-size:clamp(28px,4vw,56px)}.single .frame .label{font-size:14px}.single .frame .slot strong{font-size:24px}.single .frame .slot small{font-size:16px}.single .frame .safe{font-size:15px}.single .notes{background:#fff;padding:20px;border-radius:8px}footer{padding:20px 32px;color:#64747e;font-size:12px}@media(max-width:850px){.grid{grid-template-columns:1fr;padding:0 16px 30px}header{padding:30px 18px}.frame .headline{font-size:clamp(23px,4.7vw,35px)}.frame .label{font-size:10px}.frame .slot strong{font-size:14px}.frame .slot small{font-size:11px}.frame .safe{font-size:9px}.single .frame .slot strong{font-size:16px}.single .frame .slot small{font-size:12px}}@media print{html{scroll-behavior:auto}body{background:white}.grid{display:block;padding:0}.card{page-break-after:always;border:0;margin:0;padding:12px}.frame .headline{font-size:28px}.frame .label,.frame .slot small,.frame .safe{font-size:11px}.frame .slot strong{font-size:17px}.toc,.nav{display:none}details{display:block}header{padding:15px}.bottom{page-break-before:always}a{color:inherit}}'''

CSS+='''.frame.has-capture img.capture{opacity:1}.frame.has-capture .slot{display:none}.frame.has-capture .label{top:4%;left:3%;font-size:clamp(7px,.7vw,10px);box-shadow:0 1px 4px #15232b66}.frame.has-capture .headline{top:auto;bottom:20%;left:3%;width:94%;font-size:clamp(15px,1.7vw,25px);padding:7px 10px;background:rgba(8,25,29,.92);border-radius:3px}.single .frame.has-capture .headline{font-size:clamp(18px,3vw,40px)}.single .frame.has-capture .label{font-size:clamp(7px,1.1vw,14px)}@media(max-width:850px){.frame.has-capture .headline{font-size:clamp(14px,3.1vw,25px)}.frame.has-capture .label{font-size:7px}.frame .safe{font-size:clamp(6px,1.6vw,10px)}.single .frame .safe{font-size:clamp(7px,1.5vw,14px)}}'''

def frame(s,prefix=''):
    image='capture-'+s['id']+'.png'
    image_html=f'<img class="capture" alt="Authentic DTS reference screen for {esc(s["title"])}" src="{prefix}assets/{image}">' if (OUT/'assets'/image).exists() else ''
    status='REFERENCE STILL AND PLANNED EDITORIAL OVERLAY' if image_html else 'PLANNED SCREEN CAPTURE'
    css_class=' has-capture' if image_html else ''
    return f'''<div class="frame{css_class}" aria-label="Storyboard keyframe {s['id']}">{image_html}<span class="label">{s['id']} · {status}</span><div class="headline">{esc(s['overlay'])}</div><div class="slot"><strong>{esc(s['title'])}</strong><small>{esc(s['role'])}</small><small>{esc(s['route'])}</small></div><div class="safe">Caption area · lower 17 percent · do not place essential controls here</div></div>'''

def render_html():
    intro='''<header><div class="kicker">POSSD Document Tracking and Routing System</div><h1>DTS staff showcase storyboard</h1><p class="intro">A Taglish staff demonstration following one document from registration to release, then reports, scheduling, administration and measured proof. All 32 keyframes use authentic reference stills captured from a disposable stress-test copy. Planned overlays show editorial framing; the matching screen beats guide the final recording.</p><div class="facts"><span>32 scenes</span><span>96 capture beats</span><span>32 minute master</span><span>3 minute alternate cut</span></div><p><a href="SCRIPT.md">Editable script</a> · <a href="DTS-Showcase-Production-Book.pdf">Printable production book</a> · <a href="shot-list.csv">CSV shot list</a> · <a href="showcase-plan.json">Generation handoff JSON</a> · <a href="SHORT-SCRIPT.md">Three minute cut</a></p><p>Open an individual frame for presentation. Its Previous and Next links follow the scene order; press F11 for browser fullscreen. Expand narration when rehearsing. Timecodes are estimates until voice and screen recordings are locked.</p><nav class="toc">'''
    intro+=''.join(f'<a href="#frame-{i:02}">{s["id"]}</a>' for i,s in enumerate(S,1))+'</nav></header>'
    cards=[]
    boards=OUT/'boards';boards.mkdir(exist_ok=True)
    for i,s in enumerate(S,1):
        steps='<ol class="steps">'+''.join(f'<li><b>{shot["id"]}</b> {esc(shot["action"])}</li>' for shot in s['shots'])+'</ol>'
        narration='<details><summary>Taglish narration and matching cues</summary><div class="vo">'+''.join(f'<p><b>{s["id"]}-{j+1}</b> {esc(vo)}</p>' for j,vo in enumerate(s['voiceover']))+'</div></details>'
        meta=f'{s["id"]} / {s["timecode"]} / {s["chapter"]}'
        content=f'<p class="meta">{esc(meta)}</p><h2>{esc(s["title"])}</h2>'+frame(s)+steps+f'<p class="note">{esc(s["presenter_note"])}</p>'+narration+f'<div class="nav"><a href="boards/scene-{i:02}.html">Open presentation frame</a><span class="meta">Evidence {esc(", ".join(s["evidence"]))}</span></div>'
        cards.append(f'<article class="card" id="frame-{i:02}">{content}</article>')
        prev=f'<a href="scene-{i-1:02}.html">Previous</a>' if i>1 else '<span></span>'
        nxt=f'<a href="scene-{i+1:02}.html">Next</a>' if i<len(S) else '<span>End of storyboard</span>'
        standalone=f'<!doctype html><html lang="fil"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{esc(s["id"]+" "+s["title"])}</title><style>{CSS}</style></head><body><main class="single"><p class="meta">{esc(meta)}</p>{frame(s,"../")}<nav class="nav">{prev}<a href="../storyboard.html#frame-{i:02}">All scenes</a>{nxt}</nav><details class="notes"><summary>Presenter notes and narration</summary>{steps}<p class="note">{esc(s["presenter_note"])}</p>'+''.join(f'<p>{esc(v)}</p>' for v in s['voiceover'])+'</details></main></body></html>'
        (boards/f'scene-{i:02}.html').write_text(standalone,encoding='utf-8')
    seam='<section class="bottom"><h2>Seam map</h2><p>Keep the hero tracking number visible through S07-S14. Use a completed result as the bridge into the next scene. Use brief title transitions only between Orientation, Finding work, Lifecycle, Reports, Scheduling, Monitoring, Administration, Operations and Closing.</p><p>Hold the clearance state in S12 before showing the separate release in S14. Keep the current-scope label on Workflow Designer in S29 and the date and workload labels on performance proof in S31.</p><h2>Visual tokens and capture rules</h2><div class="tokens"><span class="token">Teal #0E5A63</span><span class="token">Sidebar #0D2A30</span><span class="token">Paper #F1F4F5</span><span class="token">White cards</span></div><p>Use authentic DTS recordings, local fonts and readable crops. No invented upload buttons, email automation, parallel approvals, signatures or designer execution. No passwords, cookies, private backup contents or unlabelled production mutations.</p></section>'
    doc=f'<!doctype html><html lang="fil"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DTS staff showcase storyboard</title><style>{CSS}</style></head><body>{intro}<main class="grid">'+''.join(cards)+f'</main>{seam}<footer>Script and storyboard planning package · 16 October 2026 · Taglish staff demonstration</footer></body></html>'
    (OUT/'storyboard.html').write_text(doc,encoding='utf-8')

def build_pdf():
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable, KeepTogether, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    page_w,page_h=A4
    styles=getSampleStyleSheet()
    for key in ['Title','Heading1','Heading2','Heading3']:
        styles[key].textColor=colors.black
    styles['Title'].fontName='Helvetica-Bold';styles['Title'].fontSize=28;styles['Title'].leading=32
    styles['Heading1'].fontName='Helvetica-Bold';styles['Heading1'].fontSize=18;styles['Heading1'].leading=22;styles['Heading1'].spaceAfter=10
    styles['Heading2'].fontSize=12;styles['Heading2'].leading=15;styles['Heading2'].spaceBefore=9;styles['Heading2'].spaceAfter=5
    styles.add(ParagraphStyle(name='TextDTS',fontName='Helvetica',fontSize=10.2,leading=13.5,spaceAfter=7,textColor=colors.HexColor('#15232B')))
    styles.add(ParagraphStyle(name='SmallDTS',parent=styles['TextDTS'],fontSize=8.5,leading=11,spaceAfter=5))
    styles.add(ParagraphStyle(name='MetaDTS',parent=styles['TextDTS'],fontSize=8.2,leading=10.5,textColor=colors.HexColor('#64747E'),spaceAfter=8))
    styles.add(ParagraphStyle(name='TableDTS',parent=styles['SmallDTS'],fontSize=8.1,leading=10.5,spaceAfter=0))
    styles.add(ParagraphStyle(name='TableHeadDTS',parent=styles['TableDTS'],fontName='Helvetica-Bold',textColor=colors.white))
    story=[]
    def p(text,style='TextDTS'):return Paragraph(esc(text),styles[style])
    def add(text,style='TextDTS'):story.append(p(text,style))
    def title(text):add(text,'Heading1')
    def bullet(text):story.append(Paragraph('&#8226; '+esc(text),styles['TextDTS']))
    def table(headers,rows,widths):
        data=[[p(x,'TableHeadDTS') for x in headers]]+[[p(x,'TableDTS') for x in row] for row in rows]
        t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0D2A30')),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F1F4F5')])]))
        story.append(t)
    class Board(Flowable):
        def __init__(self,s):Flowable.__init__(self);self.s=s;self.width=480;self.height=270
        def draw(self):
            c=self.canv;s=self.s;w=self.width;h=self.height
            c.setFillColor(colors.HexColor('#0D2A30'));c.roundRect(0,0,w,h,7,fill=1,stroke=0)
            image=OUT/'assets'/('capture-'+s['id']+'.png')
            if image.exists():
                reader=ImageReader(str(image));iw,ih=reader.getSize();image_h=w*ih/iw
                c.saveState();clip=c.beginPath();clip.rect(0,0,w,h);c.clipPath(clip,stroke=0)
                c.drawImage(reader,0,h-image_h,width=w,height=image_h);c.restoreState()
            c.setFillColor(colors.white);c.rect(12,h-25,340,15,fill=1,stroke=0)
            c.setFillColor(colors.HexColor('#15232B'));c.setFont('Helvetica-Bold',6.7);c.drawString(17,h-20,s['id']+'  REFERENCE STILL  /  PLANNED EDITORIAL OVERLAY')
            lines=textwrap.wrap(s['overlay'],width=57)
            c.setFillColor(colors.HexColor('#08191D'));c.roundRect(12,55,w-24,15+19*len(lines),3,fill=1,stroke=0)
            c.setFillColor(colors.white);c.setFont('Helvetica-Bold',15)
            for j,line in enumerate(lines):c.drawString(20,64+19*(len(lines)-1-j),line)
            c.setFillColor(colors.HexColor('#08191D'));c.rect(0,0,w,h*.17,fill=1,stroke=0);c.setFillColor(colors.HexColor('#CADCDF'));c.setFont('Helvetica',8)
            c.drawCentredString(w/2,19,'CAPTION SAFE AREA   /   lower 17 percent')
    add('DTS Staff Showcase Script and Storyboard','Title');story.append(Spacer(1,16))
    add('Taglish staff demonstration','Heading1')
    add('A complete presenter and production guide for showing the current Document Tracking and Routing System from registration to release, with reporting, scheduling, administration and measured performance.')
    table(['Master','Scenes','Capture beats','Alternate cut'],[['32 minutes with demo holds','32','96','3 minutes']],[140,90,115,160])
    story.append(Spacer(1,18));title('How to use this book')
    for text in ['Read only the Spoken narration aloud. Screen beats and presenter cues are production notes.','Keep the same scene ID across this book, SCRIPT.md, storyboard.html and shot-list.csv.','All 32 keyframes use authentic reference stills from a disposable stress-test copy. Record the indicated actions for the final video; stills illustrate framing and do not show every beat.','The master has 3,279 spoken words, about 25 minutes at 130 words per minute. The rest of the schedule allows actions, reading results and role switches.','For a live staff session, allow an additional 5-10 minutes for questions and guided practice.']:
        bullet(text)
    story.append(Spacer(1,15));add('Production defaults','Heading2');add('1920x1080 landscape. Readable desktop browser scale. Warm instructional Taglish. Actual UI labels remain in English. Background music and any generated visual inserts are optional later production choices.')
    add('16 October 2026','MetaDTS');story.append(PageBreak())
    title('Demonstration cast and preparation')
    table(['Role','Enrolled person','Username'],[(r,n,u) for r,n,u,t in PLAN['cast']],[116,271,118]);story.append(Spacer(1,12))
    for text in ['Use an approved disposable test copy. Wait for the stress launcher RESULT before manually editing its records.','Prepare a hero document, a reassignment example, a return-to-sender example, one regional report and one generated Special Report.','Use separate browser contexts or profiles for role recordings. Mask passwords and never show credential files.','Check active references, current holidays, designated regional staff, manager presence and OIC configuration before filming.','Keep the tracking number consistent in the ordinary lifecycle. Prepare independent takes for historical and deadline examples.','Record with selected period, division and filter labels visible. Restore any changed test configuration after each exceptional-path demonstration.']:
        bullet(text)
    story.append(PageBreak());title('Chapter map and production direction')
    rows=[]
    for chap in dict.fromkeys(s['chapter'] for s in S):
        parts=[s for s in S if s['chapter']==chap];rows.append((chap,f'{parts[0]["timecode"].split("-")[0]}-{parts[-1]["timecode"].split("-")[1]}',parts[0]['id']+'-'+parts[-1]['id']))
    table(['Chapter','Planned time','Scenes'],rows,[266,130,109]);story.append(Spacer(1,14))
    add('Recording and editing','Heading2')
    add('Use the same hero tracking-number callout through the document lifecycle. Hold every changed status for at least three seconds. End a scene on a completed action before the next account or module appears. Reserve the lower 17 percent for captions and avoid covering controls.')
    add('Factual boundaries','Heading2')
    add('Clearance and release are separate. File URLs are external links. The Workflow Designer is drafting, publishing and simulation; live generic designer execution is not enabled. Department-wide viewing and division-destination permissions are distinct. Stress results describe one dated workload and machine.')
    story.append(PageBreak())
    for s in S:
        title(s['id']+' '+s['title']);add(s['timecode']+' | '+s['chapter']+' | '+s['role'],'MetaDTS')
        story.append(Board(s));story.append(Spacer(1,8))
        add('Spoken narration','Heading2')
        for voice in s['voiceover']:add(voice)
        add('Matching screen beats','Heading2')
        for shot in s['shots']:add(shot['id']+'  '+shot['action'],'SmallDTS')
        add('Presenter cue  '+s['presenter_note'],'SmallDTS');add('Evidence '+', '.join(s['evidence'])+' | Route '+s['route'],'MetaDTS')
        story.append(PageBreak())
    for half in [PLAN['short_script'][:5],PLAN['short_script'][5:]]:
        title('Three minute overview')
        add('Alternate cut using the matching master scenes. Retiming follows the actual narration recording.','MetaDTS')
        for tc,ids,voice in half:add(tc+'  '+ids,'Heading2');add(voice)
        story.append(PageBreak())
    title('Coverage and scene lookup')
    table(['Scene','Aspect shown'],[(s['id'],s['title']) for s in S],[55,450]);story.append(PageBreak())
    title('Recording checklist and staff practice')
    for text in ['Verify UI labels and exact configured values against the application on recording day.','Capture a successful action, its new status and the corresponding history entry in the same take when possible.','Use separate test examples for due-soon, due-today, overdue, completed-on-time and completed-late states.','Keep the Workflow Designer scope label visible. Do not synthesize email notifications, direct uploads, signatures or parallel approvals.','Check exports for selected scope and row count. Use test-only examples for restore, deactivation and destructive controls.','Use the dated stress report for all capacity statements; p95 is not average screen-load time.','After recording, compare all scene IDs, timecodes, subtitles and shot-list rows. Replace planning slots with actual narration and capture durations.']:
        bullet(text)
    add('Guided practice','Heading2');add('Have each enrolled role perform its assigned step on one sample document. Ask the staff member to identify the current desk, due state, available action and required input. End by checking release recipient, status and full movement history.')
    add('Discussion prompts','Heading2');add('When does the processing clock start? What changes after clearance? How is compliance different from return to sender? Why can an Overdue Stay list contain a stalled record? What is the difference between a CSV export and a full backup? Which designer operations are live today?')
    add('Pronunciation','Heading2');add('Spell D T S, C M E D, C M S D, C M R and P P R clearly. Read OIC as O I C. Explain p95 as the latency within which 95 percent of measured requests completed. Read working days as araw ng trabaho when a plain-language explanation helps.')
    story.append(PageBreak());title('Evidence and production handoff')
    add('Source locations support the factual claims and production cues. Scene-level evidence identifiers refer to this list. Recheck the current application before recording a later version.','SmallDTS')
    for item in PLAN['evidence']:
        add(item['id']+'  '+item['file'],'Heading2')
        if item['locations']:add('; '.join(x['anchor']+' at line '+str(x['line']) for x in item['locations']),'SmallDTS')
        elif item.get('scope'):add(item['scope'],'SmallDTS')
    add('Companion files','Heading2');add('SCRIPT.md is the editable narration and presenter guide. STORYBOARD.md carries frame metadata. storyboard.html is the visual review sheet and links to individual presentation frames. shot-list.csv contains all 96 capture beats. showcase-plan.json carries exact text, timings, screen routes and scene-specific generation constraints. SHORT-SCRIPT.md contains the alternate overview.','SmallDTS')
    add('Capture state','Heading2');add('This is the script and storyboard deliverable. All 32 keyframes contain authentic reference stills captured from a disposable stress-test copy, with planned editorial overlays. Separate samples illustrate different stages; the final lifecycle recording should follow one consistent tracking number. Voice, recordings, final animation and video render are later production steps.','SmallDTS')
    def page(c,doc):
        c.saveState();c.setFillColor(colors.HexColor('#64747E'));c.setFont('Helvetica',8);c.drawString(45,24,'DTS staff showcase | Taglish | 16 October 2026');c.drawRightString(page_w-45,24,str(doc.page));c.restoreState()
    doc=SimpleDocTemplate(str(OUT/'DTS-Showcase-Production-Book.pdf'),pagesize=A4,rightMargin=45,leftMargin=45,topMargin=38,bottomMargin=40,title=PLAN['title'],author='DTS showcase production')
    doc.build(story,onFirstPage=page,onLaterPages=page)

if __name__=='__main__':
    render_html();build_pdf();print('HTML storyboard and PDF production book created')
