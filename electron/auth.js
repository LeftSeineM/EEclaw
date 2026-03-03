/**
 * 清华大学网络学堂 CAS 登录模块
 * 通过 BrowserWindow 完成 CAS 认证，密码仅限内存，不持久化
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');

const INFO_BASE_URL = 'https://info.tsinghua.edu.cn';
const LEARN_LOGIN_URL = 'https://learn.tsinghua.edu.cn/f/login';
const LEARN_BASE_URL = 'https://learn.tsinghua.edu.cn';
const AUTH_STORE_FILE = 'auth-session.json';

const credentialStore = require('./credentialStore');

/**
 * 获取登录用 session（不污染主应用 session）
 */
function createLoginSession() {
  return session.fromPartition('persist:ee-info-login');
}

/**
 * 获取 auth 存储路径
 */
function getAuthStorePath() {
  const storageConfig = require('./storageConfig');
  return path.join(storageConfig.getDataBasePath(), AUTH_STORE_FILE);
}

/**
 * 规范化单个 cookie 对象
 */
function normalizeCookie(c) {
  return {
    name: c.name,
    value: c.value,
    domain: c.domain || '.tsinghua.edu.cn',
    path: c.path || '/',
    expires: (c.expirationDate ?? c.expires) ? Math.floor(c.expirationDate ?? c.expires) : null
  };
}

/**
 * 合并 cookies（新 cookies 覆盖同 key 的旧值）
 */
function mergeCookies(existing, incoming) {
  const byKey = new Map();
  for (const c of existing || []) {
    if (c.name && c.value) byKey.set(`${c.domain || ''}::${c.name}`, normalizeCookie(c));
  }
  for (const c of incoming || []) {
    if (c.name && c.value) byKey.set(`${c.domain || ''}::${c.name}`, normalizeCookie(c));
  }
  return Array.from(byKey.values());
}

/**
 * 持久化登录态（仅 session cookies，不含密码）
 * 合并到已有 cookies，不覆盖其他域的会话（info 与 learn 可分开登录）
 */
async function persistAuthState(cookies) {
  const storePath = getAuthStorePath();
  const existing = loadAuthState();
  const merged = mergeCookies(existing, cookies);
  const data = {
    cookies: merged,
    updatedAt: Date.now()
  };
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  await restoreAuthToSession(getSessionForCrawler());
  await restoreAuthToSession(getSessionForCourseSelection());
}

/**
 * 加载已保存的登录态
 */
function loadAuthState() {
  try {
    const storePath = getAuthStorePath();
    if (!fs.existsSync(storePath)) return null;
    const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return data.cookies || null;
  } catch {
    return null;
  }
}

/**
 * 清除持久化的登录态
 */
function clearAuthState() {
  try {
    const storePath = getAuthStorePath();
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  } catch {}
}

/**
 * 是否有有效的 info 会话（用于培养方案、选课）
 */
function hasValidInfoSession() {
  const cookies = loadAuthState();
  if (!cookies?.length) return false;
  return cookies.some((c) => (c.domain || '').includes('info.tsinghua'));
}

/**
 * 是否有有效的 learn 会话（用于网络学堂）
 */
function hasValidLearnSession() {
  const cookies = loadAuthState();
  if (!cookies?.length) return false;
  return cookies.some((c) => (c.domain || '').includes('learn.tsinghua'));
}

/**
 * 保存凭据（用于按需自动登录）
 */
function saveCredentials(username, password) {
  return credentialStore.saveCredentials(username, password);
}

/**
 * 加载凭据
 */
function loadCredentials() {
  return credentialStore.loadCredentials();
}

/**
 * 是否已保存凭据
 */
function hasCredentials() {
  return credentialStore.hasCredentials();
}

/**
 * 清除已保存的凭据
 */
function clearCredentials() {
  return credentialStore.clearCredentials();
}

