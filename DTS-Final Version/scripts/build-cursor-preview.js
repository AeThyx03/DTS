'use strict';
// The standalone file embeds the same implementation and styles shipped by DTS.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'public/particle-trail.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/particle-trail.css'), 'utf8');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>White Particle Cursor Trail</title><style>
${css}
:root{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#080d15;color:#f3f7ff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
main{width:min(100%,1000px)}header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}
h1{font-size:clamp(22px,4vw,32px);letter-spacing:-.04em;margin:0 0 6px}p{color:#a9b9cd;line-height:1.6;margin:0}
button,input{font:inherit;border:1px solid #486079;background:#17283c;color:#fff;border-radius:8px;padding:10px 14px}
button{cursor:pointer;white-space:nowrap}button:hover{background:#263d57}:focus-visible{outline:3px solid #fff;outline-offset:4px}
.stage{position:relative;isolation:isolate;overflow:hidden;min-height:420px;height:60vh;max-height:650px;border-radius:20px;border:1px solid #2b3c53;display:grid;place-items:center;padding:32px;background:radial-gradient(ellipse at 50% 20%,#1a2941,#10192b 55%,#080e19)}
.stage:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.13;background-image:radial-gradient(#c5dbff 1px,transparent 1px);background-size:22px 22px}
.copy{position:relative;z-index:1;text-align:center;max-width:480px}.copy h2{font-size:clamp(24px,4vw,38px);letter-spacing:-.04em;margin:0 0 12px}
.try{margin-top:24px;display:flex;justify-content:center;flex-wrap:wrap;gap:12px}.try input{min-width:0;width:min(100%,240px)}
.particle-trail-layer{z-index:2}.note{font-size:13px;margin-top:14px}#status{display:block;min-height:24px;color:#cbd9eb}
@media(max-width:600px){body{padding:16px}header{align-items:flex-start;flex-direction:column}.stage{padding:20px;min-height:380px}}
</style></head><body><main>
<header><div><h1>White particle trail</h1><p>A quiet stream of light that follows your pointer.</p></div><button id="toggle" type="button" aria-pressed="true">Particle trail: On</button></header>
<section class="stage" id="preview" aria-label="Interactive particle preview"><div class="copy"><h2>Move your pointer.</h2><p>Move faster for a fuller trail. Slow down and watch the particles drift away.</p><div class="try"><input aria-label="Try typing" placeholder="You can still type here"><button id="try" type="button">Try a click</button></div><p class="note" id="clicks" aria-live="polite">All controls remain interactive.</p></div></section>
<p class="note">48 reusable particles · Native cursor · No external libraries<br><span id="status" role="status"></span></p>
</main><script>
${script}
const trail=createParticleTrail(document.querySelector('#preview'));
const fine=matchMedia('(pointer: fine)'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
let enabled=true, clicks=0;
function update(){trail.setEnabled(enabled);document.querySelector('#toggle').textContent='Particle trail: '+(enabled?'On':'Off');document.querySelector('#toggle').setAttribute('aria-pressed',String(enabled));document.querySelector('#status').textContent=!enabled?'Trail is off.':reduced.matches?'Trail paused: reduced motion is enabled.':!fine.matches?'Trail paused: a fine pointer is required.':'Trail is ready. It rests automatically when your pointer is idle.';}
document.querySelector('#toggle').addEventListener('click',()=>{enabled=!enabled;update();});
document.querySelector('#try').addEventListener('click',()=>{document.querySelector('#clicks').textContent='Click received ('+(++clicks)+').';});
fine.addEventListener('change',update);reduced.addEventListener('change',update);update();
</script></body></html>`;
const out = path.join(root, 'outputs/white-particle-cursor.html');
fs.mkdirSync(path.dirname(out), {recursive:true}); fs.writeFileSync(out, html);
console.log(out);
