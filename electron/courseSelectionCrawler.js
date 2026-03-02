/**
 * 培养方案抓取模块
 * 流程：加载 info 建立会话 → 直接导航到培养方案 URL → 提取 HTML
 */

const { BrowserWindow } = require('electron');
const auth = require('./auth');

const INFO_BASE = 'https://info.tsinghua.edu.cn';
const TRAINING_PLAN_URL = 'https://zhjw.cic.tsinghua.edu.cn/jhBks.by_fascjgmxb_gr.do?url=/jhBks.by_fascjgmxb_gr.do&xsViewFlag=pyfa&pathContent=%E5%9F%B9%E5%85%BB%E6%96%B9%E6%A1%88%E5%AE%8C%E6%88%90%E6%83%85%E5%86%B5&m=queryFaScjgmx_gr';

function getSession() {
  return auth.getSessionForCrawler();
}

/**
 * 抓取培养方案 HTML
 * 流程：加载 info 建立会话 → 直接导航到培养方案 URL → 点击刷新 → 提取 HTML
 * @param {{ onLog?: (msg: string) => void }} opts
 */
async function fetchTrainingPlanHTML(opts = {}) {
  const { onLog = () => {} } = opts;
  const log = (msg) => { onLog(`[${new Date().toLocaleTimeString()}] ${msg}`); };

  return new Promise((resolve) => {
    const sess = getSession();
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        session: sess,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    let resolved = false;
    function finish(success, html, error) {
      if (resolved) return;
      resolved = true;
      try {
        win.destroy();
      } catch (_) {}
      resolve({ success: !!success, html: html || null, error: error || null });
    }

    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // 若应用在新窗口打开，改为在当前窗口加载（培养方案链接常为 target="_blank"）
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url && (url.includes('jhBks') || url.includes('zhjw.cic') || url.includes('zhjwxk'))) {
        log(`应用在新窗口打开，改为当前窗口加载: ${url.slice(0, 60)}…`);
        win.loadURL(url, { userAgent: ua });
      }
      return { action: 'deny' };
    });

    // 步骤 1: 先加载 info 建立会话（培养方案需从 info 登录后的 session 访问）
    log('步骤 1/3: 加载 info.tsinghua.edu.cn 建立会话…');
    win.loadURL(INFO_BASE + '/', { userAgent: ua });

    const onLoad = async () => {
      const url = win.webContents.getURL();
      log(`步骤 2/3: 当前页面 URL: ${url.slice(0, 80)}${url.length > 80 ? '…' : ''}`);

      if (url.includes('/login')) {
        log('❌ 检测到登录页，未登录或会话已过期');
        finish(false, null, '未登录或会话已过期，请先登录信息门户');
        return;
      }
      if (url.includes('id.tsinghua') && !url.includes('jhBks')) {
        log('⏳ 正在 CAS 认证中，等待跳转…');
        return;
      }

      // 若已在培养方案页（如从书签等直接进入）
      if (url.includes('jhBks.by_fascjgmxb_gr.do')) {
        log('✓ 已在培养方案页，开始提取');
        win.webContents.off('did-finish-load', onLoad);
        await tryExtractWithRefresh(win, finish, log);
        return;
      }

      // 在 info 上则直接导航到培养方案 URL
      if (url.startsWith(INFO_BASE) || url.includes('info.tsinghua')) {
        win.webContents.off('did-finish-load', onLoad);
        log('步骤 3/3: 导航到培养方案页…');
        win.loadURL(TRAINING_PLAN_URL, { userAgent: ua });
        win.webContents.once('did-finish-load', async () => {
          const u = win.webContents.getURL();
          if (u.includes('login') || u.includes('id.tsinghua')) {
            log('❌ 被重定向到登录页，请确认已从信息门户登录');
            finish(false, null, '无法访问培养方案，请确认已从信息门户登录');
            return;
          }
          await tryExtractWithRefresh(win, finish, log);
        });
        return;
      }

      // 其他情况（如已在 zhjw 等）也尝试提取
      if (url.includes('zhjw.cic') || url.includes('jhBks')) {
        win.webContents.off('did-finish-load', onLoad);
        await tryExtractWithRefresh(win, finish, log);
        return;
      }
    };

    win.webContents.on('did-finish-load', onLoad);
    win.webContents.on('did-fail-load', (_, code, desc) => {
      if (!resolved) {
        log(`❌ 加载失败: ${desc || code}`);
        finish(false, null, `加载失败: ${desc || code}`);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        log('❌ 抓取超时 (60s)');
        finish(false, null, '抓取超时');
      }
    }, 60000);
  });
}

async function tryExtractWithRefresh(win, finish, log = () => {}) {
  try {
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
      log('  点击「刷新培养方案完成情况」按钮，等待 2.5 秒…');
      await new Promise((r) => setTimeout(r, 2500));
    }

    const result = await win.webContents.executeJavaScript(`
      (function() {
        var body = document.body ? document.body.textContent : '';
        if (body.includes('请登录') || body.includes('会话已过期') || body.includes('未登录')) {
          return { ok: false, reason: 'login_required' };
        }
        if (!document.querySelector('table') || !body.includes('课程属性')) {
          return { ok: false, reason: 'no_table' };
        }
        return { ok: true, html: document.documentElement.outerHTML };
      })();
    `);

    if (!result || !result.ok) {
      const currentUrl = win.webContents.getURL();
      log(`当前页面 URL: ${currentUrl}`);
      if (result?.reason === 'login_required') {
        log('❌ 页面提示需登录');
      } else {
        log('❌ 页面无 table 或缺少「课程属性」文本，可能未进入正确页面');
      }
      finish(false, null, result?.reason === 'login_required' ? '未登录或会话已过期' : '未找到培养方案表格');
      return;
    }
    log('✓ 提取成功');
    finish(true, result.html);
  } catch (e) {
    finish(false, null, e?.message || '提取失败');
  }
}

module.exports = { fetchTrainingPlanHTML };
