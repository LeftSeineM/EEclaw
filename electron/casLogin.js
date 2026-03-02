/**
 * 清华大学统一身份认证 - 程序化 HTTP 登录
 * 直接调用 CAS 接口，SM2 加密密码
 */

const https = require('https');
const { URL } = require('url');
const { sm2 } = require('sm-crypto');

const INFO_BASE = 'https://info.tsinghua.edu.cn';
const INFO_LOGIN = 'https://info.tsinghua.edu.cn/';
const LEARN_LOGIN = 'https://learn.tsinghua.edu.cn/f/login';
const LEARN_BASE = 'https://learn.tsinghua.edu.cn';
const ID_BASE = 'https://id.tsinghua.edu.cn';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeaders(setCookieHeaders, url) {
    if (!setCookieHeaders) return;
    const host = new URL(url).hostname;
    const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const raw of list) {
      const [nameVal, ...rest] = raw.split(';').map((s) => s.trim());
      const eq = nameVal.indexOf('=');
      if (eq < 0) continue;
      const name = nameVal.slice(0, eq).trim();
      const value = nameVal.slice(eq + 1).trim();
      let expires = null;
      let path = '/';
      for (const attr of rest) {
        const [k, v] = attr.split('=').map((s) => s?.trim() || '');
        if (k.toLowerCase() === 'expires' && v) expires = new Date(v).getTime();
        if (k.toLowerCase() === 'path' && v) path = v;
      }
      this.cookies.set(`${host}::${name}`, { name, value, host, path, expires });
    }
  }

  getHeader(url) {
    const host = new URL(url).hostname;
    const now = Date.now();
    const parts = [];
    for (const [key, c] of this.cookies) {
      if (!key.startsWith(host + '::')) continue;
      if (c.expires && c.expires < now) {
        this.cookies.delete(key);
        continue;
      }
      parts.push(`${c.name}=${c.value}`);
    }
    return parts.length ? parts.join('; ') : null;
  }

  toLearnCookies() {
    return this.toDomainCookies('learn.tsinghua.edu.cn');
  }

  toInfoCookies() {
    return this.toDomainCookies('info.tsinghua.edu.cn');
  }

  /** 返回指定域及其子域的 cookies（用于持久化） */
  toDomainCookies(domainPart) {
    const list = [];
    for (const [, c] of this.cookies) {
      if (c.host && c.host.includes(domainPart)) {
        const domain = c.host.startsWith('.') ? c.host : '.' + c.host;
        list.push({
          name: c.name,
          value: c.value,
          domain,
          path: c.path || '/',
          expires: c.expires ? Math.floor(c.expires / 1000) : null
        });
      }
    }
    return list;
  }

  /** 返回所有 tsinghua 相关域 cookies（info + learn + id），用于培养方案与网络学堂 */
  toAllTsinghuaCookies() {
    const seen = new Set();
    const list = [];
    const domains = ['info.tsinghua.edu.cn', 'learn.tsinghua.edu.cn', 'id.tsinghua.edu.cn', 'id.sigs.tsinghua.edu.cn', 'zhjw.cic.tsinghua.edu.cn', 'cic.tsinghua.edu.cn'];
    for (const [, c] of this.cookies) {
      if (!c.host) continue;
      const key = `${c.host}::${c.name}`;
      if (seen.has(key)) continue;
      const match = domains.some(d => c.host.includes(d));
      if (match) {
        seen.add(key);
        const domain = c.host.startsWith('.') ? c.host : '.' + c.host;
        list.push({
          name: c.name,
          value: c.value,
          domain,
          path: c.path || '/',
          expires: c.expires ? Math.floor(c.expires / 1000) : null
        });
      }
    }
    return list;
  }
}

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          location: res.headers.location
        })
      );
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function extractCasUrl(html) {
  const m = html.match(/window\.location\.href\s*=\s*'([^']+)'/);
  return m ? m[1] : null;
}

function extractLoginForm(html, baseUrl) {
  const sm2KeyMatch = html.match(/id="sm2publicKey"[^>]*>([^<]+)</);
  const publicKey = sm2KeyMatch ? sm2KeyMatch[1].trim() : null;
  if (!publicKey) return null;

  const formMatch = html.match(/form id="theform"[^>]*action="([^"]*)"[^>]*method="([^"]*)"[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) return null;

  const [, action, , formBody] = formMatch;
  const actionUrl = action.startsWith('http') ? action : new URL(action, baseUrl).href;

  const inputs = {};
  for (const m of formBody.matchAll(/<input[^>]+>/gi)) {
    const tag = m[0];
    const nameMatch = tag.match(/name="([^"]+)"/);
    if (!nameMatch || nameMatch[1] === 'i_pass') continue;
    const name = nameMatch[1];
    const typeMatch = tag.match(/type="([^"]+)"/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
    if (type === 'checkbox') continue;
    const valMatch = tag.match(/value="([^"]*)"/);
    inputs[name] = valMatch ? valMatch[1] : '';
  }

  return { actionUrl, inputs, publicKey };
}

