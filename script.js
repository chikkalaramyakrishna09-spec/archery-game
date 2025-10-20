// Final script: side-view full-person archer, faster arrows, 10-target sequential behavior,
// targets relocate after hit or 5s, hit messages + voice feedback.
// Place this in script.js

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
window.addEventListener('resize', ()=>{ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; });

const scoreEl = document.getElementById('score');
const modeEl  = document.getElementById('mode');
const params  = new URLSearchParams(window.location.search);
const mode    = (params.get('mode') || 'moving');
modeEl.textContent = mode === 'moving' ? 'Moving Targets' : 'Standard (10 targets)';

let arrows = [];       // {x,y,vx,vy,angle,spawn}
let targets = [];      // for moving: moving objects; for standard: up to 10
let messages = [];     // floating hit messages {text,x,y,alpha,dy}
let score = 0;
scoreEl.textContent = score;

let mouse = {x: W/2, y: H/2};
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});

// hold-to-draw for realistic behavior
let isDrawing = false, drawStart = 0, drawPower = 0;
canvas.addEventListener('mousedown', e => { if (e.button===0) { isDrawing = true; drawStart = performance.now(); }});
canvas.addEventListener('mouseup', e => { if (e.button===0) { isDrawing = false; fireArrow(); drawPower = 0; }});

// keyboard quick-shot
window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); quickShot(); }});

// background image (nice scenic)
const bg = new Image();
bg.crossOrigin = 'anonymous';
bg.src = 'https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=1920&q=80';

// voice helper
function speak(text){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; u.pitch = 1.0; u.volume = 0.95;
  speechSynthesis.cancel(); // cut overlapping chatter
  speechSynthesis.speak(u);
}

// spawn logic
function spawnMovingTarget(){
  const size = 36 + Math.random()*28;
  const y = 120 + Math.random() * (H - 260);
  const speed = 0.6 + Math.random()*0.9; // slower, smoother
  targets.push({ kind:'moving', x: W + 80 + Math.random()*200, y, w: size, h: size, speed });
}

function randomStandardTarget(){
  // position within right/center of screen (since archer is left-side)
  const x = 420 + Math.random()*(W - 540);
  const y = 120 + Math.random()*(H - 260);
  return { kind:'standard', x, y, size:44, hit:false, created: Date.now() };
}

function spawnStandardIfNeeded(){
  // ensure total of up to 10 active targets over time; we will spawn next when one relocates
  if (targets.filter(t=>t.kind==='standard').length < 1 && totalStandardSpawned < 10){
    const t = randomStandardTarget();
    targets.push(t);
    totalStandardSpawned++;
    scheduleAutoRelocate(t);
  }
}

let totalStandardSpawned = 0; // track how many targets we've generated in standard mode (cap 10)

// schedule relocate (after 5s if not hit)
function scheduleAutoRelocate(target){
  setTimeout(()=>{
    if (!targets.includes(target)) return;
    if (!target.hit){
      // relocate to new random position (smooth animate by replacing object)
      const idx = targets.indexOf(target);
      if (idx !== -1){
        targets[idx] = randomStandardTarget();
        // keep count (do not increment totalStandardSpawned because it's a relocation)
        scheduleAutoRelocate(targets[idx]);
      }
    }
  }, 5000);
}

// initial spawns
if (mode === 'moving'){
  for(let i=0;i<3;i++) spawnMovingTarget();
} else {
  totalStandardSpawned = 0;
  for(let i=0;i<1;i++){ spawnStandardIfNeeded(); }
}

// arrow functions
function fireArrow(){
  // compute power from draw duration
  const dt = Math.min(1.0, (performance.now() - drawStart)/900); // 0..1
  const baseSpeed = 24; // FAST arrows
  const speed = baseSpeed + dt*28; // up to ~52 px/frame scale factor (we use dt scaling)
  // position near archer's hand
  const origin = { x: 200, y: H - 160 };
  const ang = Math.atan2(mouse.y - origin.y, mouse.x - origin.x);
  // compute per-frame velocity scaled by a frame-base (we will multiply by delta later)
  const vx = Math.cos(ang) * speed;
  const vy = Math.sin(ang) * speed;
  arrows.push({ x: origin.x + Math.cos(ang)*28, y: origin.y + Math.sin(ang)*28, vx, vy, angle:ang, spawn:performance.now() });
  // small release message
  // reduce drawPower
  drawPower = 0;
}

function quickShot(){
  const origin = { x:200, y:H-160 };
  const ang = Math.atan2(mouse.y - origin.y, mouse.x - origin.x);
  const speed = 28; // quick but still fast
  arrows.push({ x: origin.x + Math.cos(ang)*28, y: origin.y + Math.sin(ang)*28, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, angle:ang, spawn:performance.now() });
}

