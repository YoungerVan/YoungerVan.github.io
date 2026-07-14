// ===== 粒子背景 · 极简黑白 · 鼠标聚焦 =====
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let particles = [];

const mouse = { x: null, y: null, lastX: null, lastY: null, speed: 0, focus: 0 };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initParticles();
}

function initParticles() {
  particles = [];
  const count = Math.floor((canvas.width * canvas.height) / 9000);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.3,
      baseAlpha: Math.random() * 0.25 + 0.12,
    });
  }
}

window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

function updateMouse() {
  if (mouse.x === null) {
    mouse.focus += (0 - mouse.focus) * 0.06;
    mouse.lastX = mouse.lastY = null;
    return;
  }
  if (mouse.lastX !== null) {
    const dx = mouse.x - mouse.lastX;
    const dy = mouse.y - mouse.lastY;
    const inst = Math.sqrt(dx * dx + dy * dy);
    mouse.speed += (inst - mouse.speed) * 0.3;
  }
  mouse.lastX = mouse.x;
  mouse.lastY = mouse.y;

  const target = Math.max(0, 1 - mouse.speed / 18);
  mouse.focus += (target - mouse.focus) * 0.08;
  mouse.speed *= 0.85;
}

const FOCUS_RADIUS = 200;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateMouse();

  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

    if (mouse.x !== null && mouse.focus > 0.02) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < FOCUS_RADIUS && dist > 1) {
        const pull = (1 - dist / FOCUS_RADIUS) * mouse.focus * 0.8;
        p.x += (dx / dist) * pull * 2;
        p.y += (dy / dist) * pull * 2;
      }
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.baseAlpha})`;
    ctx.fill();
  });

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        let alpha = 0.06 * (1 - dist / 120);
        if (mouse.x !== null && mouse.focus > 0.02) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const md = Math.sqrt((mx - mouse.x) ** 2 + (my - mouse.y) ** 2);
          if (md < FOCUS_RADIUS) alpha += (1 - md / FOCUS_RADIUS) * mouse.focus * 0.35;
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
resize();
draw();
