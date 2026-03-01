/**
 * EE 智能体数据存储（会话、记忆）
 * 使用设置中配置的本地数据存储路径
 */

const fs = require('fs');
const path = require('path');
const storageConfig = require('./storageConfig');

const SESSIONS_FILE = 'ee-info-agent-sessions.json';
const MEMORY_FILE = 'ee-info-agent-memory.json';
const MAX_SESSIONS = 50;
const MAX_MEMORY = 3;

function getFilePath(filename) {
  const base = storageConfig.getDataBasePath();
  return path.join(base, filename);
}

function loadSessions() {
  try {
    const p = getFilePath(SESSIONS_FILE);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_SESSIONS) : [];
    }
  } catch (_) {}
  return [];
}

function saveSessions(sessions) {
  try {
    const p = getFilePath(SESSIONS_FILE);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(sessions.slice(-MAX_SESSIONS), null, 2), 'utf8');
  } catch (_) {}
}

function loadMemory() {
  try {
    const p = getFilePath(MEMORY_FILE);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_MEMORY) : [];
    }
  } catch (_) {}
  return [];
}

function saveMemory(memories) {
  try {
    const p = getFilePath(MEMORY_FILE);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(memories.slice(-MAX_MEMORY), null, 2), 'utf8');
  } catch (_) {}
}

module.exports = {
  loadSessions,
  saveSessions,
  loadMemory,
  saveMemory
};
