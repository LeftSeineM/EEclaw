/**
 * 本地数据存储配置
 * 配置文件始终在 userData，自定义路径仅影响 learn-data、auth 等业务数据
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'ee-info-config.json';

function getConfigPath() {
  const { app } = require('electron');
  return path.join(app?.getPath?.('userData') || process.cwd(), CONFIG_FILE);
}

function loadConfig() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw);
      return data || {};
    }
  } catch (_) {}
  return {};
}

function saveConfig(config) {
  try {
    const p = getConfigPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * 获取数据存储根目录（自定义或默认 userData）
 */
function getDataBasePath() {
  const config = loadConfig();
  const custom = config.dataPath?.trim();
  if (custom) {
    if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
    return custom;
  }
  const { app } = require('electron');
  return app?.getPath?.('userData') || process.cwd();
}

/**
 * 获取当前配置的 dataPath（可能为空）
 */
function getDataPathConfig() {
  return loadConfig().dataPath?.trim() || null;
}

/**
 * 设置自定义数据路径
 */
function setDataPath(customPath) {
  const config = loadConfig();
  if (!customPath?.trim()) {
    delete config.dataPath;
  } else {
    const p = customPath.trim();
    config.dataPath = p;
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }
  saveConfig(config);
}

module.exports = {
  getDataBasePath,
  getDataPathConfig,
  setDataPath,
  loadConfig,
  saveConfig
};
