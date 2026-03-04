import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TrainingPlanReport } from '../types/courseSelection';

const SETTINGS_KEY = 'ee-info-settings';
const MAX_MEMORY_LENGTH = 3;

interface LearnDataContext {
  courses?: Array<{ kcm: string; jsm?: string; sksj?: string; skdd?: string }>;
  notices?: Array<{ bt: string; fbsj: string; courseName: string }>;
  homework?: Array<{ bt: string; jzsj: string; status: string; courseName: string; isUnsubmitted?: boolean }>;
  semester?: string;
}

function buildLearnContextBlock(data: LearnDataContext | null): string {
  if (!data) return '（暂无课程数据，请先在 EE 工作台点击刷新抓取）';
  const parts: string[] = [];
  if (data.semester) parts.push(`当前学期：${data.semester}`);
  if (data.courses?.length) {
    parts.push('\n【课程列表】');
    data.courses.slice(0, 20).forEach((c) => {
      const info = [c.kcm, c.jsm, c.sksj, c.skdd].filter(Boolean).join(' ');
      parts.push(`- ${info || c.kcm}`);
    });
  }
  if (data.notices?.length) {
    parts.push('\n【近期通知】');
    data.notices.slice(0, 15).forEach((n) => {
      parts.push(`- [${n.courseName}] ${n.bt}（${n.fbsj}）`);
    });
  }
  if (data.homework?.length) {
    parts.push('\n【作业】');
    data.homework.slice(0, 20).forEach((h) => {
      const tag = h.isUnsubmitted ? '未交' : '已交';
      parts.push(`- [${h.courseName}] ${h.bt} 截止${h.jzsj}（${tag}）`);
    });
  }
  return parts.length ? parts.join('\n') : '（暂无数据）';
}

function buildTrainingPlanContextBlock(report: TrainingPlanReport | null | undefined): string | null {
  if (!report) return null;
  const parts: string[] = [];
  const s = report.summary;
  parts.push(
    `总学分要求：${s.totalRequired}，已完成：${s.totalCompleted}，剩余：${s.totalRemaining}，完成率：${s.completionRate}%`
  );
  const groups = report.incompleteGroups || [];
  if (groups.length) {
    parts.push('\n【未完成课组示例】');
    groups.slice(0, 5).forEach((g) => {
      parts.push(`- ${g.groupName}（剩余 ${g.remainingCredits} 学分，需完成课程约 ${g.remainingCourses} 门）`);
    });
  }
  return parts.join('\n');
}

const BASE_SYSTEM = `你是 EE 智能体，帮助用户管理课程、作业、日程与培养方案规划。你可以：
- 根据下方提供的课程、通知、作业信息回答用户问题
- 结合培养方案完成情况，给出选课与补修建议
- 帮助规划学习与作业时间，提供学习建议与复习思路
请简洁、友好地回复，基于实际数据作答。`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

type Provider = 'zhipu' | 'ollama';

interface LearningAgentPanelProps {
  learnData?: LearnDataContext | null;
}

function loadModelConfigs() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const m1 = s?.modelApi1;
      const m2 = s?.modelApi2;
      return {
        zhipu: {
          apiKey: m1?.apiKey ?? '',
          baseUrl: m1?.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
          model: m1?.model ?? 'glm-4.7-flash'
        },
        ollama: {
          baseUrl: m2?.baseUrl ?? 'http://localhost:11434',
          model: m2?.model ?? 'qwen2:8b',
          think: m2?.think
        }
      };
    }
  } catch {}
  return {
    zhipu: { apiKey: '', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.7-flash' },
    ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2:8b', think: false }
  };
}

