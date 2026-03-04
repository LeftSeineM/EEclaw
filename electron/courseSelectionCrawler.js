 /**
 * 培养方案抓取模块
 * 优先尝试：learn getzhjwTicket → 纯 HTTP 请求 zhjw 培养方案
 * 失败则回退：BrowserWindow 加载 info → 搜索 → 点击进入
 *
 * 应用搜索 URL 格式（可复用）：
 *   https://info.tsinghua.edu.cn/f/info/portal_fg/common/yyfwsearch?searchParam=<编码后的关键词>
 */

const { BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const { URL } = require('url');
const auth = require('./auth');
const casLogin = require('./casLogin');
const storageConfig = require('./storageConfig');

const INFO_BASE = 'https://info.tsinghua.edu.cn';
const LEARN_BASE = 'https://learn.tsinghua.edu.cn';
const ZHJW_BASE = 'https://zhjw.cic.tsinghua.edu.cn';
const ZHJW_BASE_HTTP = 'http://zhjw.cic.tsinghua.edu.cn';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** 构建 info 应用搜索 URL，searchParam 为要搜索的关键词（会自动编码） */
function getInfoSearchUrl(keyword) {
  return `${INFO_BASE}/f/info/portal_fg/common/yyfwsearch?searchParam=${encodeURIComponent(keyword)}`;
}

function getSession() {
  return auth.getSessionForCourseSelection();
}

/**
 * 方案 A：通过 learn 的 getzhjwTicket 接口，纯 HTTP 获取培养方案 HTML
 * 无需 BrowserWindow，仅需 learn 登录态
 * @param {{ onLog?: (msg: string) => void }} opts
 * @returns {Promise<{ success: boolean, html?: string, error?: string }>}
 */
async function fetchTrainingPlanByTicket(opts = {}) {
  const { onLog = () => {} } = opts;
  const log = (msg) => { onLog(`[Ticket] [${new Date().toLocaleTimeString()}] ${msg}`); };

  log('========== 开始 learn ticket 纯 HTTP 流程 ==========');

  // 步骤 1：检查 learn 登录态
  if (!auth.hasValidLearnSession()) {
    log('❌ 无 learn 会话，请先在主界面登录网络学堂');
    return { success: false, error: '无 learn 会话，请先登录网络学堂' };
  }
  log('✓ 已有 learn 会话');

  const cookieHeader = auth.getCookieHeaderForCrawler();
  if (!cookieHeader) {
    log('❌ 无法获取 Cookie 头');
    return { success: false, error: '无法获取 Cookie' };
  }
  log('✓ 已获取 Cookie 头（长度 ' + cookieHeader.length + '）');

  const xsrf = auth.getXsrfToken?.();
  if (!xsrf) {
    log('⚠️ 无 XSRF-TOKEN，尝试请求 getzhjwTicket（部分接口可能不强制 XSRF）');
  } else {
    log('✓ 已获取 XSRF-TOKEN（长度 ' + xsrf.length + '）');
  }

  // 步骤 2：请求 learn getzhjwTicket
  const ticketUrl = `${LEARN_BASE}/b/wlxt/common/auth/getzhjwTicket${xsrf ? '?_csrf=' + encodeURIComponent(xsrf) : ''}`;
  log('步骤 2: 请求 getzhjwTicket');
  log('  URL: ' + ticketUrl);

  const ticket = await new Promise((resolve, reject) => {
    const u = new URL(ticketUrl);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': UA,
          Cookie: cookieHeader,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: LEARN_BASE + '/',
          Accept: '*/*'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          log('  getzhjwTicket 响应: status=' + res.statusCode + ', body长度=' + body.length);
          if (res.statusCode === 401 || res.statusCode === 403) {
            log('❌ getzhjwTicket 返回 ' + res.statusCode + '，可能未登录或会话过期');
            reject(new Error('getzhjwTicket 认证失败: ' + res.statusCode));
            return;
          }
          if (res.statusCode === 302 && res.headers.location?.includes('/f/login')) {
            log('❌ 被重定向到登录页，learn 会话已过期');
            reject(new Error('learn 会话已过期'));
            return;
          }
          const trimmed = (body || '').trim();
          if (!trimmed) {
            log('❌ getzhjwTicket 返回空 body');
            reject(new Error('getzhjwTicket 返回空'));
            return;
          }
          if (trimmed.length > 500) {
            log('⚠️ ticket 异常偏长，可能返回了 HTML 错误页');
            if (trimmed.includes('<html') || trimmed.includes('<!DOCTYPE')) {
              log('  确认为 HTML 页面，非 ticket');
              reject(new Error('getzhjwTicket 返回 HTML 而非 ticket'));
              return;
            }
          }
          const cleaned = trimmed.replace(/^["']|["']$/g, '');
          if (cleaned !== trimmed) {
            log('  已去除 ticket 首尾引号');
          }
          log('✓ 获取到 ticket（长度 ' + cleaned.length + '）');
          resolve(cleaned);
        });
      }
    );
    req.on('error', (e) => {
      log('❌ getzhjwTicket 请求异常: ' + (e?.message || e));
      reject(e);
    });
    req.end();
  }).catch((e) => {
    log('❌ getzhjwTicket 失败: ' + (e?.message || String(e)));
    return null;
  });

  if (!ticket) {
    return { success: false, error: '获取 zhjw ticket 失败' };
  }

  // 步骤 3：用 ticket 请求 zhjw 培养方案（参考 course-helper URL 格式）
  const targetPath = `/jhBks.by_fascjgmxb_gr.do?m=queryFaScjgmx_gr&xsViewFlag=pyfa&pathContent=培养方案完成情况`;
  const zhjwLoginUrl = `${ZHJW_BASE_HTTP}/j_acegi_login.do?ticket=${encodeURIComponent(ticket)}&url=${encodeURIComponent(targetPath)}`;
  log('步骤 3: 用 ticket 访问 zhjw 培养方案');
  log('  URL: ' + zhjwLoginUrl.slice(0, 120) + '…');

  const html = await fetchWithRedirects(zhjwLoginUrl, cookieHeader, log);
  if (!html) {
    return { success: false, error: '访问 zhjw 培养方案失败' };
  }

  // 步骤 4：验证内容
  const hasTable = html.includes('<table') || html.includes('<TABLE');
  const hasKeyword = html.includes('课组') || html.includes('课程属性') || html.includes('培养方案');
  log('步骤 4: 内容验证');
  log('  包含 table: ' + hasTable + ', 包含关键词: ' + hasKeyword + ', HTML 长度: ' + html.length);

  if (html.includes('请登录') || html.includes('会话已过期') || html.includes('未登录')) {
    log('❌ 页面提示需登录，ticket 可能无效或已过期');
    return { success: false, error: 'zhjw 返回登录页，ticket 可能无效' };
  }
  if (html.includes('认证失败') || html.includes('sso_fail')) {
    log('❌ 页面为 SSO 认证失败页，ticket 无效');
    return { success: false, error: 'zhjw 认证失败，ticket 无效' };
  }
  if (hasTable && !hasKeyword && html.length < 2000) {
    log('❌ 内容过短且无培养方案关键词，疑似错误页');
    return { success: false, error: '返回内容疑似错误页，非培养方案' };
  }

  if (!hasTable || !hasKeyword) {
    log('⚠️ 内容可能不完整，但先返回供调试');
  } else {
    log('✓ 内容验证通过');
  }

  log('========== learn ticket 流程成功 ==========');
  return { success: true, html };
}

