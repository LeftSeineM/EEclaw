/**
 * 凭据存储：加密保存用户名和密码，用于按需自动登录 info/learn
 * 使用 Electron safeStorage 加密，密码不会明文存储
 */

const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = 'auth-credentials.json';

function getCredentialsPath() {
  const storageConfig = require('./storageConfig');
  return path.join(storageConfig.getDataBasePath(), CREDENTIALS_FILE);
}

/**
 * 加密密码（使用 Electron safeStorage，依赖系统密钥链）
 */
function encryptPassword(password) {
  try {
    const { safeStorage } = require('electron');
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(password).toString('base64');
    }
  } catch (_) {}
  return null;
}

/**
 * 解密密码
 */
function decryptPassword(encrypted) {
  try {
    const { safeStorage } = require('electron');
    const buf = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buf);
  } catch (_) {}
  return null;
}

/**
 * 保存凭据（用户需主动勾选「保存凭据」）
 */
function saveCredentials(username, password) {
  if (!username?.trim() || !password) return false;
  const encrypted = encryptPassword(password);
  if (!encrypted) return false;
  try {
    const p = getCredentialsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          username: username.trim(),
          passwordEncrypted: encrypted,
          updatedAt: Date.now()
        },
        null,
        2
      ),
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 加载凭据，返回 { username, password } 或 null
 */
function loadCredentials() {
  try {
    const p = getCredentialsPath();
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data?.username || !data?.passwordEncrypted) return null;
    const password = decryptPassword(data.passwordEncrypted);
    if (!password) return null;
    return { username: data.username, password };
  } catch {
    return null;
  }
}

/**
 * 是否已保存凭据（不返回密码，仅检查存在性）
 */
function hasCredentials() {
  const c = loadCredentials();
  return !!c;
}

/**
 * 清除已保存的凭据
 */
function clearCredentials() {
  try {
    const p = getCredentialsPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  saveCredentials,
  loadCredentials,
  hasCredentials,
  clearCredentials
};
