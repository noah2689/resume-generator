/**
 * 最小可信服务端边界（M7.1）。
 *
 * 它存在的**唯一理由**：把 DeepSeek 的 API key 挡在浏览器之外。
 * 顺便承担生产环境的静态托管，这样部署只需要一个进程。
 *
 * 职责（严格限定）：
 * 1. `/api/*` 优先路由 —— API 请求永远不进静态分支。
 * 2. 唯一的业务端点 POST /api/ai/optimize-work-bullet（实现见 ./optimizeWorkBullet.mjs）。
 * 3. 从 `dist/` 托管构建产物：MIME 分派、防止 `../` 越界、SPA 回退到 index.html。
 * 4. 进程级固定窗口限流，给公开 endpoint 一个总闸。
 *
 * 刻意不做（第 20 条末句）：
 * - 不是 web framework：没有路由表、没有中间件栈、没有插件、没有 body parser 库。
 * - 没有数据库、没有用户体系、没有 session、没有 cookie。
 * - 不引任何 npm 依赖：只用 node:http / node:fs / node:path + 全局 fetch。
 *
 * 「key 不在浏览器里」不等于 endpoint 不会被滥用，所以第 4 条不是可选项：
 * 一个公开的、会替你花钱的 endpoint 必须有个上限。本轮只加最简单的总闸，
 * 真正的多用户部署要按那时的情况重新设计（第 8 条）。
 *
 * 依据：M7.1 最终口径 第 1、5、6、7、8、20、26 条
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OptimizeError, optimizeWorkBullet } from './optimizeWorkBullet.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

/** 唯一业务端点。API 分支只认这一个路径，不做前缀匹配、不做通配。 */
const OPTIMIZE_PATH = '/api/ai/optimize-work-bullet';

/** 请求体上限 4KB（第 7 条）。一条 300 字的描述连 JSON 包装远不到 1KB。 */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * 固定窗口限流（第 8 条）：30 请求 / 分钟，进程级。
 *
 * 刻意不做：按 IP 计费、账户体系、Redis、分布式限流、CAPTCHA、认证框架。
 * 这只是「防止公开 endpoint 被瞬时刷爆」的总闸，不是配额系统——
 * 进程重启即清零，多实例部署时每个实例各有一份独立计数。
 */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

let rateWindowStart = Date.now();
let rateWindowCount = 0;

/** 端口 / 监听地址可用环境变量覆盖；默认只监听本机，避免无意间对公网开放。 */
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';

/**
 * 静态资源 MIME 表。
 *
 * 只列本项目 `dist/` 真的会产出的类型（Vite 的 js/css/html +
 * 两个自托管中文字体包带来的 woff2/ttf + 图片）。
 * 不引入 mime 依赖，也不做 mime 嗅探。
 */
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
]);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // API 优先：/api 下的路径永远不走静态分支，也就永远碰不到 dist/ 之外的东西。
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    void handleApi(req, res, url.pathname);
    return;
  }

  void handleStatic(req, res, url.pathname);
});

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

async function handleApi(req, res, pathname) {
  const startedAt = Date.now();
  let status = 500;
  let inputChars = 0;
  let providerStatus = '-';

  try {
    if (pathname !== OPTIMIZE_PATH) {
      throw new OptimizeError('not_found', 404);
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      throw new OptimizeError('method_not_allowed', 405);
    }

    // 限流放在最前面：方法对了就计入预算，被刷时后面的解析与 provider 调用都不会发生。
    if (!takeRateLimitSlot()) {
      throw new OptimizeError('rate_limited', 429);
    }

    if (!isJsonRequest(req)) {
      throw new OptimizeError('unsupported_media_type', 415);
    }

    const body = await readJsonBody(req);

    // 只取 text 一个字段（第 5 条）。
    // 不是「挑出要用的字段」，而是「只读这一个」——其余字段连读都不读，
    // 因此不可能被透传，也不可能出现在日志里。
    const rawText = body !== null && typeof body === 'object' ? body.text : undefined;
    inputChars = typeof rawText === 'string' ? [...rawText].length : 0;

    const { suggestion, providerStatus: upstream } = await optimizeWorkBullet(rawText);

    providerStatus = String(upstream);
    status = 200;
    sendJson(res, 200, { suggestion });
  } catch (error) {
    const known = error instanceof OptimizeError;
    status = known ? error.status : 500;
    providerStatus = known && error.providerStatus !== null ? String(error.providerStatus) : providerStatus;

    if (!res.headersSent) {
      // 对外只有错误码，没有 provider 原文（第 6 条）。
      sendJson(res, status, { error: known ? error.reason : 'server_error' });
    }
  } finally {
    // 日志边界（第 26 条）：只记状态、输入长度、provider 状态、耗时。
    // 绝不记录原始 text、整份 Resume、Authorization、key。
    console.log(
      `[api] optimize-work-bullet status=${status} chars=${inputChars} provider=${providerStatus} ${Date.now() - startedAt}ms`,
    );
  }
}

function takeRateLimitSlot() {
  const now = Date.now();

  if (now - rateWindowStart >= RATE_LIMIT_WINDOW_MS) {
    rateWindowStart = now;
    rateWindowCount = 0;
  }

  rateWindowCount += 1;
  return rateWindowCount <= RATE_LIMIT_MAX;
}

function isJsonRequest(req) {
  const contentType = req.headers['content-type'];
  return typeof contentType === 'string' && contentType.toLowerCase().startsWith('application/json');
}