// update loop
let last = performance.now();
function update(){
  const now = performance.now();
  const dt = Math.min(40, now - last); // ms
  last = now;

  // drawing charge
  if (isDrawing) {
    drawPower = Math.min(1.0, drawPower + (dt/900));
  }

  // update arrows (fast motion, use dt scaling)
  for(let i=arrows.length-1;i>=0;i--){
    const a = arrows[i];
    // velocity scaled to frame length: we designed vx in px per "step" approx, so scale moderately
    a.x += a.vx * (dt/16.67);
    a.y += a.vy * (dt/16.67);
    // slight gravity for realism
    a.vy += 0.08 * (dt/16.67);
    // remove offscreen
    if (a.x < -100 || a.x > W+100 || a.y < -200 || a.y > H+200) arrows.splice(i,1);
  }

  // spawn moving target occasionally
  if (mode === 'moving'){
    if (Math.random() < 0.012) spawnMovingTarget(); // less often
    // update moving targets slower
    for(const t of targets.filter(tt=>tt.kind==='moving')) t.x -= t.speed * (dt/16.67);
    // cull off-screen
    targets = targets.filter(t => !(t.kind==='moving' && t.x + t.w < -120));
  } else {
    // standard: ensure a sequential flow up to 10 different spawns total
    if (targets.filter(t=>t.kind==='standard').length === 0 && totalStandardSpawned < 10){
      const t = randomStandardTarget();
      targets.push(t);
      totalStandardSpawned++;
      scheduleAutoRelocate(t);
    }
  }

  // collisions
  for (let ti = targets.length - 1; ti >= 0; ti--){
    const t = targets[ti];
    for (let ai = arrows.length -1; ai >= 0; ai--){
      const a = arrows[ai];
      const dist = Math.hypot(a.x - t.x, a.y - t.y);
      if (dist < (t.size || t.w || 40) * 0.65){
        // hit!
        // scoring
        score += (t.kind === 'standard') ? 15 : 10;
        scoreEl.textContent = score;
        // message & voice
        const praises = ['Great Shot!','Bullseye!','Nice!','Excellent!','Perfect!'];
        const text = praises[Math.floor(Math.random()*praises.length)];
        messages.push({ text, x: t.x, y: t.y - 40, alpha:1, dy:-0.3 });
        speak(text);
        // remove arrow
        arrows.splice(ai,1);
        // relocate or replace target
        if (t.kind === 'moving'){
          // simply remove moving target on hit
          targets.splice(ti,1);
        } else {
          // replace with a new standard target position (but do not increase totalStandardSpawned)
          targets[ti] = randomStandardTarget();
          scheduleAutoRelocate(targets[ti]);
        }
        break;
      }
    }
  }

  // update floating messages
  for (let i = messages.length -1; i>=0; i--){
    const m = messages[i];
    m.y += m.dy * (dt/16.67);
    m.alpha -= 0.015 * (dt/16.67);
    if (m.alpha <= 0) messages.splice(i,1);
  }
}

