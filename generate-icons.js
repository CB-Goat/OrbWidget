// ====== 零依赖 PNG 图标生成器 ======
// 不使用任何外部库，只依赖 Node.js 内置 zlib。
// 输出 192x192 和 512x512 两个尺寸的炫彩浮球图标。
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICON_DIR = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });

// ====== PNG 工具 ======
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// color type 2 (RGB), bit depth 8, filter 0 (none)
function buildPNG(width, height, pixelFn) {
  // raw scanlines: each row = 1 byte filter (0) + width*3 bytes RGB
  const raw = Buffer.alloc((1 + width * 3) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter byte 0
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      const off = y * (1 + width * 3) + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;           // bit depth
  ihdr[9] = 2;           // color type = RGB
  ihdr[10] = 0;          // compression
  ihdr[11] = 0;          // filter
  ihdr[12] = 0;          // no interlace

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ====== 颜色工具 ======
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function mixRgb(c1, c2, t) {
  return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
}
function ringColor(angle) {
  // 按角度在 5 种霓虹色之间插值
  const stops = [
    hexToRgb('#ff006e'),
    hexToRgb('#8338ec'),
    hexToRgb('#3a86ff'),
    hexToRgb('#06ffa5'),
    hexToRgb('#ffbe0b'),
    hexToRgb('#ff006e'), // 闭环
  ];
  const n = stops.length - 1;
  const pos = (angle / (Math.PI * 2)) * n;
  const i = Math.floor(pos) % n;
  const f = pos - Math.floor(pos);
  return mixRgb(stops[i], stops[i + 1], f);
}

// 平滑阶梯（抗锯齿近似）
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ====== 主渲染器 ======
function orbPixel(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const radius = Math.min(w, h) / 2;

  // 背景（深色）
  const bgOuter = hexToRgb('#05000f');
  const bgInner = hexToRgb('#1a0042');
  const bgT = Math.min(1, r / radius);
  const bg = mixRgb(bgInner, bgOuter, bgT);

  // 计算角度（conic gradient）
  let angle = Math.atan2(dy, dx) + Math.PI / 4; // 偏移起始角度
  // 归一化到 [0, 2π)
  angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // 外圈光环 (halo): 从 radius*0.95 到 radius*1.25 逐渐淡出
  const haloInner = radius * 0.62;
  const haloOuter = radius * 0.98;
  const haloColor = ringColor(angle);
  const haloAlpha = smoothstep(haloOuter, haloInner, r) * 0.55;

  // 主体 orb
  const orbOuter = radius * 0.58;
  const orbInner = radius * 0.50;
  const orbAlpha = smoothstep(orbOuter, orbInner, r);
  const orbColor = ringColor(angle);

  // 白色描边（细圆环）
  const strokeOuter = orbOuter + 2;
  const strokeInner = orbOuter - 2;
  const strokeAlpha = (r > strokeInner && r < strokeOuter) ? Math.min(1, 1 - Math.abs(r - orbOuter) / 2) * 0.9 : 0;
  const strokeColor = [255, 255, 255];

  // 核心白/黄色圆
  const coreOuter = radius * 0.30;
  const coreInner = radius * 0.22;
  const coreAlpha = smoothstep(coreOuter, coreInner, r);
  const coreColor = [255, 252, 230];

  // 核心内部的黄色高光
  const hotOuter = radius * 0.16;
  const hotAlpha = smoothstep(hotOuter, 0, r);
  const hotColor = hexToRgb('#ffd84d');

  // 合成：bg + halo + orb + stroke + core + hot（从下到上 alpha 叠加）
  function over(base, color, alpha) {
    const inv = 1 - alpha;
    return [
      Math.round(base[0] * inv + color[0] * alpha),
      Math.round(base[1] * inv + color[1] * alpha),
      Math.round(base[2] * inv + color[2] * alpha),
    ];
  }
  let c = bg;
  c = over(c, haloColor, haloAlpha);
  c = over(c, orbColor, orbAlpha);
  c = over(c, strokeColor, strokeAlpha);
  c = over(c, coreColor, coreAlpha);
  c = over(c, hotColor, hotAlpha);
  return c;
}

// ====== 生成并保存 ======
const targets = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

console.log('\n🖼  正在生成 PNG 图标（零依赖）...');
for (const t of targets) {
  const buf = buildPNG(t.size, t.size, orbPixel);
  const outPath = path.join(ICON_DIR, t.name);
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`   ✅  ${t.name}  →  ${t.size}x${t.size}  (${kb} KB)`);
}

// 同时也放一份 screenshot.svg（可选）
const screenshot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 1334" width="750" height="1334">
  <defs>
    <radialGradient id="g" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#1a0042"/>
      <stop offset="60%" stop-color="#0a001f"/>
      <stop offset="100%" stop-color="#000"/>
    </radialGradient>
    <conicGradient id="o" from="225deg" at="50% 50%">
      <stop offset="0%" stop-color="#ff006e"/>
      <stop offset="30%" stop-color="#8338ec"/>
      <stop offset="60%" stop-color="#3a86ff"/>
      <stop offset="100%" stop-color="#06ffa5"/>
    </conicGradient>
  </defs>
  <rect width="750" height="1334" fill="url(#g)"/>
  <circle cx="375" cy="667" r="260" fill="url(#o)" opacity="0.55" filter="blur(30px)"/>
  <circle cx="375" cy="667" r="150" fill="url(#o)"/>
  <circle cx="375" cy="667" r="90" fill="#fff"/>
  <text x="375" y="950" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="bold" fill="#fff">炫彩浮球挂件</text>
  <text x="375" y="1000" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#b9a8e0">Floating Orb Widget · PWA</text>
</svg>`;
fs.writeFileSync(path.join(ICON_DIR, 'screenshot.svg'), screenshot);
console.log('   ✅  screenshot.svg');

console.log('\n🎉 所有图标已生成完毕，路径:');
console.log(`   ${path.relative(process.cwd(), ICON_DIR)}/\n`);
