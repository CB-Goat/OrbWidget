import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'FloatingOrb/v1');
  // PWA 相关：禁用 manifest 的强缓存（便于调试）
  if (req.path.endsWith('.webmanifest') || req.path.endsWith('/manifest')) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  } else if (req.path.endsWith('/service-worker.js')) {
    // Service Worker 永远不做长期缓存
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (req.path.endsWith('.svg')) {
    res.setHeader('Content-Type', 'image/svg+xml');
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'floating-orb-widget',
    version: 'pwa-v1.0',
    timestamp: Date.now(),
    message: '炫彩浮球挂件 PWA 服务运行中 ✨',
  });
});

app.get('/api/confetti', (req, res) => {
  const palette = [
    ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5'],
    ['#fb5607', '#ffbe0b', '#ff006e', '#8338ec'],
    ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5'],
    ['#fee440', '#f15bb5', '#9b5de5', '#00bbf9'],
    ['#06ffa5', '#3a86ff', '#8338ec', '#ff006e'],
  ];
  const colors = palette[Math.floor(Math.random() * palette.length)];
  res.json({
    colors,
    particleCount: 60,
    duration: 2400,
    spread: 90,
  });
});

app.post('/api/visit', (req, res) => {
  const { ua } = req.body || {};
  const mobileUA = /android|iphone|ipad|ipod|mobile/i;
  const isMobile = mobileUA.test(ua || req.get('User-Agent') || '');
  res.json({
    ok: true,
    isMobile,
    timestamp: Date.now(),
    hint: isMobile
      ? '在手机上拖动浮球到屏幕边缘即可吸附隐藏 ✨'
      : '建议使用手机访问以获得最佳浮球挂件体验',
  });
});

// 静态文件
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      } else if (filePath.endsWith('service-worker.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// PWA 启动兜底：任意路径返回 index.html（支持 manifest shortcuts 跳转）
app.get(/^\/(?!api\/|icons\/|styles\.css|orb\.js|service-worker\.js|manifest\.webmanifest).*/, (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  const iconPath = path.join(__dirname, 'public', 'icons', 'icon-192.png');
  const hasIcons = fs.existsSync(iconPath);
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   ✨ 炫彩浮球挂件 PWA 服务已启动          ║
  ║   🌐 http://localhost:${PORT}                 ║
  ║   📦 manifest:  /manifest.webmanifest     ║
  ║   🔧 service worker: /service-worker.js   ║
  ║   ${hasIcons ? '✅' : '⚠️'}  icon-192.png${hasIcons ? ' 就绪' : ' 需生成（运行 npm run gen-icons）'}  ║
  ║   📱 建议用手机浏览器访问并"添加到主屏幕"   ║
  ╚══════════════════════════════════════════╝
  `);
});
