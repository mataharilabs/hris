// Confetti ringan tanpa dependency. Meletus dua kali (dua burst).

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  life: number;
};

const COLORS = ["#fe214f", "#e60840", "#f59e0b", "#10b981", "#0040a8", "#8b5cf6", "#ec4899"];

/** Letuskan confetti (dua burst kiri & kanan). */
export function fireConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const particles: P[] = [];

  function burst(originXRatio: number) {
    const ox = W * originXRatio;
    const oy = H * 0.62;
    const count = 90;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.9; // ke atas
      const speed = 6 + Math.random() * 9;
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed * (originXRatio < 0.5 ? -1 : 1) * 0.6 + (Math.random() - 0.5) * 4,
        vy: Math.sin(angle) * speed - 4,
        size: 5 + Math.random() * 6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        life: 1,
      });
    }
  }

  burst(0.25);
  window.setTimeout(() => burst(0.75), 280); // letusan kedua

  const gravity = 0.22;
  const drag = 0.992;
  let raf = 0;

  function frame() {
    ctx!.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.008;
      if (p.y < H + 20 && p.life > 0) alive = true;
      ctx!.save();
      ctx!.globalAlpha = Math.max(0, p.life);
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }
    if (alive) {
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  }
  raf = requestAnimationFrame(frame);

  // Pengaman: hapus canvas setelah 4 detik.
  window.setTimeout(() => {
    cancelAnimationFrame(raf);
    canvas.remove();
  }, 4000);
}