/**
 * 带重定向跟随的 HTTP/HTTPS 请求，返回最终 HTML
 */
function fetchWithRedirects(url, initialCookie, log, maxRedirects = 10) {
  return new Promise((resolve) => {
    let currentUrl = url;
    let cookieHeader = initialCookie || '';
    let redirectCount = 0;

    function doRequest(targetUrl) {
      const u = new URL(targetUrl);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;
      const req = lib.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'GET',
          headers: {
            'User-Agent': UA,
            Cookie: cookieHeader,
            Accept: 'text/html,application/xhtml+xml,*/*;q=0.9'
          }
        },
        (res) => {
          const loc = res.headers.location;
          const setCookies = res.headers['set-cookie'];

          if (setCookies) {
            const parts = (Array.isArray(setCookies) ? setCookies : [setCookies])
              .map((s) => s.split(';')[0].trim())
              .filter(Boolean);
            if (parts.length) {
              const extra = parts.join('; ');
              cookieHeader = cookieHeader ? cookieHeader + '; ' + extra : extra;
              log('  收到 Set-Cookie，已合并到后续请求');
            }
          }

          if ((res.statusCode === 301 || res.statusCode === 302) && loc && redirectCount < maxRedirects) {
            redirectCount++;
            const next = loc.startsWith('http') ? loc : new URL(loc, targetUrl).href;
            log('  跟随重定向 #' + redirectCount + ': ' + next.slice(0, 80) + '…');
            if (next.includes('sso_fail')) {
              log('❌ 重定向到 SSO 失败页，ticket 无效');
              resolve(null);
              return;
            }
            doRequest(next);
            return;
          }

          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            log('  最终响应: status=' + res.statusCode + ', body长度=' + body.length);
            if (res.statusCode >= 400) {
              log('❌ HTTP ' + res.statusCode);
              resolve(null);
              return;
            }
            resolve(body);
          });
        }
      );
      req.on('error', (e) => {
        log('❌ 请求异常: ' + (e?.message || e));
        resolve(null);
      });
      req.end();
    }

    doRequest(currentUrl);
  });
}

/**
 * 抓取培养方案 HTML
 * 优先：learn getzhjwTicket 纯 HTTP 流程
 * 失败则回退：BrowserWindow + info 流程
 * @param {{ onLog?: (msg: string) => void }} opts
 */
