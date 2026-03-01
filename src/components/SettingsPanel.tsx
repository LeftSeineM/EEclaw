import React, { useState, useEffect } from 'react';

const SETTINGS_KEY = 'ee-info-settings';

declare global {
  interface Window {
    eeInfo?: {
      storage?: {
        getDataPath: () => Promise<{ dataPath: string | null; effectivePath: string; defaultPath: string }>;
        setDataPath: (path: string | null) => Promise<{ ok: boolean }>;
        selectFolder: () => Promise<{ path: string | null }>;
      };
    };
  }
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  modelApi1?: { name: string; apiKey?: string; baseUrl?: string; model?: string };
  modelApi2?: { name: string; apiKey?: string; baseUrl?: string; model?: string; think?: boolean };
}

const defaultSettings: AppSettings = {
  theme: 'system',
  modelApi1: {
    name: '智谱 GLM 4.7 Flash',
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.7-flash'
  },
  modelApi2: {
    name: 'Ollama qwen-8b',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2:8b',
    think: false
  }
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
  } catch {}
  return defaultSettings;
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [effectivePath, setEffectivePath] = useState('');
  const [dataPathInput, setDataPathInput] = useState('');

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    window.eeInfo?.storage?.getDataPath?.().then((r) => {
      if (r) {
        setDataPath(r.dataPath);
        setEffectivePath(r.effectivePath);
        setDataPathInput(r.dataPath ?? '');
      }
    });
  }, []);

  const handleSelectFolder = async () => {
    const r = await window.eeInfo?.storage?.selectFolder?.();
    if (r?.path) {
      await window.eeInfo?.storage?.setDataPath?.(r.path);
      setDataPath(r.path);
      setEffectivePath(r.path);
      setDataPathInput(r.path);
    }
  };

  const handleSetDataPath = async () => {
    const v = dataPathInput.trim() || null;
    await window.eeInfo?.storage?.setDataPath?.(v);
    const r = await window.eeInfo?.storage?.getDataPath?.();
    if (r) {
      setDataPath(r.dataPath);
      setEffectivePath(r.effectivePath);
    }
  };

  const handleClearDataPath = async () => {
    await window.eeInfo?.storage?.setDataPath?.(null);
    const r = await window.eeInfo?.storage?.getDataPath?.();
    if (r) {
      setDataPath(null);
      setEffectivePath(r.effectivePath);
      setDataPathInput('');
    }
  };

  const setTheme = (theme: AppSettings['theme']) => {
    setSettings((prev) => ({ ...prev, theme }));
  };

  const setModelApi1 = (updates: Partial<NonNullable<AppSettings['modelApi1']>>) => {
    setSettings((prev) => ({
      ...prev,
      modelApi1: { ...prev.modelApi1, ...defaultSettings.modelApi1, ...updates }
    }));
  };

  const setModelApi2 = (updates: Partial<NonNullable<AppSettings['modelApi2']>>) => {
    setSettings((prev) => ({
      ...prev,
      modelApi2: { ...prev.modelApi2, ...defaultSettings.modelApi2, ...updates }
    }));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* 1. 主题 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">主题</h3>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`px-3 py-1.5 rounded-md text-[11px] border transition ${
                  settings.theme === t
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {t === 'light' ? '浅色' : t === 'dark' ? '深色' : '跟随系统'}
              </button>
            ))}
          </div>
        </section>

        {/* 2. 本地数据存储位置 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">本地数据存储位置</h3>
          <p className="text-[10px] text-slate-500 mb-2">课程缓存、登录会话等数据存储目录。不设置则使用默认位置。</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={dataPathInput}
                onChange={(e) => setDataPathInput(e.target.value)}
                placeholder={effectivePath || '默认位置'}
                className="flex-1 px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-300 text-[11px] hover:bg-slate-700 shrink-0"
              >
                选择目录
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSetDataPath}
                className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] hover:bg-emerald-500/30"
              >
                应用
              </button>
              {dataPath && (
                <button
                  type="button"
                  onClick={handleClearDataPath}
                  className="px-2 py-1 rounded text-slate-500 text-[10px] hover:text-slate-300 hover:bg-slate-800"
                >
                  恢复默认
                </button>
              )}
            </div>
            {effectivePath && (
              <p className="text-[9px] text-slate-500 truncate" title={effectivePath}>
                当前有效路径：{effectivePath}
              </p>
            )}
          </div>
        </section>

        {/* 3. 模型 API 配置 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">模型 API 配置</h3>
          <div className="space-y-4">
            {/* 配置项 1 - 智谱 GLM 4.7 Flash */}
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
              <div className="text-[11px] font-medium text-slate-400 mb-2">智谱清言 GLM 4.7 Flash（免费轻量级模型，到官网注册即可）</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">API Key</label>
                  <input
                    type="password"
                    value={settings.modelApi1?.apiKey ?? ''}
                    onChange={(e) => setModelApi1({ apiKey: e.target.value })}
                    placeholder="从 open.bigmodel.cn 获取"
                    className="w-full px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Base URL（可选）</label>
                  <input
                    type="text"
                    value={settings.modelApi1?.baseUrl ?? ''}
                    onChange={(e) => setModelApi1({ baseUrl: e.target.value })}
                    placeholder="https://open.bigmodel.cn/api/paas/v4"
                    className="w-full px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* 配置项 2 - Ollama 本地 */}
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
              <div className="text-[11px] font-medium text-slate-400 mb-2">Ollama 本地</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">服务地址</label>
                  <input
                    type="text"
                    value={settings.modelApi2?.baseUrl ?? ''}
                    onChange={(e) => setModelApi2({ baseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">模型名称</label>
                  <input
                    type="text"
                    value={settings.modelApi2?.model ?? ''}
                    onChange={(e) => setModelApi2({ model: e.target.value })}
                    placeholder="qwen2:8b"
                    className="w-full px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.modelApi2?.think === true}
                    onChange={(e) => setModelApi2({ think: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  <span className="text-[10px] text-slate-400">启用思考模式（仅对支持 think 参数的模型有效）</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPanel;
