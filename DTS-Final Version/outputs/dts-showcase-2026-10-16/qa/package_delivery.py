from pathlib import Path
import hashlib,json,zipfile

OUT=Path(__file__).resolve().parents[1]
ROOT=OUT.parents[1]
plan=json.loads((OUT/'showcase-plan.json').read_text(encoding='utf-8'))
checks=json.loads((OUT/'qa/package-validation.json').read_text())
html=json.loads((OUT/'qa/html-validation.json').read_text())
assert checks['status']==html['status']=='PASS'
assert len(list((OUT/'qa').glob('final-review-*.png')))==10
for e in plan['evidence']:
    if 'sha256' in e:
        assert hashlib.sha256((ROOT/e['file']).read_bytes()).hexdigest()==e['sha256'],e['file']

note='''# Showcase package verification

Verified 16 October 2026 against the current application files and completed stress-test evidence.

- 32 scenes, 96 matching screen beats, 1,920 seconds of planned master timing.
- 3,279 words in the full Taglish narration and a separate three-minute overview.
- All narration and shot IDs match the Markdown, CSV and structured JSON handoff.
- All 32 authentic reference images are present. Captures used a disposable stress database; original business records were not edited.
- 33 static HTML files have valid local resource links and require no internet connection.
- Desktop (1440x1000) and mobile (390x844) browser checks passed: images load, no horizontal overflow, no overlapping overlay/caption areas, and Previous/Next navigation works.
- The PDF contains 40 pages with every scene on its expected page. All final pages were rendered and visually reviewed. Text bounds remain inside the page.
- Referenced application source hashes match the evidence ledger.
- The ZIP contains presentation and planning assets only; capture tools, databases, account secrets and internal QA files are excluded.

The keyframes illustrate framing using different test samples. Complete action footage, a consistent hero-document take, narration recording and a rendered video remain production steps. Recheck configuration and visible dates before a later recording.
'''
(OUT/'VALIDATION.md').write_text(note,encoding='utf-8')
names=['README.md','VALIDATION.md','DTS-Showcase-Production-Book.pdf','SCRIPT.md','SHORT-SCRIPT.md','STORYBOARD.md','BRIEF.md','shot-list.csv','showcase-plan.json','storyboard.html']
files=[OUT/n for n in names]+sorted((OUT/'boards').glob('scene-*.html'))+sorted((OUT/'assets').glob('capture-S*.png'))
assert len(files)==74,len(files)
archive=OUT/'DTS-Taglish-Showcase-Package.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in files:z.write(f,'DTS-Taglish-Showcase/'+f.relative_to(OUT).as_posix())
with zipfile.ZipFile(archive) as z:
    assert not z.testzip()
    assert len(z.namelist())==74
    assert not any('/qa/' in n or n.endswith(('.sqlite','.cjs','.py')) for n in z.namelist())
    for n in z.namelist():
        if n.endswith(('.md','.json','.html','.csv')):
            assert b'Stress@3500!' not in z.read(n),n
result={'status':'PASS','files':74,'archiveBytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'sourceHashes':'PASS','zipIntegrity':'PASS','excludedPrivateCaptureData':'PASS'}
(OUT/'qa/archive-validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
