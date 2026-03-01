const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const auth = require('./auth');
const crawler = require('./crawler');
const llm = require('./llm');
const storageConfig = require('./storageConfig');
const agentStore = require('./agentStore');

const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  require('electron-reload')(__dirname, { electron: process.execPath });
}

// 高 DPI 缩放：避免 Windows 高分辨率屏下模糊、文字发虚
app.commandLine.appendSwitch('high-dpi-support', '1');

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'EE info',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow = win;

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
  });

  win.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpc() {
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    if (!username?.trim() || !password) {
      return { success: false, error: '请输入账号和密码' };
    }
    const result = await auth.loginWithCredentialsAsync(mainWindow, username.trim(), password);
    if (!result.success) return result;
    // 调试阶段：登录成功后尝试抓取，失败也不影响登录状态
    try {
      const fetchResult = await crawler.fetchAll();
      const data = fetchResult.success ? fetchResult.data : crawler.getCachedData();
      return { success: true, data };
    } catch (_) {
      return { success: true, data: crawler.getCachedData() };
    }
  });

  ipcMain.handle('auth:logout', () => {
    auth.clearAuthState();
    return { ok: true };
  });

  ipcMain.handle('auth:status', () => {
    const cookies = auth.loadAuthState();
    return { loggedIn: !!cookies?.length };
  });

  ipcMain.handle('auth:getCookiesForCrawler', () => {
    const header = auth.getCookieHeaderForCrawler();
    return { cookieHeader: header };
  });

  ipcMain.handle('crawler:fetch', async (_, semesterId) => crawler.fetchAll(semesterId));
  ipcMain.handle('crawler:getSemesterList', () => crawler.getSemesterList());
  ipcMain.handle('crawler:getCached', () => crawler.getCachedData());
  ipcMain.handle('crawler:diagnose', () => crawler.diagnose());
  ipcMain.handle('crawler:getCourseDetail', (_, wlkcid) => crawler.getCourseDetail(wlkcid));
  ipcMain.handle('crawler:getCourseFiles', (_, wlkcid) => crawler.getCourseFiles(wlkcid));
  ipcMain.handle('crawler:getCourseFileList', (_, wlkcid, flid) => crawler.getCourseFileList(wlkcid, flid));
  ipcMain.handle('crawler:getNotices', (_, wlkcid) => crawler.getNotices(wlkcid));
  ipcMain.handle('crawler:getHomework', (_, wlkcid) => crawler.getHomework(wlkcid));
  ipcMain.handle('crawler:getNoticeDetail', (_, wlkcid, ggid) => crawler.getNoticeDetail(wlkcid, ggid));
  ipcMain.handle('crawler:getHomeworkDetail', (_, wlkcid, xszyid) => crawler.getHomeworkDetail(wlkcid, xszyid));
  ipcMain.handle('crawler:downloadFile', (_, url, filename) => crawler.downloadFile(url, filename));

  ipcMain.handle('auth:openLoginInBrowser', async () => {
    const { shell } = require('electron');
    const { exec } = require('child_process');
    const url = 'https://learn.tsinghua.edu.cn/f/login';
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (e) {
      if (process.platform === 'win32') {
        exec(`start "" "${url}"`, { shell: true }, () => {});
        return { ok: true };
      }
      return { ok: false, error: e?.message };
    }
  });

  ipcMain.handle('shell:openExternal', async (_, url) => {
    const { shell } = require('electron');
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message };
    }
  });

  ipcMain.handle('storage:getDataPath', () => {
    const base = storageConfig.getDataBasePath();
    const custom = storageConfig.getDataPathConfig();
    const defaultPath = app?.getPath?.('userData') || process.cwd();
    return { dataPath: custom, effectivePath: base, defaultPath };
  });

  ipcMain.handle('storage:setDataPath', (_, customPath) => {
    storageConfig.setDataPath(customPath || null);
    return { ok: true };
  });

  ipcMain.handle('agent:getSessions', () => agentStore.loadSessions());
  ipcMain.handle('agent:saveSessions', (_, sessions) => {
    agentStore.saveSessions(sessions);
    return { ok: true };
  });
  ipcMain.handle('agent:getMemory', () => agentStore.loadMemory());
  ipcMain.handle('agent:saveMemory', (_, memories) => {
    agentStore.saveMemory(memories);
    return { ok: true };
  });

  ipcMain.handle('storage:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择数据存储目录'
    });
    if (result.canceled || !result.filePaths?.length) return { path: null };
    return { path: result.filePaths[0] };
  });

  ipcMain.handle('llm:chat', async (_, { provider, apiKey, baseUrl, model, messages, think }) => {
    try {
      if (provider === 'ollama') {
        const content = await llm.chatWithOllama({
          baseUrl: baseUrl?.trim() || undefined,
          model: model?.trim() || undefined,
          messages,
          think: typeof think === 'boolean' ? think : false
        });
        return { success: true, content };
      }
      if (!apiKey?.trim()) {
        return { success: false, error: '请先在设置中配置 API Key' };
      }
      const content = await llm.chatWithZhipu({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl?.trim() || undefined,
        model: model?.trim() || undefined,
        messages
      });
      return { success: true, content };
    } catch (e) {
      return { success: false, error: e?.message || '请求失败' };
    }
  });
}

app.whenReady().then(async () => {
  setupIpc();
  // 启动时恢复已保存的登录态到 session，供爬虫使用
  try {
    const sess = auth.getSessionForCrawler();
    await auth.restoreAuthToSession(sess);
  } catch (_) {}
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
