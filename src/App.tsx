import React, { useState, useEffect, useCallback } from 'react';
import LoginModal from './components/LoginModal';
import CourseDetailPanel from './components/CourseDetailPanel';
import CourseTimetable from './components/CourseTimetable';
import ContentDetailModal, { type ContentItem } from './components/ContentDetailModal';
import TaskList from './components/TaskList';
import SettingsPanel from './components/SettingsPanel';
import LearningAgentPanel from './components/LearningAgentPanel';
import CourseSelectionPanel from './components/CourseSelectionPanel';

function getCourseColorIndex(courseName: string): number {
  let h = 0;
  for (let i = 0; i < courseName.length; i++) h = (h << 5) - h + courseName.charCodeAt(i);
  return (Math.abs(h) % 8) + 1; // 1-8 for wood theme
}

const navItems = [
  { key: 'assignments', label: 'EE工作台' },
  { key: 'agent', label: 'EE智能体' },
  { key: 'courses', label: '课程选课' },
  { key: 'login', label: '登录' },
  { key: 'settings', label: '设置' }
];

interface Course {
  wlkcid: string;
  kcm: string;
  jsm: string;
  xnxq: string;
  skdd?: string;
  sksj?: string;
  skddxx?: string;
}

interface HomeworkItem {
  bt: string;
  jzsj: string;
  status: string;
  courseName: string;
  isUnsubmitted?: boolean;
  hasRead?: boolean;
  wlkcid?: string;
  xszyid?: string;
  submitUrl?: string | null;
  detailUrl?: string | null;
}

interface LearnData {
  courses: Course[];
  notices: Array<{ bt: string; fbr: string; fbsj: string; courseName: string; hasRead?: boolean; detailUrl?: string | null; ggnrStr?: string; wlkcid?: string; ggid?: string }>;
  homework: HomeworkItem[];
  unsubmittedHomework: HomeworkItem[];
  fetchedAt?: number;
  semester?: string;
  semesters?: string[];
  newCount?: number;
}

const READ_STORAGE_KEY = 'ee-info-read';

function getItemKey(item: { _type?: string; wlkcid?: string; ggid?: string; xszyid?: string; detailUrl?: string | null; courseName?: string; bt?: string }): string {
  const t = item._type === 'notice' ? 'n' : 'h';
  if (item.wlkcid && (item.ggid || (item as { xszyid?: string }).xszyid)) {
    const id = item._type === 'notice' ? (item as { ggid?: string }).ggid : (item as { xszyid?: string }).xszyid;
    return `${t}:${item.wlkcid}:${id}`;
  }
  if (item.detailUrl) return `${t}:${item.detailUrl}`;
  return `${t}:${item.courseName || ''}:${item.bt || ''}`;
}

