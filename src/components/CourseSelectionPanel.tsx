import React, { useState, useEffect, useCallback } from 'react';
import type { CourseSelectionData, GroupAnalysis, CourseReviewsData, CourseReview } from '../types/courseSelection';
import { TrainingPlanParser } from '../utils/trainingPlanParser';
import { TrainingPlanAnalyzer } from '../utils/trainingPlanAnalyzer';

const REVIEW_API = 'https://yourschool.cc/thucourse_api/api/review/';

declare global {
  interface Window {
    eeInfo?: {
      courseSelection?: {
        fetchTrainingPlan: () => Promise<{ success: boolean; html?: string; error?: string }>;
        getData: () => Promise<unknown>;
        setData: (data: unknown) => Promise<{ ok: boolean }>;
        onLog?: (cb: (msg: string) => void) => () => void;
      };
    };
  }
}

export default function CourseSelectionPanel() {
  const [data, setData] = useState<CourseSelectionData | null>(null);
  const [trainingPlanLoading, setTrainingPlanLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'required' | 'elective'>('all');
  const [selectedGroup, setSelectedGroup] = useState<GroupAnalysis | null>(null);
  const [modalCourse, setModalCourse] = useState<{ courseName: string; courseId: string; credits: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logPanelOpen, setLogPanelOpen] = useState(false);

  const loadData = useCallback(async () => {
    const d = await window.eeInfo?.courseSelection?.getData?.();
    setData((d as CourseSelectionData) || null);
  }, []);

  const saveData = useCallback(async (next: CourseSelectionData) => {
    await window.eeInfo?.courseSelection?.setData?.(next);
    setData(next);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsub = window.eeInfo?.courseSelection?.onLog?.(msg => setLogs(prev => [...prev, msg]));
    return () => unsub?.();
  }, []);

  const allGroups = (): GroupAnalysis[] => {
    if (!data?.trainingPlan?.report) return [];
    const r = data.trainingPlan.report;
    return [
      ...(r.byType.required?.groups || []).map(g => ({ ...g, type: 'required' as const })),
      ...(r.byType.elective?.groups || []).map(g => ({ ...g, type: 'elective' as const })),
      ...(r.byType.optional?.groups || []).map(g => ({ ...g, type: 'optional' as const }))
    ];
  };

  const filteredGroups = (): GroupAnalysis[] => {
    const all = allGroups();
    if (filter === 'incomplete') return all.filter(g => !g.isCompleted);
    if (filter === 'required') return all.filter(g => (g as { type?: string }).type === 'required');
    if (filter === 'elective') return all.filter(g => (g as { type?: string }).type === 'elective');
    return all;
  };

  const getReviewsByName = (courseName: string): CourseReview[] => {
    const reviews = data?.reviews?.courses;
    if (!reviews) return [];
    return reviews.filter(c => c.course_name.includes(courseName) || courseName.includes(c.course_name)).sort((a, b) => b.rating - a.rating);
  };

  const fetchTrainingPlan = async () => {
    setTrainingPlanLoading(true);
    setError(null);
    setLogs([]);
    setLogPanelOpen(true);
    try {
      const result = await window.eeInfo?.courseSelection?.fetchTrainingPlan?.();
      if (!result?.success || !result?.html) {
        setError(result?.error || '抓取失败');
        return;
      }
      const parser = new TrainingPlanParser(result.html);
      const parsedData = parser.parse();
      const analyzer = new TrainingPlanAnalyzer(parsedData);
      const report = analyzer.generateReport();
      const recommendations = analyzer.generateRecommendations(report);
      await saveData({ ...(data || {}), trainingPlan: { report, recommendations, parsedData }, lastUpdate: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : '抓取培养方案失败');
    } finally {
      setTrainingPlanLoading(false);
    }
  };

  const fetchReviews = async () => {
    setReviewsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${REVIEW_API}?page=1&size=20`);
      const first = await res.json();
      const total = first.count || 0;
      if (total <= 0) {
        setError('未获取到评价数据');
        return;
      }
      const all: Array<{ course: { name: string; teacher: string; id: number }; rating: number; comment: string }> = [...(first.results || [])];
      for (let p = 2; p <= Math.ceil(total / 20); p++) {
        await new Promise(r => setTimeout(r, 400));
        const r2 = await fetch(`${REVIEW_API}?page=${p}&size=20`);
        const d2 = await r2.json();
        if (d2.results) all.push(...d2.results);
      }
      const courseMap = new Map<string, { course_name: string; course_teacher: string; course_id: number; rating: number; comments: string[]; comment_sum: number }>();
      all.forEach(item => {
        const key = `${item.course?.name || ''}|||${item.course?.teacher || ''}`;
        if (!courseMap.has(key)) {
          courseMap.set(key, { course_name: item.course?.name || '', course_teacher: item.course?.teacher || '', course_id: item.course?.id || 0, rating: item.rating, comments: [item.comment || ''], comment_sum: 1 });
        } else {
          const c = courseMap.get(key)!;
          const n = c.comment_sum + 1;
          c.rating = (c.rating * c.comment_sum + item.rating) / n;
          c.comments.push(item.comment || '');
          c.comment_sum = n;
        }
      });
      await saveData({ ...(data || {}), reviews: { courses: Array.from(courseMap.values()), lastUpdate: Date.now(), totalCount: total }, lastUpdate: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取评价失败');
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        await saveData(parsed);
      } catch {
        setError('导入失败');
      }
    };
    input.click();
  };

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `course-selection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const report = data?.trainingPlan?.report;
  const summary = report?.summary;

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
      <div className="ee-header-khaki flex items-center justify-between -mx-4 px-4 pb-2 shrink-0">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">课程选课</h2>
          <p className="text-xs text-slate-400 mt-0.5">培养方案、选课评价、开课信息</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={fetchTrainingPlan} disabled={trainingPlanLoading} className="px-2 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            {trainingPlanLoading ? '抓取中…' : '🔄 更新培养方案'}
          </button>
          <button onClick={fetchReviews} disabled={reviewsLoading} className="px-2 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            {reviewsLoading ? '更新中…' : '📊 更新选课评价'}
          </button>
          <button onClick={handleImport} className="px-2 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800">📥 导入 JSON</button>
          <button onClick={handleExport} disabled={!data} className="px-2 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50">📤 导出</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 shrink-0">{error}</div>}

      {summary && (
        <div className="grid grid-cols-4 gap-2 shrink-0">
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
            <div className="text-[10px] text-slate-500">总学分要求</div>
            <div className="text-lg font-bold text-emerald-400">{summary.totalRequired}</div>
          </div>
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
            <div className="text-[10px] text-slate-500">已完成</div>
            <div className="text-lg font-bold text-emerald-400">{summary.totalCompleted}</div>
          </div>
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
            <div className="text-[10px] text-slate-500">剩余</div>
            <div className="text-lg font-bold text-amber-400">{summary.totalRemaining}</div>
          </div>
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
            <div className="text-[10px] text-slate-500">未完成课组</div>
            <div className="text-lg font-bold">{report?.incompleteGroups?.length ?? 0}</div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        <aside className="w-[var(--ee-sidebar-left-width)] min-w-[var(--ee-sidebar-left-width)] shrink-0 rounded-lg border border-slate-700/80 bg-slate-900/50 p-3 overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-300 mb-2">课程组</h3>
          <div className="flex gap-1 mb-2">
            {(['all', 'incomplete', 'required', 'elective'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 rounded text-[10px] ${filter === f ? 'bg-emerald-500/30 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                {f === 'all' ? '全部' : f === 'incomplete' ? '未完成' : f === 'required' ? '必修' : '限选'}
              </button>
            ))}
          </div>
          {!report ? (
            <p className="text-[10px] text-slate-500 py-4">暂无培养方案数据，请点击「更新培养方案」或导入 JSON</p>
          ) : filteredGroups().length === 0 ? (
            <p className="text-[10px] text-slate-500 py-4">无符合条件的课程组</p>
          ) : (
            <div className="space-y-1">
              {filteredGroups().map(g => (
                <button key={g.groupName} onClick={() => { setSelectedGroup(g); setModalCourse(null); }} className={`w-full text-left px-2 py-1.5 rounded text-[11px] border transition ${selectedGroup?.groupName === g.groupName ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-transparent hover:bg-slate-800/60 text-slate-300'} ${g.isCompleted ? 'opacity-60' : ''}`}>
                  <div className="font-medium truncate">{g.groupName}</div>
                  <div className="text-[9px] text-slate-500">{g.completedCredits}/{g.requiredCredits} 学分</div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 min-h-0 rounded-lg border border-slate-700/80 bg-slate-900/50 p-4 overflow-y-auto">
          {!selectedGroup ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">从左侧选择课程组</div>
          ) : selectedGroup.incompleteCourseList?.length === 0 ? (
            <div className="h-full flex items-center justify-center text-emerald-400 text-sm">✅ 该课程组已完成</div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-200">{selectedGroup.groupName}</h3>
              <div className="grid gap-2">
                {selectedGroup.incompleteCourseList?.map(c => {
                  const reviews = getReviewsByName(c.courseName);
                  return (
                    <button key={c.courseId} onClick={() => setModalCourse({ courseName: c.courseName, courseId: c.courseId, credits: c.credits })} className="w-full text-left rounded-lg border border-slate-700/60 px-3 py-2 hover:bg-slate-800/60 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-slate-200">{c.courseName}</div>
                          <div className="text-[10px] text-slate-500">{c.courseId} · {c.credits} 学分</div>
                        </div>
                        {reviews.length > 0 && <div className="text-amber-400 text-xs">⭐ {reviews[0].rating.toFixed(1)} ({reviews.length} 位教师)</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 左下角操作日志 */}
      <div className="shrink-0 border-t border-slate-700/80 mt-2">
        <button
          onClick={() => setLogPanelOpen(!logPanelOpen)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 rounded-b transition"
        >
          <span>操作日志 {logs.length > 0 && `(${logs.length})`}</span>
          <span className="text-[10px]">{logPanelOpen ? '▼ 收起' : '▶ 展开'}</span>
        </button>
        {logPanelOpen && (
          <div className="max-h-32 overflow-y-auto bg-slate-950/80 rounded-b border-t border-slate-800/80 px-3 py-2 font-mono text-[10px] text-slate-400 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-slate-500">点击「更新培养方案」后，此处会显示抓取步骤，便于排查问题</p>
            ) : (
              <>
                {logs.map((line, i) => (
                  <div key={i} className="break-all" title={line}>{line}</div>
                ))}
                <button
                  onClick={() => navigator.clipboard?.writeText(logs.join('\n'))}
                  className="mt-2 px-2 py-0.5 rounded border border-slate-600 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                >
                  复制日志
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {modalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalCourse(null)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-slate-200">{modalCourse.courseName}</h3>
                <div className="text-xs text-slate-500">{modalCourse.courseId} · {modalCourse.credits} 学分</div>
              </div>
              <button onClick={() => setModalCourse(null)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {getReviewsByName(modalCourse.courseName).map((r, i) => (
                <div key={i} className="rounded-lg border border-slate-700/60 p-2 bg-slate-950/60">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400">{r.course_teacher}</span>
                    <span className="text-amber-400">⭐ {r.rating.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-3">{r.comments[0]}</p>
                  {r.comment_sum > 1 && <p className="text-[9px] text-slate-500 mt-0.5">共 {r.comment_sum} 条评价</p>}
                </div>
              ))}
              {getReviewsByName(modalCourse.courseName).length === 0 && <p className="text-xs text-slate-500">暂无评价，点击「更新选课评价」获取</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