async function fetchTrainingPlanHTML(opts = {}) {
  const { onLog = () => {} } = opts;
  const log = (msg) => { onLog(`[${new Date().toLocaleTimeString()}] ${msg}`); };

  // ========== 方案 A：优先尝试 learn ticket 纯 HTTP ==========
  if (auth.hasValidLearnSession()) {
    log('检测到 learn 会话，优先尝试 getzhjwTicket 纯 HTTP 流程…');
    const ticketResult = await fetchTrainingPlanByTicket(opts);
    if (ticketResult.success && ticketResult.html) {
      log('✓ 纯 HTTP 流程成功，无需打开浏览器');
      try {
        const htmlPath = path.join(storageConfig.getDataBasePath(), 'training-plan-last.html');
        fs.writeFileSync(htmlPath, ticketResult.html, 'utf8');
        log('已保存原始 HTML 到: ' + htmlPath);
      } catch (_) {}
      return { success: true, html: ticketResult.html, error: null };
    }
    log('⚠️ 纯 HTTP 流程失败，回退到 BrowserWindow 流程');
    log('  失败原因: ' + (ticketResult.error || '未知'));
  } else {
    log('无 learn 会话，跳过 ticket 流程，直接使用 BrowserWindow');
  }

  // ========== 方案 B：BrowserWindow + info 流程 ==========
  log('========== 开始 BrowserWindow 流程 ==========');

  const sess = getSession();
  // 若无 info 会话且无保存凭据，需先登录并勾选「保存凭据」
  if (!auth.hasValidInfoSession() && !auth.hasCredentials()) {
    log('❌ 请先在主界面登录并勾选「保存凭据」');
    return { success: false, html: null, error: '请先在主界面登录并勾选「保存凭据」' };
  }
  // 若有凭据但无 info 会话，先尝试程序化登录，失败则交给 BrowserWindow 点击登录
  if (!auth.hasValidInfoSession() && auth.hasCredentials()) {
    const cred = auth.loadCredentials();
    const loginResult = await auth.ensureLoginToInfo(cred);
    if (loginResult.success) {
      log('已使用保存的凭据自动登录 info');
    }
    // 程序化失败不直接返回，继续用 BrowserWindow 流程（会先点击 info 登录再搜索）
  }
  try {
    await auth.restoreAuthToSession(sess);
    log('已恢复登录态到爬虫 session');
  } catch (_) {}

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true, // 调试：全程显示窗口便于观察
      webPreferences: {
        session: sess,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    let resolved = false;
    function safe() { return !resolved && win && !win.isDestroyed(); }
    function finish(success, html, error, silent) {
      if (resolved) return;
      resolved = true;
      if (!silent) log("[位置] finish 被调用: success=" + !!success + ", error=" + (error || "(无)"));
      try {
        win.destroy();
      } catch (_) {}
      resolve({ success: !!success, html: html || null, error: error || null });
    }

    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // 若应用在新窗口打开，改为在当前窗口加载（培养方案链接常为 target="_blank"）
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (!win || win.isDestroyed()) return { action: 'deny' };
      if (url && (url.includes('jhBks') || url.includes('zhjw') || url.includes('zhjwxk') || url.includes('j_acegi_login') || url.includes('info.tsinghua'))) {
        log(`应用在新窗口打开，改为当前窗口加载: ${url.slice(0, 70)}…`);
        win.loadURL(url, { userAgent: ua });
      }
      return { action: 'deny' };
    });

    let casInjectAttempted = false;
    let justLoggedInFromCas = false;

    // 步骤 1: 先加载 info 建立会话（培养方案需从 info 登录后的 session 访问）
    log('步骤 1: 加载 info.tsinghua.edu.cn…');
    win.loadURL(INFO_BASE + '/', { userAgent: ua });

    const onLoad = async () => {
      try {
      const url = win.webContents.getURL();
      log(`当前页面: ${url.slice(0, 80)}${url.length > 80 ? '…' : ''}`);

      // 在 CAS 页：使用保存的凭据自动填充并提交（须优先于 /login 判断，因 CAS URL 含 login 路径）
      if ((url.includes('id.tsinghua') || url.includes('id.sigs')) && !url.includes('jhBks')) {
        if (!auth.hasCredentials()) {
          log('❌ 需要登录 info，请先在主界面登录并勾选「保存凭据」');
          finish(false, null, '请先在主界面登录并勾选「保存凭据」');
          return;
        }
        if (!casInjectAttempted) {
          casInjectAttempted = true;
          const cred = auth.loadCredentials();
          if (!cred?.username || !cred?.password) {
            log('❌ 凭据无效或已过期，请重新登录并保存凭据');
            finish(false, null, '凭据无效或已过期，请重新登录并保存凭据');
            return;
          }
          log('⏳ 在 CAS 页，使用保存的凭据自动登录…');
          await new Promise((r) => setTimeout(r, 3000));
          let lastReason = '';
          for (let i = 0; i < 10; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, 1000));
            try {
              const result = await win.webContents.executeJavaScript(auth.getAuthInjectScript(cred.username, cred.password));
              if (result?.ok) {
                log('✓ 已提交登录表单，等待跳转…');
                justLoggedInFromCas = true;
                return;
              }
              lastReason = result?.reason || '';
            } catch (e) {
              lastReason = e?.message || '执行异常';
            }
          }
          log(`❌ 自动填充失败 (${lastReason || '表单未找到'})`);
          finish(false, null, 'CAS 自动登录失败：' + (lastReason || '表单未找到'));
        }
        return;
      }

      if (url.includes('/login')) {
        log('❌ 检测到登录页，未登录或会话已过期');
        finish(false, null, '未登录或会话已过期，请先登录信息门户');
        return;
      }

      // 若已在培养方案页（如从书签等直接进入）
      if (url.includes('jhBks.by_fascjgmxb_gr.do')) {
        log('✓ 已在培养方案页，开始提取');
        win.webContents.off('did-finish-load', onLoad);
        await tryExtractWithRefresh(win, finish, log);
        return;
      }

      // 在 info 上：先检查是否已登录，未登录则点击右上角「登录」进入 CAS
      if (url.startsWith(INFO_BASE) || url.includes('info.tsinghua')) {
        const isSearchPage = url.includes('yyfwsearch');
        if (!isSearchPage && !justLoggedInFromCas) {
          const needLoginResult = await win.webContents.executeJavaScript(`
            (function() {
              function isLoginBtn(t) {
                var s = (t || '').trim();
                if (s === '登录' || s === '登录 ') return true;
                if (s.indexOf('退出') >= 0 || s.indexOf('登出') >= 0) return false;
                return false;
              }
              var el = document.querySelector('a.onload, .onload, a[href*="id.tsinghua"], a[href*="id.sigs"]');
              if (el && isLoginBtn(el.textContent)) return { needLogin: true };
              var all = document.querySelectorAll('a.onload, .onload');
              for (var i = 0; i < all.length; i++) {
                if (isLoginBtn(all[i].textContent)) return { needLogin: true };
              }
              return { needLogin: false };
            })();
          `);
          if (needLoginResult?.needLogin) {
            if (!auth.hasCredentials()) {
              log('❌ 需要登录 info，请先在主界面登录并勾选「保存凭据」');
              finish(false, null, '请先在主界面登录并勾选「保存凭据」');
              return;
            }
            log('步骤 2: 检测到未登录，点击右上角「登录」进入 CAS…');
            await new Promise((r) => setTimeout(r, 1200));
            const clickResult = await win.webContents.executeJavaScript(auth.getInfoHomepageLoginScript());
            if (clickResult?.ok && clickResult.action === 'navigate' && clickResult.url) {
              win.loadURL(clickResult.url, { userAgent: ua });
              return;
            }
            if (clickResult?.ok && clickResult.action === 'click') {
              return;
            }
            const casUrl = await casLogin.getCasLoginUrl('info');
            if (casUrl && casUrl.includes('id.tsinghua')) {
              log('  无法点击登录按钮，直接加载 CAS 页…');
              win.loadURL(casUrl, { userAgent: ua });
            } else {
              finish(false, null, '无法找到 info 登录入口');
            }
            return;
          }
        }

        win.webContents.off('did-finish-load', onLoad);
        log('✓ 已在 info 登录，等待 1 秒后打开搜索页…');
        try {
          const allCookies = [];
          for (const base of [INFO_BASE + '/', 'https://id.tsinghua.edu.cn/', 'https://zhjw.cic.tsinghua.edu.cn/']) {
            const c = await sess.cookies.get({ url: base });
            if (Array.isArray(c)) allCookies.push(...c);
          }
          const byKey = new Map();
          for (const c of allCookies) {
            if (c.name && c.value) byKey.set(`${c.domain || ''}::${c.name}`, c);
          }
          const cookies = Array.from(byKey.values()).map((x) => ({
            name: x.name,
            value: x.value,
            domain: x.domain || '.tsinghua.edu.cn',
            path: x.path || '/',
            expires: x.expirationDate ? Math.floor(x.expirationDate) : null
          }));
          if (cookies.length > 0) await auth.persistAuthState(cookies);
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 1000));
        const searchUrl = getInfoSearchUrl('培养方案完成情况');
        log('步骤 3: 打开应用搜索页…');
        win.loadURL(searchUrl, { userAgent: ua });
        win.webContents.once('did-finish-load', async () => {
          try {
          if (!safe()) return;
          const u = win.webContents.getURL();
          if (u.includes('login') || u.includes('id.tsinghua')) {
            log('❌ 被重定向到登录页，请确认已从信息门户登录');
            finish(false, null, '无法访问培养方案，请确认已从信息门户登录');
            return;
          }
          log(`步骤 4: 当前 URL: ${u}`);
          log('  等待 2 秒让搜索结果加载…');
          await new Promise((r) => setTimeout(r, 2000));
          if (!safe()) return;

          const execWithTimeout = (script, ms = 8000) => {
            const p = win.webContents.executeJavaScript(script);
            p.catch(() => {}); // 超时后若原 promise 仍 reject，避免 UnhandledPromiseRejection
            return Promise.race([
              p,
              new Promise((_, reject) => setTimeout(() => reject(new Error('执行超时')), ms))
            ]);
          };

          log('  步骤 5: 先点击「应用导航」标签，过滤到目标应用…');
          const tabClicked = await execWithTimeout(`
            (function() {
              function txt(el) { return (el.textContent || '').trim(); }
              function isAppNavTab(el) {
                var t = txt(el);
                if (t !== '应用导航' && t.indexOf('应用导航') !== 0) return false;
                if (t.length > 30) return false;
                var par = el.parentElement;
                if (par && txt(par).length > 200) return false;
                return true;
              }
              var candidates = Array.from(document.querySelectorAll('[role="tab"], .ant-tabs-tab, [class*="tab"] a, [class*="tab"] span, a, button, span'));
              var appNav = candidates.find(isAppNavTab);
              if (!appNav) {
                var fallback = Array.from(document.querySelectorAll('*')).find(function(el) {
                  return txt(el) === '应用导航' && el.offsetParent && el.offsetWidth > 0 && el.offsetHeight > 0;
                });
                appNav = fallback;
              }
              if (appNav) {
                appNav.scrollIntoView({ block: 'center' });
                appNav.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                if (appNav.click) appNav.click();
                return true;
              }
              return false;
            })();
          `);
          if (tabClicked) {
            log('  已点击应用导航，等待 3 秒…');
            await new Promise((r) => setTimeout(r, 3000));
            if (!safe()) return;
          }
          log('  正在查找并点击培养方案应用卡片…');
          const currentUrlBeforeFind = win.webContents.getURL();
          log("[位置] 查找前 URL: " + currentUrlBeforeFind.slice(0, 100));

          let result;
          try {
            result = await execWithTimeout(`
            (function() {
              var target = '培养方案完成情况';
              function getLinkInfo(el) {
                if (!el) return null;
                var href = el.getAttribute('href') || '';
                var onclick = el.getAttribute('onclick') || '';
                return { found: true, href: href, onclick: onclick.slice(0, 300) };
              }
              function isArticleLink(a) {
                var h = (a.getAttribute('href') || '').toLowerCase();
                var cls = (a.className || '') + ' ' + (a.parentElement && a.parentElement.className || '');
                return h.indexOf('/article') >= 0 || h.indexOf('/news') >= 0 || cls.indexOf('article') >= 0 || cls.indexOf('news') >= 0;
              }
              var links = Array.from(document.querySelectorAll('a'));
              var appLink = links.find(function(a) {
                var t = (a.textContent || '').trim();
                return t.indexOf(target) >= 0 && !isArticleLink(a) && (t.indexOf('教务处') >= 0 || t.indexOf('培养方案') >= 0);
              });
              if (appLink) return getLinkInfo(appLink);
              appLink = links.find(function(a) {
                return (a.textContent || '').indexOf(target) >= 0 && (a.getAttribute('onclick') || '').indexOf('tiaozhuan') >= 0;
              });
              if (appLink) return getLinkInfo(appLink);
              appLink = links.find(function(a) {
                return (a.textContent || '').indexOf(target) >= 0 && !isArticleLink(a);
              });
              if (appLink) return getLinkInfo(appLink);
              var cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], [class*="item"], [class*="app"], [class*="result"], [class*="search"], [class*="tile"], [class*="Tile"]'));
              var card = cards.find(function(c) {
                var t = (c.textContent || '');
                return t.indexOf(target) >= 0 && (t.indexOf('教务处') >= 0 || t.indexOf('培养方案') >= 0);
              });
              if (card) {
                var a = card.querySelector('a');
                if (a && !isArticleLink(a)) return getLinkInfo(a);
                return getLinkInfo(card);
              }
              card = cards.find(function(c) { return (c.textContent || '').indexOf(target) >= 0; });
              if (card) {
                var a = card.querySelector('a');
                if (a && !isArticleLink(a)) return getLinkInfo(a);
                return getLinkInfo(card);
              }
              var divs = Array.from(document.querySelectorAll('div'));
              var divCard = divs.find(function(d) {
                var t = (d.textContent || '');
                return t.indexOf(target) >= 0 && (t.indexOf('教务处') >= 0 || t.indexOf('培养方案') >= 0) && d.offsetParent && d.offsetWidth > 0;
              });
              if (divCard) {
                var a = divCard.querySelector('a');
                if (a && !isArticleLink(a)) return getLinkInfo(a);
                return getLinkInfo(divCard);
              }
              divCard = divs.find(function(d) {
                var t = (d.textContent || '');
                return t.indexOf(target) >= 0 && d.offsetParent && d.offsetWidth > 0;
              });
              if (divCard) {
                var a = divCard.querySelector('a');
                if (a && !isArticleLink(a)) return getLinkInfo(a);
                return getLinkInfo(divCard);
              }
              return { found: false };
            })();
          `);
          } catch (e) {
            log(`❌ 查找链接失败: ${e?.message || '未知'}`);
            finish(false, null, e?.message || '查找链接失败');
            return;
          }

          if (!result?.found) {
            log('❌ 未找到「培养方案完成情况」入口');
            log("[位置] 查找结果: result=" + JSON.stringify(result));
            finish(false, null, '未找到培养方案应用入口');
            return;
          }

          // 方式 A：直接加载 URL（若 href/onclick 含 jhBks/zhjw）
          let directUrl = null;
          if (result.href && (result.href.startsWith('http') || result.href.startsWith('//'))) {
            directUrl = result.href.startsWith('//') ? 'https:' + result.href : result.href;
          }
          if (!directUrl && result.onclick) {
            const o = result.onclick + '';
            let m = o.match(/['"](https?:\/\/[^'"]*(?:jhBks|zhjw|j_acegi_login)[^'"]*)["'"]/);
            if (!m) m = o.match(/(https?:\/\/[^'"\\s]*(?:jhBks|zhjw|j_acegi_login)[^'"\\s]*)/);
            if (m) directUrl = m[1];
          }
          if (directUrl && (directUrl.includes('jhBks') || directUrl.includes('zhjw') || directUrl.includes('j_acegi_login'))) {
            log(`✓ 找到直接链接，加载: ${directUrl.slice(0, 70)}…`);
            win.loadURL(directUrl, { userAgent: ua });
            win.webContents.once('did-finish-load', async () => {
              const u = win.webContents.getURL();
              if (u.includes('jhBks') || u.includes('zhjw') || u.includes('j_acegi_login')) {
                await tryExtractWithRefresh(win, finish, log);
              } else {
                log(`直接加载后 URL: ${u}`);
                finish(false, null, '直接加载后仍未进入培养方案页');
              }
            });
            return;
          }

          // 方式 B：点击链接/卡片进入
          log(`  链接 href: ${(result.href || '(空)').slice(0, 80)}`);
          let clicked;
          try {
            clicked = await execWithTimeout(`
            (function() {
              var target = '培养方案完成情况';
              function doClick(el) {
                if (!el) return false;
                el.scrollIntoView({ block: 'center' });
                if (el.focus) el.focus();
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 1 }));
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                if (el.click) el.click();
                return true;
              }
              function isArticleLink(a) {
                if (!a || a.tagName !== 'A') return false;
                var h = (a.getAttribute('href') || '').toLowerCase();
                var cls = (a.className || '') + ' ' + (a.parentElement && a.parentElement.className || '');
                return h.indexOf('/article') >= 0 || h.indexOf('/news') >= 0 || cls.indexOf('article') >= 0 || cls.indexOf('news') >= 0;
              }
              var cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], [class*="item"], [class*="app"], [class*="result"], [class*="tile"], [class*="Tile"]'));
              var appCard = cards.find(function(c) {
                var t = (c.textContent || '');
                return t.indexOf(target) >= 0 && (t.indexOf('教务处') >= 0 || t.indexOf('培养方案') >= 0);
              });
              if (appCard) {
                var a = appCard.querySelector('a');
                if (a && !isArticleLink(a)) return doClick(a);
                return doClick(appCard);
              }
              appCard = cards.find(function(c) { return (c.textContent || '').indexOf(target) >= 0; });
              if (appCard) {
                var a = appCard.querySelector('a');
                if (a && !isArticleLink(a)) return doClick(a);
                return doClick(appCard);
              }
              var divs = Array.from(document.querySelectorAll('div'));
              var appDiv = divs.find(function(d) {
                var t = (d.textContent || '');
                return t.indexOf(target) >= 0 && (t.indexOf('教务处') >= 0 || t.indexOf('培养方案') >= 0) && d.offsetParent && d.offsetWidth > 0;
              });
              if (appDiv) {
                var a = appDiv.querySelector('a');
                if (a && !isArticleLink(a)) return doClick(a);
                return doClick(appDiv);
              }
              appDiv = divs.find(function(d) {
                var t = (d.textContent || '');
                return t.indexOf(target) >= 0 && d.offsetParent && d.offsetWidth > 0;
              });
              if (appDiv) {
                var a = appDiv.querySelector('a');
                if (a && !isArticleLink(a)) return doClick(a);
                return doClick(appDiv);
              }
              var links = Array.from(document.querySelectorAll('a'));
              var appLink = links.find(function(a) {
                var t = (a.textContent || '');
                return t.indexOf(target) >= 0 && t.indexOf('教务处') >= 0 && !isArticleLink(a);
              });
              if (appLink) return doClick(appLink);
              appLink = links.find(function(a) {
                return (a.textContent || '').indexOf(target) >= 0 && !isArticleLink(a);
              });
              if (appLink) return doClick(appLink);
              return false;
            })();
          `);
          } catch (e2) {
            log(`❌ 点击失败: ${e2?.message || '未知'}`);
            finish(false, null, e2?.message || '点击失败');
            return;
          }
          if (!clicked) {
            finish(false, null, '点击失败');
            return;
          }
          log('✓ 已点击，等待跳转…');
          const navPromise = new Promise((resolve) => {
            const onNav = (_, url) => {
              if (url && (url.includes('jhBks') || url.includes('zhjw.cic') || url.includes('zhjw') || url.includes('j_acegi_login'))) {
                win.webContents.off('did-navigate', onNav);
                resolve(true);
              }
            };
            win.webContents.on('did-navigate', onNav);
            setTimeout(() => {
              win.webContents.off('did-navigate', onNav);
              resolve(false);
            }, 8000);
          });
          const navOk = await navPromise;
          if (!safe()) return;
          if (navOk) {
            await new Promise((r) => setTimeout(r, 3000));
            if (!safe()) return;
            await tryExtractWithRefresh(win, finish, log);
            return;
          }
          let u2 = win.webContents.getURL();
          if (u2.includes('jhBks') || u2.includes('zhjw') || u2.includes('j_acegi_login')) {
            await tryExtractWithRefresh(win, finish, log);
            return;
          }
          log(`点击后未跳转（当前仍为: ${u2.slice(0, 60)}…），尝试方式 C 备用 URL`);
          const fallbackUrl = 'https://zhjw.cic.tsinghua.edu.cn/jhBks.by_fascjgmxb_gr.do?url=/jhBks.by_fascjgmxb_gr.do&xsViewFlag=pyfa&pathContent=' + encodeURIComponent('培养方案完成情况') + '&m=queryFaScjgmx_gr';
          win.loadURL(fallbackUrl, { userAgent: ua });
          win.webContents.once('did-finish-load', async () => {
            const u2After = win.webContents.getURL();
            if (u2After.includes('jhBks') || u2After.includes('zhjw') || u2After.includes('j_acegi_login')) {
              await tryExtractWithRefresh(win, finish, log);
            } else {
              log(`当前 URL: ${u2After}`);
              finish(false, null, '直接加载后仍未进入培养方案页');
            }
          });
          } catch (err) {
            const msg = (err && err.message) || String(err);
            if (msg.includes('destroyed') || msg.includes('Object has been destroyed')) {
              finish(false, null, '窗口已关闭');
              return;
            }
            log(`❌ 异常: ${msg}`);
            finish(false, null, msg || '抓取异常');
          }
        });
        return;
      }

      // 其他情况（如已在 zhjw 等）也尝试提取
      if (url.includes('zhjw.cic') || url.includes('zhjw') || url.includes('jhBks') || url.includes('j_acegi_login')) {
        win.webContents.off('did-finish-load', onLoad);
        await tryExtractWithRefresh(win, finish, log);
        return;
      }
      } catch (err) {
        const msg = (err && err.message) || String(err);
            if (msg.includes('destroyed') || msg.includes('Object has been destroyed')) {
              finish(false, null, '窗口已关闭');
              return;
            }
            log(`❌ 异常: ${msg}`);
            finish(false, null, msg || '抓取异常');
      }
    };

    win.webContents.on('did-finish-load', onLoad);
    win.webContents.on('did-fail-load', (_, code, desc, url, isMainFrame) => {
      if (!resolved && isMainFrame) {
        log(`❌ 主页面加载失败: ${desc || code}`);
        finish(false, null, `加载失败: ${desc || code}`);
      }
    });
    setTimeout(() => {
      if (!resolved) finish(false, null, '抓取超时', true);
    }, 60000);
  });
}

