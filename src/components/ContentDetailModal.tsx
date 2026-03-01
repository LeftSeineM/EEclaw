import React, { useState, useEffect } from 'react';

interface NoticeItem {
  _type: 'notice';
  bt: string;
  fbr: string;
  fbsj: string;
  courseName: string;
  ggnrStr?: string;
  wlkcid?: string;
  ggid?: string;
}

interface HomeworkItem {
  _type: 'homework';
  bt: string;
  jzsj: string;
  status: string;
  courseName: string;
  wlkcid?: string;
  xszyid?: string;
  submitUrl?: string | null;
  detailUrl?: string | null;
}

export type ContentItem = NoticeItem | HomeworkItem;

interface ContentDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: ContentItem | null;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const ContentDetailModal: React.FC<ContentDetailModalProps> = ({ open, onClose, item }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) {
      setContent('');
      setError(null);
      return;
    }
    if (item._type === 'notice') {
      const n = item as NoticeItem;
      if (n.ggnrStr) {
        setContent(n.ggnrStr);
        setError(null);
        return;
      }
      if (n.wlkcid && n.ggid) {
        setLoading(true);
        setError(null);
        window.eeInfo?.crawler?.getNoticeDetail?.(n.wlkcid, n.ggid)
          .then((d) => {
            setContent(d?.ggnrStr ?? '暂无内容');
          })
          .catch(() => setError('获取公告内容失败'))
          .finally(() => setLoading(false));
      } else {
        setContent('暂无内容');
      }
    } else {
      const h = item as HomeworkItem;
      if (h.wlkcid && h.xszyid) {
        setLoading(true);
        setError(null);
        window.eeInfo?.crawler?.getHomeworkDetail?.(h.wlkcid, h.xszyid)
          .then((d) => {
            setContent(d?.zynr ?? '暂无题目内容');
          })
          .catch(() => setError('获取作业内容失败'))
          .finally(() => setLoading(false));
      } else {
        setContent('暂无题目内容');
      }
    }
  }, [open, item]);

  if (!open) return null;

  const isNotice = item?._type === 'notice';
  const notice = item as NoticeItem | undefined;
  const homework = item as HomeworkItem | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-950/60 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-200 truncate">
              {item?.bt ?? '详情'}
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {item?.courseName}
              {isNotice && notice?.fbr && ` · ${notice.fbr}`}
              {isNotice && notice?.fbsj && ` · ${notice.fbsj}`}
              {!isNotice && homework?.jzsj && ` · 截止 ${homework.jzsj}`}
              {!isNotice && homework?.status && ` · ${homework.status}`}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {!isNotice && homework?.detailUrl && (
              <button
                type="button"
                onClick={() => homework.detailUrl && window.eeInfo?.shell?.openExternal?.(homework.detailUrl)}
                className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              >
                在浏览器中打开
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 rounded transition"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </header>

        <section className="flex-1 min-h-0 overflow-y-auto p-4 text-xs text-slate-300">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
                  <span className="animate-pulse">加载中...</span>
            </div>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {stripHtml(content) || '暂无内容'}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ContentDetailModal;