/**
 * 按需登录到 info（若已有有效会话则跳过）
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function ensureLoginToInfo(credentials) {
  if (hasValidInfoSession()) return { success: true };
  if (!credentials?.username || !credentials?.password) {
    return { success: false, error: '需要凭据，请先登录并勾选「保存凭据」' };
  }
  const programmatic = await casLogin.loginProgrammatic(credentials.username, credentials.password, 'info');
  if (programmatic.success && programmatic.cookies?.length) {
    const hasInfo = programmatic.cookies.some((c) => (c.domain || '').includes('info.tsinghua'));
    if (hasInfo) {
      await persistAuthState(programmatic.cookies);
      return { success: true };
    }
  }
  return { success: false, error: programmatic.error || '登录 info 失败' };
}

/**
 * 按需登录到 learn（若已有有效会话则跳过）
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function ensureLoginToLearn(credentials) {
  if (hasValidLearnSession()) return { success: true };
  if (!credentials?.username || !credentials?.password) {
    return { success: false, error: '需要凭据，请先登录并勾选「保存凭据」' };
  }
  const programmatic = await casLogin.loginProgrammatic(credentials.username, credentials.password, 'learn');
  if (programmatic.success && programmatic.cookies?.length) {
    await persistAuthState(programmatic.cookies);
    return { success: true };
  }
  return { success: false, error: programmatic.error || '登录网络学堂失败' };
}

/**
 * 在 info 首页查找并点击/导航到登录入口
 * info 与 learn 不同：learn/f/login 会直接重定向到 CAS，info 首页需点击右上角「登录」才跳转
 * 根据 info 首页 DOM：a.onload、.tab_line a、#subnavmini .onload 等
 */
function getInfoHomepageLoginScript() {
  return `
    (function() {
      function findAndNavigate() {
        var selectors = [
          'a.onload[href]',
          'a.onload',
          '.tab_line a.onload',
          '.tab_line a[href]',
          '#subnavmini a.onload',
          '#subnavmini .onload',
          'a[href*="id.tsinghua"]',
          'a[href*="id.sigs.tsinghua"]',
          'a[href*="login"]'
        ];
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) {
            var href = el.href || el.getAttribute('href');
            if (href && (href.indexOf('id.tsinghua') >= 0 || href.indexOf('id.sigs') >= 0 || href.indexOf('login') >= 0)) {
              return { ok: true, action: 'navigate', url: href };
            }
            if (el.click) {
              el.click();
              return { ok: true, action: 'click' };
            }
          }
        }
        var all = document.querySelectorAll('a, .onload, [role="button"]');
        for (var j = 0; j < all.length; j++) {
          var e = all[j];
          if (e.textContent && e.textContent.indexOf('登录') >= 0 && e.textContent.trim().length < 30) {
            var h = e.href || e.getAttribute('href');
            if (h) return { ok: true, action: 'navigate', url: h };
            if (e.click) { e.click(); return { ok: true, action: 'click' }; }
          }
        }
        return { ok: false, reason: 'login_element_not_found' };
      }
      return findAndNavigate();
    })();
  `;
}

/**
 * 注入登录表单并提交（仅用于 CAS 登录页）
 * 密码在内存中，仅在此处使用一次
 * 支持主文档及 iframe
 */
function getAuthInjectScript(username, password) {
  return `
    (function() {
      const un = ${JSON.stringify(username || '')};
      const pw = ${JSON.stringify(password || '')};
      if (!un || !pw) return { ok: false, reason: 'missing_credentials' };

      function tryDoc(doc) {
        if (!doc) return null;
        const userInput = doc.querySelector(
          'input[name="username"], input[name="i_user"], input[name="un"], input#username, input#i_user, ' +
          'input[type="text"][autocomplete="username"], input[type="text"]'
        );
        const passInput = doc.querySelector(
          'input[name="password"], input[name="i_pass"], input[name="pw"], input#password, input#i_pass, input[type="password"]'
        );
        const loginForm = doc.querySelector('form#theform') || (userInput && userInput.closest('form'));
        const submitBtn = doc.querySelector(
          'form#theform button[type="button"][onclick*="doLogin"], form#theform .btn-primary, ' +
          'button[type="submit"], input[type="submit"], [id="loginButtonId"]'
        );
        const loginBtnByText = Array.from(doc.querySelectorAll('button, input[type="submit"], input[type="button"]'))
          .find(el => (el.value || el.textContent || '').trim() === '登录');

        if (userInput && passInput) {
          userInput.value = un;
          passInput.value = pw;
          userInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (loginForm && loginForm.id === 'theform') {
            const sm2pass = doc.querySelector('#sm2pass');
            const pk = doc.querySelector('#sm2publicKey');
            if (sm2pass && pk && typeof sm2Util !== 'undefined' && sm2Util.doEncryptStr) {
              try {
                sm2pass.value = sm2Util.doEncryptStr(pw, pk.textContent.trim());
              } catch (_) {}
            }
            if (sm2pass && !sm2pass.value) sm2pass.value = pw;
          }
          const btn = submitBtn || loginBtnByText;
          if (btn) {
            btn.click();
            return { ok: true };
          }
          if (loginForm && loginForm.id === 'theform') {
            loginForm.submit();
            return { ok: true };
          }
          if (loginForm && !loginForm.action.includes('locale')) {
            loginForm.submit();
            return { ok: true };
          }
        }
        return null;
      }

      let r = tryDoc(document);
      if (r) return r;
      for (const f of document.querySelectorAll('iframe')) {
        try {
          if (f.contentDocument) r = tryDoc(f.contentDocument);
          if (r) return r;
        } catch (_) {}
      }
      return { ok: false, reason: 'form_not_found' };
    })();
  `;
}