async function tryExtractWithRefresh(win, finish, log = () => {}) {
  try {
    win.show();
    win.focus(); // 调试：置顶并聚焦，便于查看当前页面
    log('提取页面内容…');
    const hasRefresh = await win.webContents.executeJavaScript(`
      (function() {
        var btn = Array.from(document.querySelectorAll('input[type="button"]'))
          .find(b => b && b.value && b.value.includes('刷新培养方案完成情况'));
        if (btn) { btn.click(); return true; }
        return false;
      })();
    `);

    if (hasRefresh) {
      log('  点击「刷新培养方案完成情况」按钮，等待 5 秒让表格加载…');
      await new Promise((r) => setTimeout(r, 5000));
    }
    // 某些页面先落在壳层，需要手动触发 frm 提交到 scBksPyfa 才会出真实表格
    const submitTriggered = await win.webContents.executeJavaScript(`
      (function() {
        try {
          if (document && document.frm && document.frm.m) {
            document.frm.m.value = 'scBksPyfa';
            if (document.frm.submit) {
              document.frm.submit();
              return true;
            }
          }
        } catch (_) {}
        return false;
      })();
    `);
    if (submitTriggered) {
      log('  检测到 frm 壳层，已触发 scBksPyfa 提交，等待 3 秒…');
      await new Promise((r) => setTimeout(r, 3000));
    }

    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      result = await win.webContents.executeJavaScript(`
        (function() {
          function getDocs() {
            var docs = [document];
            var frames = document.querySelectorAll('iframe, frame');
            for (var i = 0; i < frames.length; i++) {
              try {
                if (frames[i].contentDocument) docs.push(frames[i].contentDocument);
              } catch (_) {}
            }
            return docs;
          }
          function inspectDoc(doc, fromFrame) {
            var body = doc && doc.body ? (doc.body.textContent || '') : '';
            var table = doc ? doc.querySelector('table') : null;
            var rows = table ? table.querySelectorAll('tr') : [];
            var rowCount = rows ? rows.length : 0;
            var hasTitle = body.includes('培养方案完成情况') || body.includes('培养方案');
            var hasCourseAttr = body.includes('课程属性') || body.includes('课程号') || body.includes('学分');
            var html = doc && doc.documentElement ? doc.documentElement.outerHTML : '';
            return {
              fromFrame: !!fromFrame,
              body: body,
              rowCount: rowCount,
              hasTitle: hasTitle,
              hasCourseAttr: hasCourseAttr,
              html: html
            };
          }

          var docs = getDocs();
          var candidates = [];
          var hasLoginRequired = false;
          var hasSsoFail = false;
          var mergedText = '';
          for (var i = 0; i < docs.length; i++) {
            var c = inspectDoc(docs[i], i > 0);
            candidates.push(c);
            mergedText += '\\n' + (c.body || '');
            if (c.body.includes('请登录') || c.body.includes('会话已过期') || c.body.includes('未登录')) {
              hasLoginRequired = true;
            }
            if (c.body.includes('认证失败') || c.body.includes('重新登录') || c.body.includes('sso_fail')) {
              hasSsoFail = true;
            }
          }
          if (hasLoginRequired) return { ok: false, reason: 'login_required', text: mergedText };
          if (hasSsoFail) return { ok: false, reason: 'sso_fail', text: mergedText };

          candidates.sort(function(a, b) {
            return (b.rowCount || 0) - (a.rowCount || 0);
          });
          var best = candidates[0] || null;
          if (!best || !best.rowCount) {
            return { ok: false, reason: 'no_table', text: mergedText };
          }
          return {
            ok: true,
            html: best.html || '',
            text: best.body || mergedText || '',
            rowCount: best.rowCount || 0,
            hasTitle: !!best.hasTitle,
            hasCourseAttr: !!best.hasCourseAttr,
            fromFrame: !!best.fromFrame
          };
        })();
      `);

      // 若页面提示需登录 / SSO 失败 / 完全无表格，直接跳出循环走后续失败逻辑
      if (!result?.ok || result?.reason === 'login_required' || result?.reason === 'sso_fail' || result?.reason === 'no_table') {
        break;
      }

      const hasEnoughRows = (result?.rowCount || 0) > 20;
      const hasKeywords = !!(result?.hasTitle || result?.hasCourseAttr);
      const hasHtml = typeof result?.html === 'string' && result.html.length > 1000;

      if (hasEnoughRows && hasKeywords && hasHtml) {
        log('  表格已加载（约 ' + result.rowCount + ' 行）' + (result?.fromFrame ? '（来自 iframe/frame）' : ''));
        break;
      }

      if (attempt < 3) {
        log('  表格信息不足（行数/关键词未达标），再等 3 秒后重试 (' + attempt + '/3)…');
        if (attempt === 1) {
          await win.webContents.executeJavaScript(`
            (function() {
              try {
                if (document && document.frm && document.frm.m) {
                  document.frm.m.value = 'scBksPyfa';
                  if (document.frm.submit) document.frm.submit();
                }
              } catch (_) {}
            })();
          `);
        }
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        break;
      }
    }

    // 若完全拿不到结果 / 明确失败，按原逻辑走失败分支
    if (!result || !result.ok) {
      const currentUrl = win.webContents.getURL();
      log(`当前页面 URL: ${currentUrl}`);
      if (result?.reason === 'login_required') {
        log('❌ 页面提示需登录');
      } else if (result?.reason === 'sso_fail') {
        log('❌ 页面为 SSO 失败页（需重新登录）');
      } else if (result?.reason === 'no_table') {
        log('❌ 页面无 table 或缺少「课程属性」文本，可能未进入正确页面');
      } else {
        log('❌ 页面结构不完整或解析失败');
      }
      // 便于排查：即使 HTML 不可用，也把可见文本落盘
      try {
        const txtPath = path.join(storageConfig.getDataBasePath(), 'training-plan-last.txt');
        const text = typeof result?.text === 'string' ? result.text : '';
        if (text) {
          fs.writeFileSync(txtPath, text, 'utf8');
          log('已保存页面文本到本地: ' + txtPath);
        }
      } catch (e) {
        log('❌ 保存页面文本失败: ' + (e?.message || String(e)));
      }
      log('调试：窗口保持 8 秒供查看，请检查弹窗');
      await new Promise((r) => setTimeout(r, 8000));
      finish(
        false,
        null,
        result?.reason === 'login_required'
          ? '未登录或会话已过期'
          : result?.reason === 'sso_fail'
            ? 'SSO 失败页，请重新登录后重试'
            : '未找到有效培养方案表格'
      );
      return;
    }

    // 走到这里说明 result.ok === true，但不一定满足“强校验”条件
    if ((result.rowCount || 0) > 20 && (result.hasTitle || result.hasCourseAttr)) {
      log('✓ 提取成功');
    } else {
      log(
        '⚠️ 表格结构未完全满足强校验（rowCount=' +
          (result.rowCount || 0) +
          ', hasTitle=' +
          !!result.hasTitle +
          ', hasCourseAttr=' +
          !!result.hasCourseAttr +
          '），但已在页面看到表格，按成功处理并保存 HTML 供后续解析'
      );
    }
    try {
      const base = storageConfig.getDataBasePath();
      const htmlPath = path.join(base, 'training-plan-last.html');
      fs.writeFileSync(htmlPath, result.html, 'utf8');
      log('已保存主提取 HTML 到本地: ' + htmlPath);
      const txtPath = path.join(storageConfig.getDataBasePath(), 'training-plan-last.txt');
      if (typeof result?.text === 'string' && result.text.length) {
        fs.writeFileSync(txtPath, result.text, 'utf8');
        log('已保存页面文本到本地: ' + txtPath);
      }
      // 额外保存当前主文档 HTML，便于对比“主文档 vs frame 文档”
      const pageHtml = await win.webContents.executeJavaScript(`
        (function() {
          return document && document.documentElement ? document.documentElement.outerHTML : '';
        })();
      `);
      if (typeof pageHtml === 'string' && pageHtml.length) {
        const fullHtmlPath = path.join(base, 'training-plan-page-full.html');
        fs.writeFileSync(fullHtmlPath, pageHtml, 'utf8');
        log('已保存当前页面完整 HTML 到本地: ' + fullHtmlPath);
      }
      // 再保存一份 MHTML（近似完整网页快照，包含资源引用）
      const mhtmlPath = path.join(base, 'training-plan-last.mhtml');
      await new Promise((resolve) => {
        win.webContents.savePage(mhtmlPath, 'MHTML', () => resolve(null));
      });
      log('已保存 MHTML 快照到本地: ' + mhtmlPath);
    } catch (e) {
      log('❌ 保存 HTML 失败: ' + (e?.message || String(e)));
    }
    finish(true, result.html);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    if (msg.includes('destroyed') || msg.includes('Object has been destroyed')) {
      finish(false, null, '窗口已关闭');
    } else {
      finish(false, null, e?.message || '提取失败');
    }
  }
}

