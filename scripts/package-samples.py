"""Package the three source-reviewed samples without runtime tokens or source files."""
from pathlib import Path
import json, html, zipfile, hashlib
root = Path('evaluations/2026-11-05/project-samples')
projects = ['threadline', 'offstage', 'libra']
esc = html.escape
cards = []
manifest = {'generatedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(), 'passThreshold': 36, 'projects': []}
for name in projects:
    folder = root / name
    review = json.loads((folder / 'review.json').read_text())
    render = json.loads((folder / 'render.json').read_text())
    model = json.loads((folder / 'map.json').read_text())
    item = {'project': name, 'score': review['total'], 'verdict': review['verdict'], 'passes': review['total'] >= 36, 'actors': len(model['nodes']), 'flows': len(model['edges']), 'views': len(render['captures']), 'curatedAfterReview': (folder/'curation.json').exists(), 'verification': model.get('verification'), 'judgeModels': review['actualModels']}
    manifest['projects'].append(item)
    rows = ''.join(f'<tr><td>{esc(s["id"])}</td><td>{s["score"]}/4</td><td>{esc(s["evidence"])}</td></tr>' for s in review['scores'])
    figures = ''.join(f'<figure><a href="{name}/{esc(c["filename"])}"><img loading="lazy" src="{name}/{esc(c["filename"])}" alt="{esc(c["title"])}"></a><figcaption>{i+1}. {esc(c["title"])}</figcaption></figure>' for i,c in enumerate(render['captures']))
    improvements = ''.join(f'<li>{esc(x)}</li>' for x in review['improvements'])
    cards.append(f'<section id="{name}"><h2>{name.title()} <small>{review["total"]}/40 · {esc(review["verdict"])}</small></h2><p>{item["actors"]} actors · {item["flows"]} flows · {item["views"]} views. {"Passes" if item["passes"] else "Below"} the 36/40 Excellent threshold.</p><p>{esc(review["coldRead"])}</p>{figures}<details><summary>Opus 5.5 scores and evidence</summary><table>{rows}</table><h3>Recommended improvements</h3><ul>{improvements}</ul></details></section>')
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
readme = '''VIBEPRINT PROJECT SAMPLES — 2026-11-05

Open index.html to browse real screenshots and Opus 5.5 reviews offline.
Each project includes an editable native Vibeprint canvas plus its architecture graph.

To open an editable sample on your Mac (Node.js 20+):
1. Extract the ZIP.
2. In Terminal, cd into threadline, offstage, or libra inside the extracted folder.
3. Run: VIBEPRINT_MAPPER=off npx --yes https://github.com/viraatdas/vibeprint/releases/download/v0.9.1/vibeprint-0.9.1.tgz serve --root . --no-commit --no-relay
4. Open the localhost URL printed by Vibeprint. Use the Diagram view selector.

These are separate sample folders. Do not overwrite an existing project's .vibeprint folder.
No original repository source, credentials, or runtime tokens are included.
The maps include source-checked corrections after Opus screenshot reviews (see curation.json).
They were checked against source, not verified against running production services.
Excellent requires at least 36/40. Scores are in manifest.json and each review.json.
'''
(root/'README.txt').write_text(readme)
page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vibeprint · Three project samples</title><style>body{margin:0;background:#f5f2e9;color:#292923;font:17px/1.6 system-ui}main{max-width:1200px;margin:auto;padding:36px 24px}h1{font-size:clamp(30px,5vw,56px);line-height:1.1}h2{font-size:30px;margin-bottom:8px}small{font-size:18px;color:#675e55}a{color:#174dac}nav{display:flex;gap:20px;flex-wrap:wrap}section{border-top:1px solid #cfc9bc;padding:30px 0}figure{margin:24px 0}img{width:100%;height:auto;border:1px solid #d4cec1;border-radius:10px}figcaption{font-size:15px;color:#665c51}details{background:white;padding:18px;border-radius:10px}td{padding:12px 8px;border-bottom:1px solid #ddd;vertical-align:top}td:nth-child(2){white-space:nowrap}.download{display:inline-block;background:#174dac;color:white;padding:12px 20px;border-radius:8px;text-decoration:none}p{max-width:95ch}</style><main><p>VIBEPRINT / SOURCE-REVIEWED SAMPLES</p><h1>Three projects.<br>Actual diagrams. Independent reviews.</h1><p>Source-grounded maps of Threadline, Offstage, and Libra, revised after screenshot reviews and source checks. Screenshots show the real Vibeprint app at iPad landscape size. Claude Opus 5.5 judged the screenshots and checked source evidence against the supplied ten-part rubric. Excellent starts at 36/40. Production behavior has not been verified.</p><p><a class="download" href="vibeprint-project-samples.zip" download>Download canvases, screenshots and reviews</a></p><nav><a href="#threadline">Threadline</a><a href="#offstage">Offstage</a><a href="#libra">Libra</a></nav>'''+''.join(cards)+'</main></html>'
(root/'index.html').write_text(page)
archive=root/'vibeprint-project-samples.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for filename in ['index.html','manifest.json','README.txt']: z.write(root/filename,filename)
    for name in projects:
        for filename in ['map.json','review.json','render.json','judge-receipt.json','generator-receipt.json','curation.json']:
            z.write(root/name/filename,f'{name}/{filename}')
        for png in (root/name).glob('*.png'): z.write(png,f'{name}/{png.name}')
        for p in (root/name/'sample'/name/'.vibeprint').iterdir():
            if p.name not in ['canvas.json','graph.json','marks.json','chat.json','sketch.json']: raise ValueError('Unexpected sample state file')
            z.write(p,f'{name}/.vibeprint/{p.name}')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert not any('/runtime/' in p or p.endswith('/token') for p in z.namelist())
    for name in projects:
        assert z.read(f'{name}/.vibeprint/canvas.json') == (root/name/'canvas.json').read_bytes()
(root/'download-verification.json').write_text(json.dumps({'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'bytes':archive.stat().st_size,'canvasBytesMatchRenderedSamples':True,'zipIntegrity':'pass','containsRuntimeSecrets':False},indent=2)+'\n')
print(json.dumps(manifest,indent=2))
print(f'ZIP ready: {archive} ({archive.stat().st_size} bytes)')