function useReadState() {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  const markAsRead = useCallback((item: { _type?: string; wlkcid?: string; ggid?: string; xszyid?: string; detailUrl?: string | null; courseName?: string; bt?: string }) => {
    const key = getItemKey(item);
    setReadIds((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);
  const getIsRead = useCallback((item: { _type?: string; wlkcid?: string; ggid?: string; xszyid?: string; detailUrl?: string | null; courseName?: string; bt?: string }) => {
    return readIds.has(getItemKey(item));
  }, [readIds]);
  return { markAsRead, getIsRead };
}

const App: React.FC = () => {
  const { markAsRead, getIsRead } = useReadState();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeNav, setActiveNav] = useState('assignments');
  const [learnData, setLearnData] = useState<LearnData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentDetailItem, setContentDetailItem] = useState<ContentItem | null>(null);
  const loadCached = useCallback(async () => {
    const data = await window.eeInfo?.crawler?.getCached?.();
    if (data) setLearnData(data);
  }, []);

  useEffect(() => {
    const check = async () => {
      const status = await window.eeInfo?.auth?.getStatus?.();
      setLoggedIn(!!status?.loggedIn);
    };
    check();
  }, []);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const loadSemesters = useCallback(async () => {
    const list = await window.eeInfo?.crawler?.getSemesterList?.();
    if (list?.length) {
      setLearnData((prev) => (prev ? { ...prev, semesters: list } : prev));
    }
    return list;
  }, []);

  useEffect(() => {
    if (learnData && loggedIn && (!learnData.semesters || learnData.semesters.length === 0)) {
      loadSemesters();
    }
  }, [learnData?.semesters, loggedIn, loadSemesters]);

  const doFetch = useCallback(async (skipAuthCheck = false, semesterId?: string) => {
    if (!skipAuthCheck && !loggedIn) {
      setFetchError('请先登录');
      setLoginModalOpen(true);
      return;
    }
    setFetching(true);
    setFetchError(null);
    const result = await window.eeInfo?.crawler?.fetch?.(semesterId);
    setFetching(false);
    if (result?.success) {
      setLearnData(result.data);
      setSelectedSemester(null);
    } else if (result?.error === 'SESSION_EXPIRED') {
      setFetchError('抓取失败：会话可能已过期，请手动点击左侧「登录」后再点刷新');
    } else {
      setFetchError(result?.message || result?.error || '抓取失败');
    }
  }, [loggedIn]);

  const handleRefresh = useCallback((semesterId?: string) => doFetch(false, semesterId), [doFetch]);

  // 调试阶段：登录成功仅更新状态与返回数据，不做自动抓取，避免自动退出
  const handleLoginSuccess = useCallback(
    (data?: LearnData | null) => {
      setLoggedIn(true);
      setLoginModalOpen(false);
      setFetchError(null);
      if (data && typeof data === 'object') setLearnData(data);
      else loadCached();
    },
    [loadCached]
  );

  const handleNavClick = (key: string) => {
    setActiveNav(key);
    if (key === 'login') setLoginModalOpen(true);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex">
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
      <ContentDetailModal
        open={contentModalOpen}
        onClose={() => { setContentModalOpen(false); setContentDetailItem(null); }}
        item={contentDetailItem}
      />

      {/* 左侧边栏 */}
      <aside className="ee-sidebar-left w-[var(--ee-sidebar-left-width)] min-w-[var(--ee-sidebar-left-width)] shrink-0 border-r border-slate-800 flex flex-col bg-slate-950/80 backdrop-blur">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-emerald-500/80 flex items-center justify-center text-xs font-semibold">
            EE
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight">EE info</span>
            <span className="text-xs text-slate-400">课程 · 作业 · 日程</span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-slate-800/70 transition
              ${activeNav === item.key ? 'bg-slate-800/80 text-slate-50' : 'text-slate-300'}`}
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                <span>{item.label}</span>
              </span>
              {item.key === 'login' && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    loggedIn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {loggedIn ? '已登录' : '未登录'}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500 space-y-2">
          <div className="flex items-center justify-between">
            <span>未读更新</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 text-[10px] text-slate-300">
              {learnData?.newCount ?? 0} 条
            </span>
          </div>
          {loggedIn && (
            <button
              onClick={async () => {
                await window.eeInfo?.auth?.logout?.();
                setLoggedIn(false);
              }}
              className="w-full rounded-md border border-slate-700 py-1.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-300"
            >
              退出登录
            </button>
          )}
        </div>
      </aside>

      {/* 中间主视图 */}
      <main className="flex-1 flex flex-col bg-slate-950/60">
        {/* 顶部栏 */}
        <header className="ee-app-header h-12 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          {activeNav === 'settings' ? (
            <span className="text-sm font-medium text-slate-200">设置</span>
          ) : activeNav === 'agent' ? (
            <span className="text-sm font-medium text-slate-200">EE智能体</span>
          ) : activeNav === 'courses' ? (
            <span className="text-sm font-medium text-slate-200">课程选课</span>
          ) : (
          <>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-slate-500">学期</span>
            <select
              value={selectedSemester ?? learnData?.semester ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  setSelectedSemester(v);
                  handleRefresh(v);
                }
              }}
              onFocus={() => {
                if (learnData && (!learnData.semesters?.length) && loggedIn) loadSemesters();
              }}
              className="px-2 py-1 rounded-md bg-slate-900 text-xs border border-slate-700 text-slate-200 min-w-[140px]"
              disabled={fetching || !loggedIn}
            >
              {(learnData?.semesters?.length ? learnData.semesters : learnData?.semester ? [learnData.semester] : []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {(!learnData?.semesters?.length && !learnData?.semester) && (
                <option value="">加载中…</option>
              )}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={async () => {
                const r = await window.eeInfo?.crawler?.diagnose?.();
                console.log('抓取诊断:', r);
                const msg = [
                  `Cookie 数量: ${r?.cookieCount ?? 0}`,
                  `Cookie 名称: ${r?.cookieNames ?? '(无)'}`,
                  `XSRF 头: ${r?.hasXsrf ? '已添加' : '无'}`,
                  r?.testResult?.ok
                    ? `测试: 成功，学期 ${r.testResult.semester ?? '-'}`
                    : `测试: ${r?.testResult?.error ?? '未执行'}`,
                  r?.testResult?.statusCode != null ? `HTTP ${r.testResult.statusCode}` : '',
                  r?.testResult?.bodySnippet ? `响应: ${r.testResult.bodySnippet}` : ''
                ]
                  .filter(Boolean)
                  .join('\n');
                alert(msg);
              }}
              className="px-2 py-1 rounded-md border border-slate-700 text-slate-500 hover:bg-slate-800"
              title="诊断登录与抓取状态"
            >
              诊断
            </button>
            <button
              onClick={() => handleRefresh()}
              disabled={fetching || !loggedIn}
              className="px-2 py-1 rounded-md border border-slate-800 hover:bg-slate-900/70 disabled:opacity-50"
            >
              {fetching ? '抓取中…' : '刷新'}
            </button>
          </div>
          </>
          )}
        </header>

        {/* 中间内容 */}
        {activeNav === 'settings' ? (
          <section className="flex-1 min-h-0 overflow-auto relative">
            <SettingsPanel />
          </section>
        ) : activeNav === 'agent' ? (
          <section className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
            <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-4 flex flex-col">
              <LearningAgentPanel learnData={learnData} />
            </div>
          </section>
        ) : activeNav === 'courses' ? (
          <section className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <CourseSelectionPanel />
          </section>
        ) : (
        <section className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
          {/* 上：当前课程表 */}
          <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-4 flex flex-col overflow-hidden">
            <div className="ee-header-khaki flex items-center justify-between mb-3 -mx-4 -mt-4 px-4 pt-4 pb-2 rounded-t-xl">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">当前课程表</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  展示今天/本周的 EE 课程安排
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  添加课程
                </button>
              </div>
            </div>

            <div className="ee-wood-timetable flex-1 rounded-lg border border-slate-700/80 bg-slate-950/40 overflow-y-auto min-h-0">
              {selectedCourse ? (
                <CourseDetailPanel
                  course={selectedCourse}
                  onBack={() => setSelectedCourse(null)}
                />
              ) : learnData?.courses?.length ? (
                <CourseTimetable
                  courses={learnData.courses}
                  onCourseClick={setSelectedCourse}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  <p>点击「刷新」抓取课程（需已登录）</p>
                </div>
              )}
            </div>
          </div>

          {/* 下：近期信息汇总 */}
          <div className="flex-1 min-h-0 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-4 flex flex-col overflow-hidden">
            <div className="ee-header-khaki flex items-center justify-between mb-3 -mx-4 -mt-4 px-4 pt-4 pb-2 rounded-t-xl">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">近期信息汇总</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  汇总近期作业、通知、考试安排等
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-800">
                  ●
                  <span>按时间排序</span>
                </span>
              </div>
            </div>

            <div className="ee-wood-info flex-1 rounded-lg border border-slate-700/80 bg-slate-950/40 overflow-y-auto min-h-0">
              {fetchError && (
                <div className="mx-3 mt-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                  {fetchError}
                </div>
              )}
              {learnData?.notices?.length || learnData?.homework?.length ? (
                <ul className="p-3 space-y-2 text-xs">
                  {[
                      ...(learnData.notices || []).map((n) => ({ ...n, _type: 'notice' as const, _sort: n.fbsj })),
                      ...(learnData.homework || []).map((h) => ({
                        ...h,
                        _type: 'homework' as const,
                        _sort: h.jzsj,
                        _notDue: h.isUnsubmitted
                      }))
                    ]
                    .sort((a, b) => {
                      const aUnread = !a.hasRead ? 1 : 0;
                      const bUnread = !b.hasRead ? 1 : 0;
                      if (bUnread !== aUnread) return bUnread - aUnread;
                      if (a._type === 'homework' && b._type === 'homework' && a._notDue !== b._notDue)
                        return (b._notDue ? 1 : 0) - (a._notDue ? 1 : 0);
                      return String(b._sort || '').localeCompare(String(a._sort || ''));
                    })
                    .slice(0, 10)
                    .map((item, i) => {
                        const courseName = item.courseName || '';
                        const colorIdx = getCourseColorIndex(courseName);
                        const isRead = getIsRead(item);
                        return (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => {
                                setContentDetailItem(item as ContentItem);
                                setContentModalOpen(true);
                                markAsRead(item);
                              }}
                              data-course-color={colorIdx}
                              data-read={String(isRead)}
                              className={`ee-wood-item w-full text-left rounded-lg border border-slate-700/60 border-l-4 px-3 py-2 transition cursor-pointer ${
                                isRead ? 'bg-slate-900/40' : 'bg-amber-500/5'
                              } hover:bg-slate-800/60`}
                            >
                              <p className={`ee-wood-item-title truncate flex items-center gap-1.5 ${isRead ? 'text-slate-500' : 'text-slate-200'}`}>
                                {item.bt}
                              </p>
                              <p className="ee-wood-item-meta text-slate-500 text-[10px] mt-0.5">
                                {courseName} · {'fbsj' in item ? item.fbsj : 'jzsj' in item ? item.jzsj : (item as HomeworkItem).status}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                </ul>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  <p>公告与作业将在此展示</p>
                </div>
              )}
            </div>
          </div>
        </section>
        )}
      </main>

      {/* 右侧边栏：日程表 + 未完成作业 */}
      <aside className="ee-sidebar-right w-[var(--ee-sidebar-right-width)] min-w-[var(--ee-sidebar-right-width)] shrink-0 border-l border-slate-800 bg-slate-950/80 backdrop-blur flex flex-col">
        <header className="h-12 border-b border-slate-800 flex items-center justify-between px-3 shrink-0">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-200">日程表</span>
            <span className="text-[10px] text-slate-500">任务清单 · 未完成作业</span>
          </div>
        </header>

        <section className="flex-1 min-h-0 flex flex-col gap-3 p-3 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TaskList />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 未完成作业 */}
          {(() => {
            const homework = learnData?.homework ?? [];
            const now = Date.now();
            const compareBoolean = (a: boolean, b: boolean) => (a === b ? 0 : a ? -1 : 1);
            const sorted = [...homework].sort((a, b) => {
              const aDeadline = new Date(a.jzsj || 0).getTime();
              const bDeadline = new Date(b.jzsj || 0).getTime();
              const aNotDue = !!(a.isUnsubmitted && aDeadline > now);
              const bNotDue = !!(b.isUnsubmitted && bDeadline > now);
              return (
                compareBoolean(aNotDue, bNotDue) ||
                compareBoolean(aNotDue && !!a.isUnsubmitted, bNotDue && !!b.isUnsubmitted) ||
                (aNotDue && bNotDue ? aDeadline - bDeadline : bDeadline - aDeadline)
              );
            });
            const unfinished = sorted.filter((h) => h.isUnsubmitted);
            const formatDeadline = (jzsj: string) => {
              try {
                const d = new Date(jzsj);
                return isNaN(d.getTime()) ? jzsj : d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              } catch {
                return jzsj;
              }
            };
            return (
              <div className="ee-wood-homework rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden flex flex-col h-full">
                <div className="ee-header-khaki ee-wood-header flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
                  <span className="text-[11px] text-slate-400">未完成作业</span>
                  <span className="text-[10px] text-slate-500">{unfinished.length} 个</span>
                </div>
                {unfinished.length ? (
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr>
                          <th className="ee-wood-table-header p-2 text-left border-b border-slate-700/80 bg-slate-900/80 text-slate-500 font-medium">任务</th>
                          <th className="ee-wood-table-header p-2 text-left border-b border-slate-700/80 bg-slate-900/80 text-slate-500 font-medium w-20">课程</th>
                          <th className="ee-wood-table-header p-2 text-left border-b border-slate-700/80 bg-slate-900/80 text-slate-500 font-medium w-20">截止</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unfinished.slice(0, 12).map((h, i) => {
                          const deadline = new Date(h.jzsj || 0).getTime();
                          const isOverdue = h.isUnsubmitted && deadline < now;
                          return (
                            <tr key={i} className={`${isOverdue ? 'bg-red-500/5' : ''} ${i % 2 === 1 ? 'ee-wood-table-cell-alt' : ''}`}>
                              <td className="ee-wood-table-cell p-2 border-b border-slate-700/60 align-top">
                                <button
                                  type="button"
                                  onClick={() => h.submitUrl && window.eeInfo?.shell?.openExternal?.(h.submitUrl)}
                                  className={`w-full text-left truncate block ${h.submitUrl ? 'hover:text-emerald-400' : ''}`}
                                  title={h.bt}
                                >
                                  {h.bt}
                                </button>
                              </td>
                              <td className="ee-wood-table-cell p-2 border-b border-slate-700/60 text-slate-500 truncate max-w-[80px]">{h.courseName}</td>
                              <td className="ee-wood-table-cell p-2 border-b border-slate-700/60 text-slate-500 whitespace-nowrap">
                                {formatDeadline(h.jzsj)}
                                {isOverdue && <span className="text-red-400 ml-0.5">逾期</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-700/80 mx-2 my-4 py-6 flex items-center justify-center text-[11px] text-slate-500">
                    暂无未完成作业
                  </div>
                )}
                {homework.length > 0 && (
                  <p className="text-[10px] text-slate-600 px-3 py-2 border-t border-slate-800">
                    共 {homework.length} 个作业（已提交 {homework.length - unfinished.length}）
                  </p>
                )}
              </div>
            );
          })()}
          </div>
        </section>

        <footer className="h-9 shrink-0 border-t border-slate-800 px-3 flex items-center justify-between text-[10px] text-slate-500">
          <span>点击作业可打开提交页面</span>
        </footer>
      </aside>
    </div>
  );
};

export default App;
