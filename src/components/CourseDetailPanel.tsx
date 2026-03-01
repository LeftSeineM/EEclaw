import React, { useState, useEffect, useCallback } from 'react';

interface Course {
  wlkcid: string;
  kcm: string;
  jsm: string;
  skdd?: string;
  sksj?: string;
  skddxx?: string;
}

interface Notice {
  ggid: string;
  bt: string;
  fbr: string;
  fbsj: string;
  ggnrStr?: string;
}

interface Homework {
  bt: string;
  jzsj: string;
  status: string;
  zywcfs?: string;
}

interface FileFolder {
  id: string;
  bt: string;
}

interface CourseDetailPanelProps {
  course: Course;
  onBack: () => void;
}

const SIDEBAR_ITEMS = [
  { key: 'info', label: '课程信息' },
  { key: 'notices', label: '课程公告' },
  { key: 'files', label: '课程文件' },
  { key: 'homework', label: '课程作业' }
];

const CourseDetailPanel: React.FC<CourseDetailPanelProps> = ({ course, onBack }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [detail, setDetail] = useState<{ skdd?: string; sksj?: string; skddxx?: string } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [fileFolders, setFileFolders] = useState<FileFolder[]>([]);
  const [fileList, setFileList] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTabContent = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'info') {
        const d = await window.eeInfo?.crawler?.getCourseDetail?.(course.wlkcid);
        setDetail(d || { skdd: course.skdd, sksj: course.sksj, skddxx: course.skddxx });
      } else if (activeTab === 'notices') {
        const list = await window.eeInfo?.crawler?.getNotices?.(course.wlkcid);
        setNotices(list || []);
      } else if (activeTab === 'homework') {
        const list = await window.eeInfo?.crawler?.getHomework?.(course.wlkcid);
        setHomework(list || []);
      } else if (activeTab === 'files') {
        const folders = await window.eeInfo?.crawler?.getCourseFiles?.(course.wlkcid);
        setFileFolders(folders || []);
        setFileList([]);
      }
    } finally {
      setLoading(false);
    }
  }, [course.wlkcid, activeTab, course.skdd, course.sksj, course.skddxx]);

  useEffect(() => {
    loadTabContent();
  }, [loadTabContent]);

  const loadFileList = async (flid: string) => {
    setLoading(true);
    try {
      const list = await window.eeInfo?.crawler?.getCourseFileList?.(course.wlkcid, flid);
      setFileList(list || []);
    } finally {
      setLoading(false);
    }
  };

  // 优先使用 skddxx（如 "第1-16周星期二第2节，五教5102"），否则拼接 sksj + skdd
  const timeLocation =
    detail?.skddxx || course.skddxx
      ? `上课时间地点: ${detail?.skddxx || course.skddxx}`
      : detail?.sksj || detail?.skdd || course.sksj || course.skdd
        ? `上课时间地点: ${[detail?.sksj || course.sksj, detail?.skdd || course.skdd].filter(Boolean).join('，')}`
        : null;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-800">
        <button
          onClick={onBack}
          className="px-2 py-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-xs"
        >
          ← 返回
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{course.kcm} ({course.jsm})</h2>
          {timeLocation && (
            <p className="text-xs text-emerald-400/90 mt-0.5 truncate">{timeLocation}</p>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-48 border-r border-slate-800 p-2 space-y-0.5 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition
                ${activeTab === item.key ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/60'}`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-4 overflow-y-auto min-h-0">
          {loading ? (
            <p className="text-xs text-slate-500">加载中…</p>
          ) : activeTab === 'info' ? (
            <div className="space-y-3 text-xs">
              {timeLocation && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                  <p className="text-slate-400 text-[10px] mb-1">上课时间地点</p>
                  <p className="text-slate-200">{timeLocation}</p>
                </div>
              )}
              {!timeLocation && (
                <p className="text-slate-500">暂无课程信息，请刷新后重试</p>
              )}
            </div>
          ) : activeTab === 'notices' ? (
            <ul className="space-y-2 text-xs">
              {notices.length ? (
                notices.map((n) => (
                  <li key={n.ggid} className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                    <p className="font-medium text-slate-200">{n.bt}</p>
                    <p className="text-slate-500 text-[10px] mt-1">{n.fbr} · {n.fbsj}</p>
                    {n.ggnrStr && (
                      <p className="text-slate-400 mt-1 line-clamp-3">{n.ggnrStr}</p>
                    )}
                  </li>
                ))
              ) : (
                <p className="text-slate-500">暂无公告</p>
              )}
            </ul>
          ) : activeTab === 'homework' ? (
            <ul className="space-y-2 text-xs">
              {homework.length ? (
                homework.map((h, i) => (
                  <li key={i} className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 flex items-center justify-between">
                    <span className="text-slate-200 truncate">{h.bt}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      h.status === '未提交' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {h.status}
                    </span>
                  </li>
                ))
              ) : (
                <p className="text-slate-500">暂无作业</p>
              )}
            </ul>
          ) : activeTab === 'files' ? (
            <div className="space-y-3 text-xs">
              {fileFolders.length ? (
                <>
                  <p className="text-slate-400 text-[10px]">点击分类查看文件</p>
                  <div className="space-y-1">
                    {fileFolders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => loadFileList(f.id)}
                        className="w-full text-left px-3 py-2 rounded-md border border-slate-700 hover:bg-slate-800/60 text-slate-200"
                      >
                        {f.bt}
                      </button>
                    ))}
                  </div>
                  {fileList.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-slate-400 text-[10px] mb-2">文件列表</p>
                      <ul className="space-y-1">
                        {fileList.map((f: unknown, i: number) => {
                          const item = f as Record<string, unknown>;
                          const name = item?.wjmc ?? item?.name ?? item?.bt ?? item?.title ?? '-';
                          const size = item?.wjdx ?? item?.size ?? item?.rawSize ?? '';
                          const downloadUrl = item?.downloadUrl as string | undefined;
                          const previewUrl = item?.previewUrl as string | undefined;
                          return (
                            <li key={i} className="text-slate-300 truncate flex items-center gap-2 group">
                              <span className="truncate flex-1">{String(name)}</span>
                              {size && <span className="text-slate-500 text-[10px] flex-shrink-0">{String(size)}</span>}
                              {previewUrl && (
                                <a
                                  href={previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 text-[10px] text-slate-400 hover:text-slate-300"
                                  title="在线预览（需浏览器已登录网络学堂）"
                                >
                                  预览
                                </a>
                              )}
                              {downloadUrl && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const fname = String(name || 'download');
                                      const r = await window.eeInfo?.crawler?.downloadFile?.(downloadUrl, fname);
                                      if (r?.ok) alert(`已保存到: ${r.path}`);
                                      else throw new Error(r?.error);
                                    } catch (e) {
                                      alert(`下载失败: ${(e as Error)?.message}`);
                                    }
                                  }}
                                  className="flex-shrink-0 text-[10px] text-emerald-400 hover:text-emerald-300 opacity-0 group-hover:opacity-100 transition"
                                  title="下载（使用已登录会话）"
                                >
                                  下载
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500">暂无课程文件</p>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default CourseDetailPanel;