const casLogin = require('./casLogin');

/**
 * 主登录：优先程序化登录网络学堂，失败则回退到 BrowserWindow
 * 选课/培养方案需 info 时由 ensureLoginToInfo 按需处理
 */
async function loginWithCredentialsAsync(mainWindow, username, password) {
  const programmatic = await casLogin.loginProgrammatic(username, password, 'learn');
  if (programmatic.success && programmatic.cookies?.length) {
    await persistAuthState(programmatic.cookies);
    return { success: true };
  }
  if (programmatic.needBrowser) {
    return loginWithCredentials(mainWindow, username, password);
  }
  return { success: false, error: programmatic.error };
}

/**
 * 打开登录窗口，用户输入账号密码后由主进程完成 CAS 流程
 * @param {Object} mainWindow - 主窗口，用于居中
 * @param {string} username - 学号/用户名
 * @param {string} password - 密码（仅内存，不持久化）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function loginWithCredentials(mainWindow, username, password) {
  return new Promise((resolve) => {
    const { BrowserWindow } = require('electron');
    const loginSession = createLoginSession();

    const loginWin = new BrowserWindow({
      width: 520,
      height: 720,
      parent: mainWindow || undefined,
      modal: false,
      show: false,
      title: '登录网络学堂',
      backgroundColor: '#f5f5f5',
      webPreferences: {
        session: loginSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false,
        allowRunningInsecureContent: true
      }
    });

    let authAttempted = false;
    let resolved = false;
    let successHandling = false;

    function finish(success, error) {
      if (resolved) return;
      resolved = true;
      loginWin.hide();
      setTimeout(() => loginWin.destroy(), 3000);
      resolve({ success: !!success, error });
    }

    const handlePageLoad = async () => {
      const url = loginWin.webContents.getURL();

      if (url.includes('locale/change')) {
        const casUrl = await casLogin.getCasLoginUrl();
        loginWin.loadURL(casUrl);
        return;
      }

      // 已登录：在 info 或 learn 且不在登录页；立即隐藏避免后续重定向闪烁
      const onInfo = url.startsWith(INFO_BASE_URL) && !url.includes('/login');
      const onLearn = url.startsWith(LEARN_BASE_URL) && !url.includes('/f/login');
      if ((onInfo || onLearn) && !successHandling) {
        successHandling = true;
        loginWin.hide();
        (async () => {
          try {
            const allCookies = [];
            for (const base of [INFO_BASE_URL, LEARN_BASE_URL, 'https://id.tsinghua.edu.cn', 'https://zhjw.cic.tsinghua.edu.cn']) {
              const c = await loginSession.cookies.get({ url: base });
              if (Array.isArray(c)) allCookies.push(...c);
            }
            const byKey = new Map();
            for (const c of allCookies) {
              if (c.name && c.value) byKey.set(`${c.domain || ''}::${c.name}`, c);
            }
            const cookies = Array.from(byKey.values());
            if (cookies.length === 0) {
              finish(false, '未获取到有效会话，请重试');
              return;
            }
            await persistAuthState(cookies);
            finish(true);
          } catch (e) {
            finish(false, e.message || '保存会话失败');
          }
        })();
        return;
      }

      const isCasPage = url.includes('id.tsinghua.edu.cn') || url.includes('id.sigs.tsinghua.edu.cn');

      // 直接加载 CAS 页，尝试自动填充并提交（CAS 页面多为 JS 动态渲染，需等待）
      if (isCasPage && username && password && !authAttempted) {
        authAttempted = true;
        const tryInject = async () => {
          // 首次等待 2 秒，给 CAS 页面时间完成渲染
          await new Promise(r => setTimeout(r, 2000));
          for (let i = 0; i < 8; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 800));
            try {
              const result = await loginWin.webContents.executeJavaScript(getAuthInjectScript(username, password));
              if (result?.ok) return true;
            } catch {}
          }
          return false;
        };
        const ok = await tryInject();
        if (!ok) authAttempted = false;
      }
    };

    loginWin.webContents.on('dom-ready', handlePageLoad);
    loginWin.webContents.on('did-finish-load', handlePageLoad);

    loginWin.webContents.on('did-navigate', (_, url) => {
      const onInfo = url.startsWith(INFO_BASE_URL) && !url.includes('/login');
      const onLearn = url.startsWith(LEARN_BASE_URL) && !url.includes('/f/login');
      if ((onInfo || onLearn) && !successHandling) {
        successHandling = true;
        loginWin.hide();
        loginWin.webContents.once('did-finish-load', async () => {
          if (resolved) return;
          try {
            const allCookies = [];
            for (const base of [INFO_BASE_URL, LEARN_BASE_URL, 'https://id.tsinghua.edu.cn', 'https://zhjw.cic.tsinghua.edu.cn']) {
              const c = await loginSession.cookies.get({ url: base });
              if (Array.isArray(c)) allCookies.push(...c);
            }
            const byKey = new Map();
            for (const c of allCookies) {
              if (c.name && c.value) byKey.set(`${c.domain || ''}::${c.name}`, c);
            }
            const cookies = Array.from(byKey.values());
            if (cookies.length === 0) {
              finish(false, '未获取到有效会话，请重试');
              return;
            }
            await persistAuthState(cookies);
            finish(true);
          } catch (e) {
            finish(false, e.message || '保存会话失败');
          }
        });
      }
    });

    loginWin.on('closed', () => {
      if (!resolved) finish(false, '用户取消登录');
    });

    (async () => {
      // 主登录：直接加载 CAS 页，避免 learn 中间页需手动点击；自动填充并提交
      const casUrl = await casLogin.getCasLoginUrl('learn');
      loginWin.loadURL(casUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        extraHeaders: 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8'
      });
    })();

    loginWin.once('ready-to-show', () => {
      loginWin.show();
      if (process.env.NODE_ENV === 'development') {
        loginWin.webContents.openDevTools({ mode: 'detach' });
      }
    });
  });
}

/**
 * 获取供爬虫使用的 session（带 cookies）
 */