// drawing: full person side view (left), smoother limbs
function drawArcherFull(){
  const baseX = 200, baseY = H - 140;
  // shoulder and torso
  // torso
  ctx.fillStyle = '#3c3130';
  roundRect(ctx, baseX - 22, baseY - 120, 44, 80, 10, true, false);
  // hips
  ctx.fillStyle = '#2e2624';
  ctx.fillRect(baseX - 22, baseY - 40, 44, 16);

  // head
  ctx.beginPath();
  ctx.fillStyle = '#f1c27d';
  ctx.arc(baseX, baseY - 140, 20, 0, Math.PI*2);
  ctx.fill();

  // legs (left and right) - simple jointed animation (standing pose)
  drawLimb(baseX - 8, baseY - 24, baseX - 8, baseY + 40, 10, '#2e2624'); // left leg
  drawLimb(baseX + 8, baseY - 24, baseX + 26, baseY + 52, 10, '#2e2624'); // right leg

  // left arm (bow-hand) - extended to hold bow
  const armShoulderX = baseX - 10, armShoulderY = baseY - 100;
  const angToMouse = Math.atan2(mouse.y - armShoulderY, mouse.x - armShoulderX);
  // compute elbow point for natural bend
  const elbowLen = 46;
  const ex = armShoulderX + Math.cos(angToMouse)*elbowLen;
  const ey = armShoulderY + Math.sin(angToMouse)*elbowLen;
  // forearm towards bow
  drawLimb(armShoulderX, armShoulderY, ex, ey, 12, '#f1c27d');
  const handX = ex + Math.cos(angToMouse)*28, handY = ey + Math.sin(angToMouse)*28;
  // right arm (drawing arm) - pulls string (slightly offset)
  const drawShoulderX = baseX + 14, drawShoulderY = baseY - 98;
  const drawAngle = angToMouse - 0.12; // natural offset so hand is behind bow
  const drawElbowLen = 42;
  const dx = drawShoulderX + Math.cos(drawAngle)*drawElbowLen;
  const dy = drawShoulderY + Math.sin(drawAngle)*drawElbowLen;
  drawLimb(drawShoulderX, drawShoulderY, dx, dy, 12, '#f1c27d');
  const drawHandX = dx + Math.cos(drawAngle)*(28 + drawPower*18), drawHandY = dy + Math.sin(drawAngle)*(28 + drawPower*18);

  // draw bow near left hand (bow-hand)
  ctx.save();
  ctx.translate(handX, handY);
  const bowAngle = Math.atan2(drawHandY - handY, drawHandX - handX);
  ctx.rotate(bowAngle + Math.PI/2); // rotate so bow curves roughly vertical
  // bow limb
  ctx.strokeStyle = '#4b2a19';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(18, 0, 0, 44);
  ctx.stroke();
  // string - connect top to draw-hand position projected
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#222';
  ctx.beginPath();
  ctx.moveTo(0, -44);
  // approximate control point for string sag/pull
  const controlY = -Math.min(24, drawPower*30);
  ctx.quadraticCurveTo(0 + drawPower*10, controlY, 0, 44);
  ctx.stroke();
  ctx.restore();

  // draw hands as small circles
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(handX, handY, 8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(drawHandX, drawHandY, 8, 0, Math.PI*2); ctx.fill();

  // small quiver on hip
  ctx.save();
  ctx.translate(baseX - 32, baseY - 30);
  ctx.fillStyle = '#2b2b2b';
  roundRect(ctx, 0, 0, 12, 36, 6, true, false);
  ctx.restore();
}

// helper: draw limb as rounded rectangle rotated
function drawLimb(x1,y1,x2,y2,w,color){
  const ang = Math.atan2(y2-y1,x2-x1);
  const len = Math.hypot(x2-x1,y2-y1);
  ctx.save();
  ctx.translate(x1,y1);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  roundRect(ctx, 0, -w/2, len, w, w/2, true, false);
  ctx.restore();
}

// rounded rect utility
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  if (r === undefined) r = 5;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// draw world & UI
function draw(){
  // background image with soft overlay
  if (bg.complete) ctx.drawImage(bg, 0, 0, W, H);
  else {
    ctx.fillStyle = '#cdeffd';
    ctx.fillRect(0,0,W,H);
  }
  // subtle overlay to keep foreground readable
  ctx.fillStyle = 'rgba(18,28,34,0.08)';
  ctx.fillRect(0,0,W,H);

  // ground plane
  ctx.fillStyle = '#8fbf88';
  const groundH = 110;
  ctx.fillRect(0, H - groundH, W, groundH);

  // draw targets
  for(const t of targets){
    if (t.kind === 'moving'){
      // target with rings
      ctx.save();
      ctx.translate(t.x, t.y);
      drawTargetRings(0,0,t.w * 0.9);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(t.x, t.y);
      drawTargetRings(0,0,t.size);
      ctx.restore();
    }
  }

  // draw arrows
  for(const a of arrows){
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-14, -2, 28, 4);
    // feather
    ctx.fillStyle = '#d1e8ff';
    ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-22,6); ctx.lineTo(-22,-6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // draw messages
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px Inter';
  for(const m of messages){
    ctx.globalAlpha = Math.max(0, m.alpha);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeText(m.text, m.x, m.y);
    ctx.fillText(m.text, m.x, m.y);
    ctx.globalAlpha = 1;
  }

  // archer last (foreground)
  drawArcherFull();

  // corner HUD (score already in HTML but draw a subtle in-canvas for extra polish)
  // (we keep HTML HUD visible so user always sees it)
}

// draw target rings helper
function drawTargetRings(x,y,r){
  // outer white
  ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  // red
  ctx.beginPath(); ctx.fillStyle = '#e33'; ctx.arc(x,y,r*0.58,0,Math.PI*2); ctx.fill();
  // center
  ctx.beginPath(); ctx.fillStyle = '#111'; ctx.arc(x,y,r*0.28,0,Math.PI*2); ctx.fill();
}

// main loop
let lastLoop = performance.now();
function mainLoop(now){
  update();
  draw();
  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);
