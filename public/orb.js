(() => {
  'use strict';

  const orb = document.getElementById('orbWidget');
  const panel = document.getElementById('orbPanel');
  const panelClose = document.getElementById('panelClose');
  const summonBtn = document.getElementById('summonBtn');
  const confettiBtn = document.getElementById('confettiBtn');
  const hideOrbBtn = document.getElementById('hideOrbBtn');
  const particlesEl = document.getElementById('panelParticles');
  const statusText = document.getElementById('statusText');
  const sparkCanvas = document.getElementById('sparkCanvas');
  const ctx = sparkCanvas.getContext('2d');
  const installCard = document.getElementById('installCard');
  const installBtn = document.getElementById('installBtn');
  const installClose = document.getElementById('installClose');

  // ===== State =====
  const state = {
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startLeft: 0,
    startTop: 0,
    currentX: 0,
    currentY: 0,
    moveThreshold: 6,
    didMove: false,
    vx: 0,
    vy: 0,
    lastMoveT: 0,
    animFrame: null,
    side: 'right',
    orbW: 62,
    orbH: 62,
    edgePadding: 12,
  };

  // ===== Helpers =====
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  function getVwPx() {
    return window.innerWidth || document.documentElement.clientWidth;
  }
  function getVhPx() {
    return window.innerHeight || document.documentElement.clientHeight;
  }

  function setOrbPosition(x, y, snap = false) {
    const vw = getVwPx();
    const vh = getVhPx();
    const w = orb.offsetWidth || state.orbW;
    const h = orb.offsetHeight || state.orbH;
    const left = clamp(x, state.edgePadding, vw - w - state.edgePadding);
    const top = clamp(y, state.edgePadding + 20, vh - h - state.edgePadding);
    orb.style.left = left + 'px';
    orb.style.top = top + 'px';
    orb.style.right = 'auto';
    orb.style.bottom = 'auto';
    state.currentX = left;
    state.currentY = top;
    if (snap) {
      // Compute which edge to snap to
      const rightEdge = vw - w - left;
      const bottomEdge = vh - h - top;
      const dists = {
        left: left,
        right: rightEdge,
        top: top,
        bottom: bottomEdge,
      };
      let closest = 'right';
      let minD = Infinity;
      for (const [side, d] of Object.entries(dists)) {
        if (d < minD) { minD = d; closest = side; }
      }
      state.side = closest;
      // snap - partial hide
      if (closest === 'left') {
        orb.style.left = (-w * 0.6) + 'px';
      } else if (closest === 'right') {
        orb.style.left = (vw - w + w * 0.6) + 'px';
      } else if (closest === 'top') {
        orb.style.top = (-h * 0.5) + 'px';
      } else if (closest === 'bottom') {
        orb.style.top = (vh - h + h * 0.5) + 'px';
      }
      state.currentX = parseFloat(orb.style.left);
      state.currentY = parseFloat(orb.style.top);
    }
  }

  function resetOrbToDefault() {
    orb.classList.remove('hidden-left', 'hidden-right', 'hidden-bottom');
    const vw = getVwPx();
    const vh = getVhPx();
    const w = orb.offsetWidth || state.orbW;
    const h = orb.offsetHeight || state.orbH;
    setOrbPosition(vw - w - 16, vh * 0.6, false);
  }

  // ===== Drag / Touch handlers =====
  function onPointerDown(e) {
    if (panel.classList.contains('open')) return;
    const p = getPoint(e);
    state.dragging = true;
    state.didMove = false;
    state.dragStartX = p.x;
    state.dragStartY = p.y;
    const rect = orb.getBoundingClientRect();
    state.startLeft = rect.left;
    state.startTop = rect.top;
    state.vx = 0;
    state.vy = 0;
    state.lastMoveT = now();
    orb.classList.add('dragging');
    orb.style.transition = 'none';
    try { orb.setPointerCapture && orb.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state.dragging) return;
    const p = getPoint(e);
    const dx = p.x - state.dragStartX;
    const dy = p.y - state.dragStartY;
    if (!state.didMove && Math.hypot(dx, dy) > state.moveThreshold) {
      state.didMove = true;
    }
    const t = now();
    const dt = Math.max(16, t - state.lastMoveT);
    state.lastMoveT = t;
    const newX = state.startLeft + dx;
    const newY = state.startTop + dy;
    state.vx = (newX - state.currentX) / dt * 16;
    state.vy = (newY - state.currentY) / dt * 16;
    setOrbPosition(newX, newY, false);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!state.dragging) return;
    state.dragging = false;
    orb.classList.remove('dragging');
    orb.style.transition = '';
    if (!state.didMove) {
      openPanel();
      return;
    }
    // 始终使用边缘吸附
    const vw = getVwPx();
    const vh = getVhPx();
    const w = orb.offsetWidth || state.orbW;
    const h = orb.offsetHeight || state.orbH;

    let targetX = state.currentX;
    let targetY = state.currentY;
    const speed = Math.hypot(state.vx, state.vy);
    if (speed > 2) {
      const steps = Math.min(18, Math.round(speed * 0.6));
      targetX = state.currentX + state.vx * steps;
      targetY = state.currentY + state.vy * steps;
    }
    targetX = clamp(targetX, state.edgePadding, vw - w - state.edgePadding);
    targetY = clamp(targetY, state.edgePadding + 20, vh - h - state.edgePadding);
    setOrbPosition(targetX, targetY, true);
  }

  function getPoint(e) {
    if (e.touches && e.touches.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  orb.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Touch fallback for older browsers
  orb.addEventListener('touchstart', (e) => {
    if (!window.PointerEvent) onPointerDown(e);
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (state.dragging && !window.PointerEvent) onPointerMove(e);
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    if (state.dragging && !window.PointerEvent) onPointerUp(e);
  });

  // ===== Panel open/close =====
  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    spawnPanelParticles();
    playPop(orb.getBoundingClientRect());
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  panelClose.addEventListener('click', closePanel);
  panel.querySelector('.panel-backdrop').addEventListener('click', closePanel);
  summonBtn.addEventListener('click', openPanel);
  hideOrbBtn.addEventListener('click', () => {
    closePanel();
    const vw = getVwPx();
    const vh = getVhPx();
    const h = orb.offsetHeight || state.orbH;
    setOrbPosition(state.currentX, vh - h + h * 0.55, false);
    toast('浮球已隐藏到屏幕底部，点击它可再次召唤 ✨');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  // ===== Panel particles =====
  function spawnPanelParticles() {
    particlesEl.innerHTML = '';
    const colors = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b'];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      const color = colors[i % colors.length];
      s.style.setProperty('--x', (Math.random() * 200 - 100) + 'px');
      s.style.color = color;
      s.style.background = color;
      s.style.left = Math.random() * 100 + '%';
      s.style.bottom = Math.random() * 40 + '%';
      s.style.animationDelay = (Math.random() * 3) + 's';
      s.style.animationDuration = (4 + Math.random() * 3) + 's';
      s.style.width = s.style.height = (4 + Math.random() * 6) + 'px';
      particlesEl.appendChild(s);
    }
  }

  // ===== Global confetti / sparkles on canvas =====
  let sparks = [];
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    sparkCanvas.width = Math.floor(window.innerWidth * dpr);
    sparkCanvas.height = Math.floor(window.innerHeight * dpr);
    sparkCanvas.style.width = window.innerWidth + 'px';
    sparkCanvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function burst(x, y, opts = {}) {
    const colors = opts.colors || ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#f15bb5'];
    const count = opts.count || 60;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2) * (i / count) + Math.random() * 0.3;
      const speed = 180 + Math.random() * 260;
      sparks.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 40,
        g: 420,
        life: 0.8 + Math.random() * 1.4,
        age: 0,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: Math.random() > 0.6 ? 'square' : 'circle',
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
      });
    }
    if (!state.animFrame) loop();
  }

  function playPop(rect) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    burst(x, y, { count: 40 });
  }

  function loop() {
    state.animFrame = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    const dt = 1 / 60;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const a = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      if (p.kind === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (sparks.length === 0) {
      cancelAnimationFrame(state.animFrame);
      state.animFrame = null;
    }
  }

  confettiBtn.addEventListener('click', () => {
    const rect = panel.querySelector('.panel-card').getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.35;
    burst(cx, cy, { count: 90 });
    setTimeout(() => burst(cx - 60, cy + 30, { count: 40 }), 120);
    setTimeout(() => burst(cx + 60, cy + 30, { count: 40 }), 240);
  });

  // ===== Simple toast =====
  function toast(msg) {
    let t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed',
      left: '50%',
      bottom: '80px',
      transform: 'translate(-50%, 20px)',
      padding: '10px 16px',
      background: 'rgba(10, 0, 31, 0.9)',
      color: '#fff',
      fontSize: '13px',
      borderRadius: '999px',
      border: '1px solid rgba(131,56,236,.5)',
      boxShadow: '0 10px 30px rgba(131,56,236,.3)',
      opacity: '0',
      transition: 'all .4s ease',
      zIndex: '300',
      pointerEvents: 'none',
      maxWidth: '80%',
      textAlign: 'center',
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translate(-50%, 0)';
    });
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translate(-50%, 20px)';
      setTimeout(() => t.remove(), 500);
    }, 2200);
  }

  // ===== Initialize =====
  function init() {
    // 始终使用普通模式：浮球吸附到右侧边缘
    const vw = getVwPx();
    const vh = getVhPx();
    const w = orb.offsetWidth || state.orbW;
    const h = orb.offsetHeight || state.orbH;
    orb.style.left = (vw - w + w * 0.6) + 'px';
    orb.style.top = (vh * 0.55) + 'px';
    orb.style.right = 'auto';
    orb.style.bottom = 'auto';
    state.currentX = parseFloat(orb.style.left);
    state.currentY = parseFloat(orb.style.top);
    state.side = 'right';
    spawnPanelParticles();

    // URL 参数：?panel=1 自动打开面板
    if (location.search.includes('panel=1')) {
      setTimeout(openPanel, 350);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('resize', () => {
    // keep orb visible on resize
    const vw = getVwPx();
    const vh = getVhPx();
    const w = orb.offsetWidth || state.orbW;
    const h = orb.offsetHeight || state.orbH;
    state.currentX = clamp(state.currentX, -w * 0.5, vw + w * 0.5);
    state.currentY = clamp(state.currentY, -h * 0.5, vh + h * 0.5);
    orb.style.left = state.currentX + 'px';
    orb.style.top = state.currentY + 'px';
  });

  // ===== PWA: Service Worker 注册 & 安装提示 =====
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('✨ 新版本已就绪，刷新后生效');
          }
        });
      });
    } catch (err) {
      console.warn('[PWA] SW 注册失败:', err);
    }
  }
  registerSW();

  // ===== PWA: 一键安装横幅 & 安装提示 =====
  let deferredPrompt = null;
  let installDismissed = false;
  try { installDismissed = sessionStorage.getItem('orb-install-dismissed') === '1'; } catch (_) {}

  const pwaInstallBanner = document.getElementById('pwaInstallBanner');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  // 当浏览器触发 beforeinstallprompt 时，显示一键安装横幅
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 显示醒目的横幅
    if (pwaInstallBanner) {
      pwaInstallBanner.style.display = 'block';
    }
    // 同时也显示旧的卡片
    if (installCard && !installDismissed) {
      installCard.hidden = false;
    }
  });

  // 一键安装按钮点击
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        // 兜底：浏览器不支持时显示详细安装指南
        toast('📱 手动安装步骤：');
        setTimeout(() => toast('1️⃣ 点击浏览器右上角三点菜单'), 800);
        setTimeout(() => toast('2️⃣ 选择"添加到主屏幕"'), 1600);
        setTimeout(() => toast('3️⃣ 点击"添加"完成安装'), 2400);
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast('🎉 已安装完成！从桌面图标打开体验浮球模式');
      } else {
        // 用户取消后显示手动安装指南
        setTimeout(() => {
          toast('💡 也可以手动添加：');
          setTimeout(() => toast('菜单 → 添加到主屏幕'), 800);
        }, 500);
      }
      deferredPrompt = null;
      if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
    });
  }

  // 横幅右上角关闭按钮
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
    if (installCard) installCard.hidden = true;
    toast('🎉 已安装完成，试试从主屏幕打开');
    if (statusText) statusText.textContent = '已安装';
  });

  // display-mode 切换监听
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => {
    if (e.matches) {
      document.body.classList.add('orb-only');
      if (statusText) statusText.textContent = '浮球模式';
    } else {
      document.body.classList.remove('orb-only');
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        // 如果浏览器没有触发 beforeinstallprompt，尝试手动引导
        toast('💡 请点击浏览器右上角菜单 → "添加到主屏幕"');
        // 显示更详细的安装指南
        if (navigator.standalone !== undefined) {
          // iOS Safari
          toast('📱 Safari: 点击底部"分享"按钮 → "添加到主屏幕"');
        } else if (navigator.userAgent.includes('Chrome')) {
          toast('🌐 Chrome: 点击三点菜单 → "安装应用"');
        }
        return;
      }
      // 触发浏览器原生安装提示
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        if (installCard) installCard.hidden = true;
        toast('🎉 已安装！从主屏幕打开体验浮球');
      } else {
        toast('稍后可以在浏览器菜单再次安装');
      }
      deferredPrompt = null;
    });
  }

  if (installClose) {
    installClose.addEventListener('click', () => {
      if (installCard) installCard.hidden = true;
      try { sessionStorage.setItem('orb-install-dismissed', '1'); } catch (_) {}
    });
  }

  // ===== 后端健康检测 =====
  async function ping() {
    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ua: navigator.userAgent }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.hint && statusText && !document.body.classList.contains('orb-only')) {
          statusText.textContent = data.isMobile ? '移动端' : '桌面模式';
        }
      }
    } catch (_) {}
  }
  setTimeout(ping, 800);
})();
