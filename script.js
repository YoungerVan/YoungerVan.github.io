// ============================================================
//  背景粒子：流动 + 悬停吸引 + 点击弹开 + 高速移动喷发新粒子
// ============================================================
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
let particles = [];
let time = 0;

const mouse = {
  x: -9999, y: -9999,
  lastX: -9999, lastY: -9999,
  active: false,
  speed: 0,
};
const shockwaves = []; // 点击脉冲

const MAX_PARTICLES = 240;

// ---- 轻量 2D 值噪声（流场方向） ----
const perm = new Uint8Array(512);
(function seedPerm() {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(h, x, y) { return (h & 1 ? -x : x) + (h & 2 ? -y : y); }
function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const A = perm[X] + Y, B = perm[X + 1] + Y;
  return lerp(
    lerp(grad(perm[A], x, y), grad(perm[B], x - 1, y), u),
    lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u),
    v
  );
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  initParticles();
}

function initParticles() {
  particles = [];
  const count = Math.min(160, Math.floor((W * H) / 12000));
  for (let i = 0; i < count; i++) {
    particles.push(makeParticle(Math.random() * W, Math.random() * H));
  }
}

function makeParticle(x, y, vx = 0, vy = 0) {
  return {
    x, y, vx, vy,
    r: Math.random() * 1.5 + 0.5,
    baseAlpha: Math.random() * 0.4 + 0.2,
    twinkle: Math.random() * Math.PI * 2,
    life: 1, // 1 表示常驻粒子；喷发粒子会 <1 并衰减
    decay: 0,
  };
}

// ---- 事件 ----
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.active = true;
});
window.addEventListener('mouseleave', () => {
  mouse.active = false;
  mouse.x = mouse.y = -9999;
  mouse.lastX = mouse.lastY = -9999;
  mouse.speed = 0;
});
window.addEventListener('click', (e) => {
  shockwaves.push({ x: e.clientX, y: e.clientY, r: 0, max: 300, alpha: 0.6 });
});

const FLOW_SCALE = 0.0016;
const FLOW_SPEED = 0.022;     // 流场驱动力（越小粒子越慢）
const ATTRACT_RADIUS = 180;  // 悬停吸引半径
const SPEED_SPAWN = 22;      // 触发喷发的鼠标速度阈值

function spawnFromMouse() {
  // 沿鼠标位置喷发新粒子（速度越快喷越多）
  const n = Math.min(4, Math.floor(mouse.speed / 18));
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = Math.random() * 2 + 1;
    const p = makeParticle(
      mouse.x + (Math.random() - 0.5) * 10,
      mouse.y + (Math.random() - 0.5) * 10,
      Math.cos(ang) * sp,
      Math.sin(ang) * sp
    );
    p.life = 1;
    p.decay = 0.004 + Math.random() * 0.004; // 缓慢消退，之后转为常驻
    particles.push(p);
  }
}

function updateMouseSpeed() {
  if (!mouse.active) { mouse.speed = 0; return; }
  if (mouse.lastX > -9998) {
    const dx = mouse.x - mouse.lastX;
    const dy = mouse.y - mouse.lastY;
    const inst = Math.hypot(dx, dy);
    mouse.speed += (inst - mouse.speed) * 0.4;
  }
  mouse.lastX = mouse.x;
  mouse.lastY = mouse.y;

  // 高速移动 → 喷发
  if (mouse.speed > SPEED_SPAWN) spawnFromMouse();
}

function draw() {
  time += 0.004;
  updateMouseSpeed();

  // 纯净清屏（无残影、无背景）
  ctx.clearRect(0, 0, W, H);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // 流场驱动
    const angle = noise2(p.x * FLOW_SCALE, p.y * FLOW_SCALE + time) * Math.PI * 2;
    p.vx += Math.cos(angle) * FLOW_SPEED;
    p.vy += Math.sin(angle) * FLOW_SPEED;

    // 悬停吸引（靠拢鼠标）
    if (mouse.active) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ATTRACT_RADIUS && dist > 1) {
        const pull = (1 - dist / ATTRACT_RADIUS) * 0.5;
        p.vx += (dx / dist) * pull;
        p.vy += (dy / dist) * pull;
      }
    }

    // 点击脉冲弹开
    for (const s of shockwaves) {
      const dx = p.x - s.x, dy = p.y - s.y;
      const dist = Math.hypot(dx, dy);
      const ring = Math.abs(dist - s.r);
      if (ring < 50 && dist > 0.1) {
        const force = (1 - ring / 50) * s.alpha * 4;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
    }

    // 阻尼 + 位移（阻尼略大，移动更平缓）
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.x += p.vx;
    p.y += p.vy;

    // 环绕边界
    if (p.x < -20) p.x = W + 20;
    if (p.x > W + 20) p.x = -20;
    if (p.y < -20) p.y = H + 20;
    if (p.y > H + 20) p.y = -20;

    // 喷发粒子衰减到 0.6 后转为常驻（不再消失，避免越点越少）
    if (p.decay > 0) {
      p.life -= p.decay;
      if (p.life <= 0.6) { p.life = 0.6; p.decay = 0; }
    }

    // 闪烁
    p.twinkle += 0.03;
    const tw = 0.75 + 0.25 * Math.sin(p.twinkle);
    const speed = Math.hypot(p.vx, p.vy);
    const alpha = Math.min(0.95, p.baseAlpha * tw * p.life + speed * 0.04);

    // 纯粹的粒子（无辉光渐变、无背景）
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 连线（近邻）
  const LINK = 120;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < LINK) {
        const alpha = 0.07 * (1 - dist / LINK) * Math.min(a.life, b.life);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // 点击脉冲环
  for (let k = shockwaves.length - 1; k >= 0; k--) {
    const s = shockwaves[k];
    s.r += 7;
    s.alpha *= 0.95;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.lineWidth = 1.2;
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
    if (s.r > s.max || s.alpha < 0.02) shockwaves.splice(k, 1);
  }

  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
resize();
draw();