function extractHtmlFromMhtmlBuffer(buf, log = () => {}) {
  // 先按 utf8 文本读取，方便解析 boundary 和各个 part
  const text = buf.toString('utf8');
  const boundaryMatch = text.match(/boundary="([^"]+)"/i);
  if (!boundaryMatch) {
    log('未找到 MHTML boundary');
    return null;
  }
  const boundary = boundaryMatch[1];
  const parts = text.split(`--${boundary}`);

  // 找到第一个 text/html 的 part
  const htmlPart = parts.find((p) => /Content-Type:\s*text\/html/i.test(p));
  if (!htmlPart) {
    log('未找到 text/html 段');
    return null;
  }

  // header 与 body 之间用空行分隔
  const bodyParts = htmlPart.split(/\r?\n\r?\n/);
  if (bodyParts.length < 2) {
    log('MHTML 段格式异常（无 header/body 分隔）');
    return null;
  }
  const qpText = bodyParts.slice(1).join('\n');

  // quoted-printable 解码：处理软换行和 =XX 序列
  const qpDecoded = qpText
    .replace(/=\r?\n/g, '') // 软换行
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // 页面为 GBK 编码，需转为 UTF-8
  const bufGbk = Buffer.from(qpDecoded, 'binary');
  const htmlUtf8 = iconv.decode(bufGbk, 'gbk');
  return htmlUtf8;
}

