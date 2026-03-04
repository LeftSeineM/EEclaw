/**
 * 大模型 API 调用：智谱 GLM、Ollama 本地
 */

const ZHIPU_BASE = 'https://open.bigmodel.cn/api/paas/v4';
const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 120000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`请求超时（>${Math.round(timeoutMs / 1000)}s）`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Ollama 本地 API，无需 API Key */
async function chatWithOllama({ baseUrl, model, messages, think }) {
  const base = (baseUrl || OLLAMA_BASE).replace(/\/$/, '');
  const url = `${base}/api/chat`;
  const modelId = model || 'qwen2:8b';

  const body = { model: modelId, messages, stream: false };
  if (typeof think === 'boolean') body.think = think;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama 请求失败: ${res.status} ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  const content = data.message?.content;
  if (content == null) {
    throw new Error('Ollama 返回为空');
  }
  return content;
}

async function chatWithZhipu({ apiKey, baseUrl, model, messages }) {
  const url = (baseUrl || ZHIPU_BASE).replace(/\/$/, '') + '/chat/completions';
  const modelId = model || 'glm-4.7-flash';

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: false,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message || errJson.message || errText || errMsg;
    } catch {
      if (errText) errMsg = errText.slice(0, 200);
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error('模型返回为空');
  }
  return choice.message.content;
}

module.exports = {
  chatWithZhipu,
  chatWithOllama
};
