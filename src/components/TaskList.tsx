import React, { useState, useEffect, useCallback } from 'react';
import DateTimeWheelPicker from './DateTimeWheelPicker';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  deadline?: string;
  color?: string;
}

const TASK_COLORS = [
  { id: 'red', bg: 'bg-red-500', border: 'border-red-500', ring: 'ring-red-500/50' },
  { id: 'amber', bg: 'bg-amber-500', border: 'border-amber-500', ring: 'ring-amber-500/50' },
  { id: 'emerald', bg: 'bg-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-500/50' },
  { id: 'blue', bg: 'bg-blue-500', border: 'border-blue-500', ring: 'ring-blue-500/50' },
  { id: 'violet', bg: 'bg-violet-500', border: 'border-violet-500', ring: 'ring-violet-500/50' },
  { id: 'pink', bg: 'bg-pink-500', border: 'border-pink-500', ring: 'ring-pink-500/50' },
] as const;

const STORAGE_KEY = 'ee-info-tasks';

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return [];
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (_) {}
}

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback(() => {
    const t = newText.trim();
    if (!t) return;
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t, done: false }
    ]);
    setNewText('');
  }, [newText]);

  const toggleDone = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x))
    );
  }, []);

  const setDeadline = useCallback((id: string, deadline: string) => {
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, deadline: deadline || undefined } : x))
    );
  }, []);

  const setColor = useCallback((id: string, color: string | undefined) => {
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, color } : x))
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const colorOrder = TASK_COLORS.map((c) => c.id);
  const colorIdx = (c: string | undefined) => {
    if (!c) return colorOrder.length;
    const i = colorOrder.indexOf(c);
    return i >= 0 ? i : colorOrder.length;
  };
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ca = colorIdx(a.color);
    const cb = colorIdx(b.color);
    if (ca !== cb) return ca - cb;
    const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return aTime - bTime;
  });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <span className="text-[11px] text-slate-400">任务清单</span>
        <span className="text-[9px] text-slate-500">同色分组 · 按截止日</span>
      </div>
      <div className="p-2 flex flex-col flex-1 min-h-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="添加任务..."
            className="flex-1 px-2 py-1.5 rounded-md bg-slate-900/80 border border-slate-700/80 text-slate-200 text-[11px] placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
          <button
            type="button"
            onClick={addTask}
            className="px-2 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] hover:bg-emerald-500/30 shrink-0"
          >
            添加
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mt-2 overflow-x-hidden">
          {sortedTasks.length === 0 ? (
            <p className="text-[10px] text-slate-500 py-4 text-center">暂无任务，点击上方添加</p>
          ) : (
            sortedTasks.map((t) => {
              const colorDef = TASK_COLORS.find((c) => c.id === t.color);
              return (
                <div
                  key={t.id}
                  className={`flex gap-2 px-2 py-1.5 rounded-md group ${
                    t.done ? 'bg-slate-900/40 opacity-70' : 'hover:bg-slate-800/60'
                  } ${colorDef ? `border-l-2 ${colorDef.border}` : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDone(t.id)}
                    className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition self-start mt-0.5 ${
                      t.done ? 'border-emerald-500 bg-emerald-500/30' : 'border-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {t.done && <span className="text-emerald-400 text-[10px]">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex-1 min-w-0 text-[11px] truncate ${
                          t.done ? 'text-slate-500 line-through' : 'text-slate-200'
                        }`}
                      >
                        {t.text}
                      </span>
                      <DateTimeWheelPicker
                        value={t.deadline}
                        onChange={(v) => setDeadline(t.id, v)}
                        placeholder="设置截止"
                        className="shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => removeTask(t.id)}
                        className="shrink-0 w-5 h-5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition text-[10px]"
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 shrink-0" title="标签颜色">
                        {TASK_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setColor(t.id, t.color === c.id ? undefined : c.id)}
                            className={`w-1.5 h-1.5 rounded-full ${c.bg} transition ${
                              t.color === c.id ? 'ring-1 ring-offset-0.5 ring-offset-slate-900 ' + c.ring : 'opacity-50 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskList;
