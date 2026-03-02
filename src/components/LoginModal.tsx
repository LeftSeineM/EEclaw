import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    eeInfo?: {
      auth: {
        login: (username: string, password: string) => Promise<{ success: boolean; error?: string; data?: unknown }>;
        logout: () => Promise<{ ok: boolean }>;
        getStatus: () => Promise<{ loggedIn: boolean }>;
      };
    };
  }
}

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (data?: unknown) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setPassword('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('请输入学号/用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    const api = window.eeInfo?.auth;
    if (!api) {
      setError('应用未就绪，请稍后重试');
      return;
    }

    setLoading(true);
    try {
      const result = await api.login(username.trim(), password);
      if (result.success) {
        onSuccess?.(result.data);
        onClose();
      } else {
        setError(result.error || '登录失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录异常');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900/95 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/80 flex items-center justify-center text-sm font-semibold">
              EE
            </div>
            <div>
              <h2 className="text-base font-semibold">登录信息门户</h2>
              <p className="text-xs text-slate-400">清华大学信息门户 · 培养方案 · 选课</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">学号 / 用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入学号"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? '登录中…' : '登录'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              取消
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-[10px] text-slate-500">
          密码仅用于本次登录，不会保存。应用直接调用清华 CAS 接口完成认证。若需二次验证，将自动切换为窗口登录。
        </p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => window.eeInfo?.auth?.openLoginInBrowser?.()}
            className="w-full rounded-md border border-slate-600 py-2 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-300"
          >
            在系统浏览器中打开（无法同步会话）
          </button>
          <p className="text-center text-[10px] text-slate-500">
            若按钮无效，请
            <button
              type="button"
              className="text-emerald-500 hover:underline ml-0.5"
              onClick={() => navigator.clipboard?.writeText('https://info.tsinghua.edu.cn/')}
            >
              点击复制链接
            </button>
            后粘贴到浏览器打开
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
