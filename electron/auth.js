/**
 * 清华大学网络学堂 CAS 登录模块
 * 通过 BrowserWindow 完成 CAS 认证，密码仅限内存，不持久化
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');

const LEARN_LOGIN_URL = 'https://learn.tsinghua.edu.cn/f/login';
const LEARN_BASE_URL = 'https://learn.tsinghua.edu.cn';
const AUTH_STORE_FILE = 'auth-session.json';

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
 * 持久化登录态（仅 session cookies，不含密码）
 * 同时恢复到爬虫 session，确保后续请求可用
 */
function persistAuthState(cookies) {
  const storePath = getAuthStorePath();
  const data = {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: (c.expirationDate ?? c.expires) ? Math.floor(c.expirationDate ?? c.expires) : null
    })),
    updatedAt: Date.now()
  };
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  // 立即恢复到爬虫 session，确保刷新等操作可用
  return restoreAuthToSession(getSessionForCrawler());
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
          'input[name="username"], input[name="i_user"], input[name="un"], input#username, ' +
          'input[type="text"][autocomplete="username"], input[type="text"]'
        );
        const passInput = doc.querySelector(
          'input[name="password"], input[name="i_pass"], input[name="pw"], input#password, input[type="password"]'
        );
        const loginForm = doc.querySelector('form#theform') || (userInput && userInput.closest('form'));
        const submitBtn = doc.querySelector(
          'form#theform button[type="button"][onclick*="doLogin"], form#theform .btn-primary, ' +
          'button[type="submit"], input[type="submit"], [id="loginButtonId"]'
        );

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
            loginForm.submit();
            return { ok: true };
          }
          if (loginForm && !loginForm.action.includes('locale')) {
            loginForm.submit();
            return { ok: true };
          }
          if (submitBtn) {
            submitBtn.click();
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
 * 优先尝试程序化登录，失败则回退到 BrowserWindow
 */
async function loginWithCredentialsAsync(mainWindow, username, password) {
  const programmatic = await casLogin.loginProgrammatic(username, password);
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
      title: '登录清华大学网络学堂',
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

      // 已登录：在 learn.tsinghua.edu.cn 且不在 /f/login
      if (url.startsWith(LEARN_BASE_URL) && !url.includes('/f/login')) {
        try {
          const cookies = await loginSession.cookies.get({ url: LEARN_BASE_URL });
          const valid = Array.isArray(cookies) && cookies.length > 0 && cookies.some((c) => c.name && c.value);
          if (!valid) {
            finish(false, '未获取到有效会话，请重试');
            return;
          }
          await persistAuthState(cookies);
          finish(true);
        } catch (e) {
          finish(false, e.message || '保存会话失败');
        }
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
      if (url.startsWith(LEARN_BASE_URL) && !url.includes('/f/login')) {
        loginWin.webContents.once('did-finish-load', async () => {
          if (resolved) return;
          try {
            const cookies = await loginSession.cookies.get({ url: LEARN_BASE_URL });
            const valid = Array.isArray(cookies) && cookies.length > 0 && cookies.some((c) => c.name && c.value);
            if (!valid) {
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
      const casLoginUrl = await casLogin.getCasLoginUrl();
      loginSession.webRequest.onBeforeRequest(
        { urls: ['*://id.tsinghua.edu.cn/f/common/public/locale/*'] },
        (_, callback) => callback({ redirectURL: casLoginUrl })
      );
      loginWin.loadURL(casLoginUrl, {
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
 * 将已保存的 cookies 恢复到主 session
 */
async function restoreAuthToSession(sess) {
  const saved = loadAuthState();
  if (!saved || !saved.length) return false;
  try {
    for (const c of saved) {
      await sess.cookies.set({
        name: c.name,
        value: c.value,
        domain: c.domain || '.learn.tsinghua.edu.cn',
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
  getCookieHeaderForCrawler,
  getXsrfToken,
  LEARN_LOGIN_URL,
  LEARN_BASE_URL
};