/**
 * 读请求体，超过 4KB 立即放弃。
 *
 * 超限后不再累积 chunk（否则「限制」本身就成了内存放大器），
 * 也不 `req.destroy()`——那会把已经建立的连接连同响应一起掐掉，
 * 客户端只会看到连接被重置而不是一个明确的 413。
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;

      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        fail(new OptimizeError('payload_too_large', 413));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;

      const raw = Buffer.concat(chunks).toString('utf8');

      if (raw.trim() === '') {
        fail(new OptimizeError('invalid_request', 400));
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        fail(new OptimizeError('invalid_request', 400));
        return;
      }

      settled = true;
      resolve(parsed);
    });

    req.on('aborted', () => fail(new OptimizeError('invalid_request', 400)));
    req.on('error', () => fail(new OptimizeError('invalid_request', 400)));
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/* -------------------------------------------------------------------------- */
/* 静态托管（dist/）                                                            */
/* -------------------------------------------------------------------------- */

async function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const target = await resolveStaticTarget(pathname);

  if (target === null) {
    sendText(res, 404, 'Not Found');
    return;
  }

  let stats;
  try {
    stats = await stat(target);
  } catch {
    sendText(res, 404, 'Not Found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME_TYPES.get(path.extname(target).toLowerCase()) ?? 'application/octet-stream',
    'Content-Length': stats.size,
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(target);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

/**
 * 把 URL path 解析成 `dist/` 内的绝对文件路径。
 *
 * 返回 null 表示「不该给」——调用方一律 404。
 *
 * 越界防线只有一条：**解析后的绝对路径必须仍在 DIST_DIR 之内**。
 * 任何落在 dist 之外的结果都返回 null，所以 `server/`、`server/.env`、
 * `.git/`、仓库其他文件从结构上就不可能被读到——不是靠关键词黑名单挡的。
 *
 * `decodeURIComponent` 必须在 `path.resolve` 之前：`%2e%2e%2f` 这类编码
 * 只有解码后才会变成 `../`，先 resolve 再 decode 等于没做。
 */
async function resolveStaticTarget(pathname) {
  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  // NUL 字节会让路径在底层 API 处被截断，先拒掉。
  if (decoded.includes('\0')) {
    return null;
  }

  const relative = decoded.replace(/^\/+/, '');
  const resolved = path.resolve(DIST_DIR, relative);

  if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + path.sep)) {
    return null;
  }

  const kind = await statKind(resolved);

  if (kind === 'file') {
    return resolved;
  }

  if (kind === 'directory') {
    const index = path.join(resolved, 'index.html');
    return (await statKind(index)) === 'file' ? index : null;
  }

  /*
   * SPA 路由回退：/editor/resume_001 这类前端路由在磁盘上没有对应文件，
   * 只有 index.html 能接住它。
   *
   * 但**只对「像路由的路径」生效**，判据见 isSpaRoute。
   */
  if (isSpaRoute(decoded)) {
    const index = path.join(DIST_DIR, 'index.html');
    if ((await statKind(index)) === 'file') {
      return index;
    }
  }

  return null;
}

/**
 * 这个路径能不能当成前端路由？
 *
 * 判据：路径里**任何一段**含 `.` 或以 `.` 开头，就当成静态资源地址，不当路由。
 *
 *   /editor/resume_001  → 路由   → 回退 index.html（200）
 *   /assets/app.js      → 资源   → 缺失即 404
 *   /server/.env        → 资源   → 404
 *   /.git/config        → 资源   → 404
 *
 * 为什么不能只写 `path.extname(...) === ''`：
 * Node 的 `path.extname('.env')` 返回**空串**——点开头的文件名在它看来
 * 没有扩展名。于是 `/server/.env`、`/.gitignore` 会被判成「没有扩展名的路由」
 * 而拿到一份 index.html。那不会真的读出文件内容（越界早就在上面拦掉了），
 * 但一个明确指向敏感文件的请求就不该得到 200。
 *
 * 这一条**不是安全边界**——安全边界永远是「解析后的绝对路径必须仍在 dist 内」。
 * 它只负责让「不是路由的东西」老老实实 404。
 */
function isSpaRoute(decoded) {
  return decoded
    .split('/')
    .filter((segment) => segment !== '')
    .every((segment) => !segment.includes('.'));
}

async function statKind(target) {
  try {
    const stats = await stat(target);
    if (stats.isFile()) return 'file';
    if (stats.isDirectory()) return 'directory';
    return 'other';
  } catch {
    return null;
  }
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* -------------------------------------------------------------------------- */
/* 启动                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 启动自检。
 *
 * 缺 key 时不退出进程：退出会让「前端连不上后端」和「后端起来了但没配 key」
 * 这两种完全不同的故障在现象上无法区分。这里照常监听，所有 AI 请求
 * 统一返回 provider_unavailable，前端显示统一失败文案。
 *
 * 只报告「有没有」，不打印 key 的任何片段、长度或 hash。
 */
const hasApiKey =
  typeof process.env.DEEPSEEK_API_KEY === 'string' && process.env.DEEPSEEK_API_KEY.trim() !== '';

server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  console.log(`[server] static root: ${DIST_DIR}`);
  console.log(`[server] DEEPSEEK_API_KEY: ${hasApiKey ? '已配置' : '缺失'}`);

  if (!hasApiKey) {
    console.warn(
      '[server] 未检测到 DEEPSEEK_API_KEY，/api/ai/optimize-work-bullet 会统一返回失败。请在 server/.env 中配置（该文件已被 .gitignore 覆盖）。',
    );
  }
});