async function loadFromHtmlFile() {
  const base = storageConfig.getDataBasePath();
  const mhtmlPath = path.join(base, 'training-plan-last.mhtml');
  try {
    if (!fs.existsSync(mhtmlPath)) {
      return {
        success: false,
        html: null,
        error: '本地无 MHTML 缓存，请先抓取培养方案或手动保存 mhtml 到数据目录'
      };
    }
    const buf = fs.readFileSync(mhtmlPath);
    const html = extractHtmlFromMhtmlBuffer(buf, (msg) => {
      try {
        console.log('[MHTML]', msg);
      } catch (_) {}
    });
    if (!html || !html.trim()) {
      return { success: false, html: null, error: '从 MHTML 提取 HTML 失败' };
    }
    // 为方便调试和前端“从本地 HTML 加载”，顺便写出一份普通 HTML
    try {
      const htmlPath = path.join(base, 'training-plan-last.html');
      fs.writeFileSync(htmlPath, html, 'utf8');
    } catch (_) {}
    return { success: true, html };
  } catch (e) {
    return {
      success: false,
      html: null,
      error: e?.message || '读取 MHTML 失败'
    };
  }
}

async function loadFromFullHtmlFile() {
  const htmlPath = path.join(storageConfig.getDataBasePath(), 'training-plan-page-full.html');
  try {
    if (!fs.existsSync(htmlPath)) return { success: false, html: null, error: '本地无完整页面缓存，请先点击「更新培养方案」抓取' };
    const html = fs.readFileSync(htmlPath, 'utf8');
    return { success: true, html };
  } catch (e) {
    return { success: false, html: null, error: e?.message || '读取失败' };
  }
}

module.exports = { fetchTrainingPlanHTML, getInfoSearchUrl, loadFromHtmlFile, loadFromFullHtmlFile };