const LearningAgentPanel: React.FC<LearningAgentPanelProps> = ({ learnData: learnDataProp }) => {
  const [provider, setProvider] = useState<Provider>('ollama');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [memory, setMemory] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trainingPlanContext, setTrainingPlanContext] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages ?? [];

  const configs = loadModelConfigs();
  const canSend = provider === 'zhipu' ? !!configs.zhipu.apiKey?.trim() : true;

  useEffect(() => {
    (async () => {
      const [sessionsData, memoryData] = await Promise.all([
        window.eeInfo?.agent?.getSessions?.() ?? [],
        window.eeInfo?.agent?.getMemory?.() ?? []
      ]);
      let s = Array.isArray(sessionsData) ? sessionsData : [];
      let m = Array.isArray(memoryData) ? memoryData.slice(-MAX_MEMORY_LENGTH) : [];
      try {
        const rawS = localStorage.getItem('ee-info-agent-sessions');
        const rawM = localStorage.getItem('ee-info-agent-memory');
        if (s.length === 0 && rawS) {
          const arr = JSON.parse(rawS);
          s = Array.isArray(arr) ? arr : [];
          if (s.length) window.eeInfo?.agent?.saveSessions?.(s);
        }
        if (m.length === 0 && rawM) {
          const arr = JSON.parse(rawM);
          m = Array.isArray(arr) ? arr.slice(-MAX_MEMORY_LENGTH) : [];
          if (m.length) window.eeInfo?.agent?.saveMemory?.(m);
        }
      } catch (_) {}
      setSessions(s);
      setMemory(m);
      setCurrentSessionId(s.length ? s[s.length - 1].id : null);
    })();
  }, []);

  // 加载培养方案分析结果，供对话上下文使用
  useEffect(() => {
    (async () => {
      try {
        const data = await window.eeInfo?.courseSelection?.getData?.();
        const report = (data as { trainingPlan?: { report?: TrainingPlanReport } } | null | undefined)?.trainingPlan
          ?.report;
        const ctx = buildTrainingPlanContextBlock(report || null);
        if (ctx) setTrainingPlanContext(ctx);
      } catch {
        // 静默失败，不影响正常对话
      }
    })();
  }, []);

  const persistSession = useCallback((id: string, msgs: Message[], title?: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const t = title ?? prev.find((s) => s.id === id)?.title ?? '新对话';
      const entry: ChatSession = {
        id,
        title: t.length > 20 ? t.slice(0, 20) + '…' : t,
        messages: msgs,
        createdAt: idx >= 0 ? prev[idx].createdAt : Date.now()
      };
      const next = idx >= 0 ? [...prev] : [...prev, entry];
      if (idx >= 0) next[idx] = entry;
      else next[next.length - 1] = entry;
      window.eeInfo?.agent?.saveSessions?.(next);
      return next;
    });
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startNewChat = useCallback(async () => {
    if (messages.length >= 4 && canSend) {
      const summaryPrompt = `请用2-3句话概括以下对话的关键内容，用于后续对话的上下文记忆。只输出总结，不要其他内容。\n\n对话：\n${messages
        .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content.slice(0, 200)}`)
        .join('\n')}`;
      try {
        const summaryMessages = [
          { role: 'system' as const, content: '你是一个对话总结助手。只输出总结内容，不要其他解释。' },
          { role: 'user' as const, content: summaryPrompt }
        ];
        const r = await window.eeInfo?.llm?.chat?.({
          provider: provider as 'ollama' | 'zhipu',
          ...(provider === 'ollama'
            ? { baseUrl: configs.ollama.baseUrl, model: configs.ollama.model, think: false }
            : { apiKey: configs.zhipu.apiKey, baseUrl: configs.zhipu.baseUrl, model: configs.zhipu.model }),
          messages: summaryMessages
        });
        if (r?.success && r.content?.trim()) {
          setMemory((prev) => {
            const next = [...prev, r.content.trim()];
            window.eeInfo?.agent?.saveMemory?.(next);
            return next;
          });
        }
      } catch (_) {}
    }
    const id = `s-${Date.now()}`;
    setCurrentSessionId(id);
    setSessions((prev) => {
      const next = [...prev, { id, title: '新对话', messages: [], createdAt: Date.now() }];
      window.eeInfo?.agent?.saveSessions?.(next);
      return next;
    });
  }, [messages, canSend, provider, configs]);

  const loadSession = useCallback((id: string) => {
    setCurrentSessionId(id);
    setHistoryOpen(false);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (provider === 'zhipu' && !configs.zhipu.apiKey?.trim()) {
      setError('请先在「设置」中配置智谱 API Key');
      return;
    }

    setError(null);
    setInput('');
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    let sessionId = currentSessionId;
    if (!sessionId) {
        sessionId = `s-${Date.now()}`;
      setCurrentSessionId(sessionId);
      setSessions((prev) => {
        const next = [...prev, { id: sessionId!, title: '新对话', messages: [], createdAt: Date.now() }];
        window.eeInfo?.agent?.saveSessions?.(next);
        return next;
      });
    }
    const historyMsgs = [...messages, userMsg];
    const isFirstMsg = messages.length === 0;
    if (isFirstMsg) {
      persistSession(sessionId, historyMsgs, text.slice(0, 20));
    }
    setLoading(true);

    const learnContext = buildLearnContextBlock(learnDataProp ?? null);
    let systemContent = `${BASE_SYSTEM}\n\n【用户当前的课程与作业数据】\n${learnContext}`;
    if (trainingPlanContext) {
      systemContent += `\n\n【用户培养方案与已修学分】\n${trainingPlanContext}`;
    }
    if (memory.length > 0) {
      systemContent += `\n\n【历史对话记忆】\n${memory.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
    }

    const history = historyMsgs.map((m) => ({ role: m.role, content: m.content }));
    const apiMessages = [
      { role: 'system' as const, content: systemContent },
      ...history
    ];

    const chatOpts = provider === 'ollama'
      ? { provider: 'ollama' as const, baseUrl: configs.ollama.baseUrl, model: configs.ollama.model, messages: apiMessages, think: configs.ollama.think }
      : { provider: 'zhipu' as const, apiKey: configs.zhipu.apiKey, baseUrl: configs.zhipu.baseUrl, model: configs.zhipu.model, messages: apiMessages };

    try {
      const result = await window.eeInfo?.llm?.chat?.(chatOpts);

      if (result?.success && result.content) {
        const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: result.content };
        const newMsgs = [...historyMsgs, assistantMsg];
        persistSession(sessionId!, newMsgs, isFirstMsg ? text.slice(0, 20) : undefined);
      } else {
        setError(result?.error || '请求失败');
      }
    } catch (e) {
      setError((e as Error)?.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">EE智能体</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            智谱 GLM 或本地 Ollama，辅助课程学习与日程规划
          </p>
        </div>
        <div className="flex gap-1 items-center">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className={`px-2 py-1 rounded text-[10px] border transition ${
              historyOpen ? 'bg-slate-700/80 border-slate-600 text-slate-200' : 'border-slate-700 text-slate-500 hover:border-slate-600'
            }`}
          >
            历史
          </button>
          <button
            type="button"
            onClick={startNewChat}
            className="px-2 py-1 rounded text-[10px] border border-slate-700 text-slate-500 hover:border-slate-600 transition"
          >
            新对话
          </button>
          <button
            type="button"
            onClick={() => setProvider('ollama')}
            className={`px-2 py-1 rounded text-[10px] border transition ${
              provider === 'ollama'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'border-slate-700 text-slate-500 hover:border-slate-600'
            }`}
          >
            Ollama
          </button>
          <button
            type="button"
            onClick={() => setProvider('zhipu')}
            className={`px-2 py-1 rounded text-[10px] border transition ${
              provider === 'zhipu'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'border-slate-700 text-slate-500 hover:border-slate-600'
            }`}
          >
            智谱
          </button>
        </div>
      </div>

      {historyOpen && (
        <div className="mb-3 rounded-lg border border-slate-700/80 bg-slate-950/60 max-h-32 overflow-y-auto">
          <div className="px-2 py-1.5 border-b border-slate-700/60 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">历史记录</span>
            {memory.length > 0 && (
              <button
                type="button"
                onClick={() => { setMemory([]); window.eeInfo?.agent?.saveMemory?.([]); }}
                className="text-[9px] text-slate-500 hover:text-slate-400"
                title="清除跨会话记忆"
              >
                清除记忆
              </button>
            )}
          </div>
          <div className="p-1 space-y-0.5">
            {sessions.length === 0 ? (
              <p className="px-2 py-2 text-[10px] text-slate-500">暂无历史对话</p>
            ) : (
              [...sessions].reverse().map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadSession(s.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-[10px] truncate transition ${
                    s.id === currentSessionId ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/60'
                  }`}
                  title={s.title}
                >
                  {s.title || '新对话'}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {provider === 'zhipu' && !canSend && (
        <div className="mb-2 text-[10px] text-amber-400 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30">
          使用智谱需先在「设置」中配置 API Key
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-lg border border-slate-700/80 bg-slate-950/40 flex flex-col overflow-hidden">
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 py-8">
              <p>输入问题开始对话</p>
              <p className="mt-2 text-slate-400">例如：这周有哪些作业要交？有哪些课程？帮我规划复习计划</p>
              {learnDataProp && (learnDataProp.courses?.length || learnDataProp.homework?.length) ? (
                <p className="mt-1 text-[10px] text-emerald-500/80">已加载你的课程与作业数据</p>
              ) : null}
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] ${
                  m.role === 'user'
                    ? 'ee-user-msg bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'
                    : 'bg-slate-800/80 text-slate-200 border border-slate-700/80'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 text-[11px] bg-slate-800/80 border border-slate-700/80 text-slate-400">
                <span className="animate-pulse">思考中...</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-3 mb-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11px] text-red-400">
            {error}
          </div>
        )}

        <div className="p-3 border-t border-slate-700/80 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={canSend ? '输入问题...' : '请先在设置中配置 API Key'}
            disabled={!canSend || loading}
            className="flex-1 px-3 py-2 rounded-md bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] placeholder-slate-500 focus:outline-none focus:border-slate-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend || loading || !input.trim()}
            className="px-3 py-2 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningAgentPanel;
