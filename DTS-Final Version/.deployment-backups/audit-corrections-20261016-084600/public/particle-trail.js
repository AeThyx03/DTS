'use strict';
/* Reusable decorative trail. The pool is allocated once, only on eligible devices. */
function createParticleTrail(root, eventTarget = root) {
 const fine = matchMedia('(pointer: fine)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const particles = [];
 let enabled = false, listening = false, destroyed = false, layer = null;
 let next = 0, raf = null, lastFrame = 0, lastMove = 0, lastX = null, lastY = null, credit = 0;
 function resetPath() { lastX = lastY = null; credit = 0; }
 function clear() {
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null; lastFrame = 0; resetPath();
  for (const p of particles) { p.active = false; p.element.style.opacity = '0'; }
 }
 function allocate() {
  if (layer) return;
  layer = document.createElement('div'); layer.className = 'particle-trail-layer'; layer.setAttribute('aria-hidden', 'true');
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 48; i++) {
   const element = document.createElement('span'); element.className = 'particle-trail-dot'; fragment.append(element);
   particles.push({element, active:false, x:0, y:0, vx:0, vy:0, size:0, born:0, lifetime:0, opacity:0});
  }
  layer.append(fragment); root.append(layer);
 }
 function emit(x, y, dx, dy, speed, now) {
  const p = particles[next]; next = (next + 1) % particles.length;
  const angle = (Math.hypot(dx, dy) > 0 ? Math.atan2(dy, dx) + Math.PI : Math.random() * Math.PI * 2) + (Math.random() - .5) * 1.9;
  const drift = .3 + Math.random() * 1.25 + Math.min(speed * .5, 1);
  p.active = true; p.x = x + (Math.random() - .5) * 5; p.y = y + (Math.random() - .5) * 5;
  p.vx = Math.cos(angle) * drift; p.vy = Math.sin(angle) * drift;
  p.size = 1.5 + Math.random() * 2.8; p.born = now; p.lifetime = 450 + Math.random() * 650; p.opacity = .35 + Math.random() * .5;
  p.element.style.width = p.element.style.height = p.size + 'px'; p.element.style.opacity = '0';
 }
 function animate(now) {
  raf = null;
  if (!listening || document.hidden) { clear(); return; }
  const dt = Math.min(lastFrame ? now - lastFrame : 16.67, 42) / 16.67; lastFrame = now;
  let alive = false;
  for (const p of particles) {
   if (!p.active) continue;
   const age = now - p.born;
   if (age >= p.lifetime) { p.active = false; p.element.style.opacity = '0'; continue; }
   alive = true; p.x += p.vx * dt; p.y += p.vy * dt;
   const drag = Math.pow(.985, dt); p.vx *= drag; p.vy = p.vy * drag + .006 * dt;
   const progress = age / p.lifetime, scale = 1.15 - progress * .5;
   p.element.style.transform = 'translate3d(' + (p.x - p.size / 2) + 'px,' + (p.y - p.size / 2) + 'px,0) scale(' + scale + ')';
   p.element.style.opacity = (p.opacity * Math.min(1, age / 55) * Math.pow(1 - progress, 1.6)).toFixed(3);
  }
  if (alive || now - lastMove < 2000) raf = requestAnimationFrame(animate);
  else { lastFrame = 0; resetPath(); }
 }
 function move(event) {
  if (document.hidden || event.pointerType === 'touch' || event.isPrimary === false) return;
  const rect = root.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) { resetPath(); return; }
  const now = performance.now();
  if (lastX === null) { emit(x, y, 0, 0, 0, now); }
  else {
   const dx = x - lastX, dy = y - lastY, distance = Math.hypot(dx, dy);
   if (distance < .1) return;
   const speed = distance / Math.max(8, now - lastMove);
   credit = Math.min(10, credit + distance / (14 - Math.min(speed * 4, 8)));
   const count = Math.floor(credit); credit -= count;
   for (let i = 0; i < count; i++) {
    // Stratified jitter avoids a regularly spaced chain of dots.
    const fraction = (i + Math.random()) / count;
    emit(lastX + dx * fraction, lastY + dy * fraction, dx, dy, speed, now);
   }
  }
  lastX = x; lastY = y; lastMove = now;
  if (raf === null) raf = requestAnimationFrame(animate);
 }
 function leave(event) { if (!event.relatedTarget) resetPath(); }
 function sync() {
  const allowed = !destroyed && enabled && fine.matches && !reduced.matches && !document.hidden;
  if (allowed === listening) return;
  listening = allowed;
  if (allowed) {
   allocate(); resetPath();
   eventTarget.addEventListener('pointermove', move, {passive:true});
   eventTarget.addEventListener('pointerleave', resetPath, {passive:true});
   eventTarget.addEventListener('pointerout', leave, {passive:true});
   window.addEventListener('resize', resetPath, {passive:true});
   window.addEventListener('scroll', resetPath, {passive:true, capture:true});
  } else {
   eventTarget.removeEventListener('pointermove', move); eventTarget.removeEventListener('pointerleave', resetPath); eventTarget.removeEventListener('pointerout', leave);
   window.removeEventListener('resize', resetPath); window.removeEventListener('scroll', resetPath, true); clear();
  }
 }
 fine.addEventListener('change', sync); reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
 return {
  setEnabled(value) { enabled = value === true; sync(); },
  destroy() {
   if (destroyed) return;
   destroyed = true; sync(); clear(); layer?.remove();
   fine.removeEventListener('change', sync); reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
  }
 };
}
