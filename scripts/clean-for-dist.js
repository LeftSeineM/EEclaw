/**
 * 打包前清理：删除所有用户数据、登出状态，确保分发包不含历史记录
 * 清除：项目 data 目录、Electron userData（ee-info、EE Info、Electron）
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const projectDataDir = path.join(projectRoot, '..', 'data');

// Electron userData 可能路径（dev 用 ee-info/Electron，打包后用 EE Info）
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const userDataDirs = [
  path.join(appData, 'ee-info'),
  path.join(appData, 'EE Info'),
  path.join(appData, 'Electron')
];

const DATA_FILES = [
  'ee-info-agent-sessions.json',
  'ee-info-agent-memory.json',
  'learn-data.json',
  'auth-session.json',
  'ee-info-config.json'
];

function rmFile(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      fs.unlinkSync(p);
      console.log('  已删除:', p);
    }
  } catch (e) {
    console.warn('  删除失败:', p, e.message);
  }
}

function rmDirRecursive(dir) {
  try {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      fs.rmSync(dir, { recursive: true });
      console.log('  已删除目录:', dir);
    }
  } catch (e) {
    console.warn('  删除目录失败:', dir, e.message);
  }
}

console.log('[clean-for-dist] 清理用户数据，确保分发包不含历史记录...\n');

// 1. 清理项目 data 目录
console.log('1. 清理项目 data 目录:', projectDataDir);
if (fs.existsSync(projectDataDir)) {
  for (const f of DATA_FILES) {
    rmFile(path.join(projectDataDir, f));
  }
  // 若目录已空可保留，或删除整个 data 目录
  try {
    const remaining = fs.readdirSync(projectDataDir);
    if (remaining.length === 0) {
      fs.rmdirSync(projectDataDir);
      console.log('  已删除空目录:', projectDataDir);
    }
  } catch (_) {}
} else {
  console.log('  目录不存在，跳过');
}

// 2. 清理各 Electron userData 目录
console.log('\n2. 清理 Electron userData');
for (const userData of userDataDirs) {
  if (!fs.existsSync(userData)) continue;
  console.log('  清理:', userData);
  for (const f of DATA_FILES) {
    rmFile(path.join(userData, f));
  }
  // 彻底清空 ee-info / EE Info 的 userData（登出、清空配置、会话、课表）
  if (userData.includes('ee-info') || userData.includes('EE Info')) {
    try {
      const files = fs.readdirSync(userData);
      for (const f of files) {
        const fp = path.join(userData, f);
        try {
          if (fs.statSync(fp).isFile()) rmFile(fp);
          else if (fs.statSync(fp).isDirectory()) {
            fs.rmSync(fp, { recursive: true });
            console.log('  已删除目录:', fp);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
}

console.log('\n[clean-for-dist] 清理完成，可执行 npm run build:exe 打包\n');