function getSessionForCrawler() {
  return session.fromPartition('persist:ee-info-main');
}

/**
 * 获取供课程选课/培养方案抓取使用的 session
 * 使用登录窗口的 session，其包含完整 CAS 流程的 cookies，登录态更可靠
 */
function getSessionForCourseSelection() {
  return session.fromPartition('persist:ee-info-login');
}

/**
 * 根据 cookie domain 构造用于 cookies.set 的 url（Electron 要求必填）
 */
function getUrlForCookieDomain(domain) {
  const d = (domain || '.tsinghua.edu.cn').replace(/^\./, '');
  return `https://${d}/`;
}

/**
 * 将已保存的 cookies 恢复到主 session（支持 info、learn、id 等多域）
 * Electron cookies.set 必须提供 url 参数，否则会静默失败
 */
async function restoreAuthToSession(sess) {
  const saved = loadAuthState();
  if (!saved || !saved.length) return false;
  try {
    for (const c of saved) {
      const domain = c.domain || '.tsinghua.edu.cn';
      const url = getUrlForCookieDomain(domain);
      await sess.cookies.set({
        url,
        name: c.name,
        value: c.value,
        domain: domain.startsWith('.') ? domain : '.' + domain,
        path: c.path || '/',
        expirationDate: c.expires || (Date.now() / 1000) + 86400 * 7
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取供爬虫使用的 Cookie 请求头
 */
function getCookieHeaderForCrawler() {
  const cookies = loadAuthState();
  if (!cookies?.length) return null;
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * 获取 XSRF 令牌（网络学堂 API 可能要求放在 X-XSRF-TOKEN 头中）
 */
function getXsrfToken() {
  const cookies = loadAuthState();
  if (!cookies) return null;
  const c = cookies.find((x) => x.name === 'XSRF-TOKEN');
  if (!c?.value) return null;
  try {
    return decodeURIComponent(c.value);
  } catch {
    return c.value;
  }
}

module.exports = {
  loginWithCredentials,
  loginWithCredentialsAsync,
  persistAuthState,
  loadAuthState,
  clearAuthState,
  restoreAuthToSession,
  getSessionForCrawler,
  getSessionForCourseSelection,
  getCookieHeaderForCrawler,
  getXsrfToken,
  hasValidInfoSession,
  hasValidLearnSession,
  saveCredentials,
  loadCredentials,
  hasCredentials,
  clearCredentials,
  ensureLoginToInfo,
  ensureLoginToLearn,
  getInfoHomepageLoginScript,
  getAuthInjectScript,
  LEARN_LOGIN_URL,
  LEARN_BASE_URL,
  INFO_BASE_URL
};