async function loginProgrammatic(username, password) {
  const jar = new CookieJar();
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    // 从 info 信息门户入口获取 CAS 地址（培养方案、选课需从 info 进入）
    const infoUrl = new URL(INFO_LOGIN);
    const infoRes = await request({
      hostname: infoUrl.hostname,
      path: infoUrl.pathname || '/',
      method: 'GET',
      headers: { 'User-Agent': ua }
    });
    jar.setFromHeaders(infoRes.headers['set-cookie'], INFO_LOGIN);

    let casLoginUrl = extractCasUrl(infoRes.body);
    if (!casLoginUrl && infoRes.body.includes('id.tsinghua')) {
      const m = infoRes.body.match(/href=["']([^"']*id\.tsinghua[^"']*)["']/);
      if (m) casLoginUrl = m[1].startsWith('http') ? m[1] : new URL(m[1], INFO_BASE).href;
    }
    if (!casLoginUrl) {
      const learnRes = await request({
        hostname: new URL(LEARN_LOGIN).hostname,
        path: new URL(LEARN_LOGIN).pathname,
        method: 'GET',
        headers: { 'User-Agent': ua }
      });
      jar.setFromHeaders(learnRes.headers['set-cookie'], LEARN_LOGIN);
      casLoginUrl = extractCasUrl(learnRes.body);
    }
    if (!casLoginUrl) return { success: false, error: '无法获取 CAS 登录地址' };

    const casUrl = new URL(casLoginUrl);
    const casRes = await request({
      hostname: casUrl.hostname,
      path: casUrl.pathname + casUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': ua,
        Cookie: jar.getHeader(casLoginUrl) || ''
      }
    });
    jar.setFromHeaders(casRes.headers['set-cookie'], casLoginUrl);

    const form = extractLoginForm(casRes.body, casLoginUrl);
    if (!form) {
      return {
        success: false,
        error: '无法解析 CAS 登录表单，请使用内置窗口登录',
        needBrowser: true
      };
    }

    const encryptedPass = sm2.doEncrypt(password, form.publicKey, 1);
    const postParams = new URLSearchParams({
      ...form.inputs,
      i_user: username.trim(),
      i_pass: encryptedPass
    });
    const postBody = postParams.toString();

    const postUrl = new URL(form.actionUrl);
    const postRes = await request(
      {
        hostname: postUrl.hostname,
        path: postUrl.pathname + postUrl.search,
        method: 'POST',
        headers: {
          'User-Agent': ua,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postBody),
          Cookie: jar.getHeader(form.actionUrl) || ''
        }
      },
      postBody
    );

    jar.setFromHeaders(postRes.headers['set-cookie'], postRes.headers.location || form.actionUrl);

    let loc = postRes.location;
    let lastRes = postRes;
    let followCount = 0;

    while (loc && followCount < 15) {
      const fullUrl = loc.startsWith('http') ? loc : new URL(loc, ID_BASE).href;
      const u = new URL(fullUrl);
      const nextRes = await request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': ua,
          Cookie: jar.getHeader(fullUrl) || ''
        }
      });
      jar.setFromHeaders(nextRes.headers['set-cookie'], fullUrl);
      lastRes = nextRes;
      loc = nextRes.location;
      followCount++;
    }

    const allCookies = jar.toAllTsinghuaCookies();
    if (allCookies.length > 0) {
      return { success: true, cookies: allCookies };
    }
    const learnCookies = jar.toLearnCookies();
    if (learnCookies.length > 0) {
      return { success: true, cookies: learnCookies };
    }
    const infoCookies = jar.toInfoCookies();
    if (infoCookies.length > 0) {
      return { success: true, cookies: infoCookies };
    }

    if (
      lastRes.body.includes('验证码') ||
      lastRes.body.includes('二次') ||
      lastRes.body.includes('验证') ||
      lastRes.body.includes('不正确')
    ) {
      if (lastRes.body.includes('用户名或密码不正确')) {
        return { success: false, error: '用户名或密码不正确' };
      }
      return {
        success: false,
        need2FA: true,
        error: '需要二次验证，请使用内置窗口完成',
        needBrowser: true
      };
    }

    if (lastRes.location) {
      const loc = lastRes.location;
      if (loc.includes('info.tsinghua.edu.cn') || loc.includes('learn.tsinghua.edu.cn')) {
        const u = new URL(loc.startsWith('http') ? loc : new URL(loc, ID_BASE).href);
        const finalRes = await request({
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'GET',
          headers: {
            'User-Agent': ua,
            Cookie: jar.getHeader(loc) || ''
          }
        });
        jar.setFromHeaders(finalRes.headers['set-cookie'], loc);
      }
      const fc = jar.toAllTsinghuaCookies();
      if (fc.length > 0) return { success: true, cookies: fc };
    }

    return { success: false, error: '登录失败，请使用内置窗口重试', needBrowser: true };
  } catch (e) {
    return { success: false, error: e?.message || '网络请求异常' };
  }
}

/**
 * 获取 CAS 登录页 URL（用于 BrowserWindow）
 * 优先从 info 入口获取，失败则回退 learn
 */
async function getCasLoginUrl() {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const infoRes = await request({
      hostname: new URL(INFO_LOGIN).hostname,
      path: new URL(INFO_LOGIN).pathname || '/',
      method: 'GET',
      headers: { 'User-Agent': ua }
    });
    let url = extractCasUrl(infoRes.body);
    if (url) return url;
    const learnRes = await request({
      hostname: new URL(LEARN_LOGIN).hostname,
      path: new URL(LEARN_LOGIN).pathname,
      method: 'GET',
      headers: { 'User-Agent': ua }
    });
    url = extractCasUrl(learnRes.body);
    return url || LEARN_LOGIN;
  } catch {
    return LEARN_LOGIN;
  }
}

module.exports = { loginProgrammatic, getCasLoginUrl, CookieJar, INFO_LOGIN, INFO_BASE };
