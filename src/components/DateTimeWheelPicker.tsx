import React, { useState, useEffect } from 'react';

/** 存储格式: ISO 字符串 "2025-01-15T14:30:00"，时间颗粒度 30 分钟 */
interface DateTimeWheelPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function roundToHalfHour(d: Date): Date {
  const m = d.getMinutes();
  const rounded = m < 30 ? 0 : 30;
  const out = new Date(d);
  out.setMinutes(rounded, 0, 0);
  return out;
}

const YEARS = [2026, 2027];

const DateTimeWheelPicker: React.FC<DateTimeWheelPickerProps> = ({
  value,
  onChange,
  placeholder = '设置截止',
  className = ''
}) => {
  const now = new Date();
  const initial = value ? new Date(value) : null;
  const [year, setYear] = useState(initial?.getFullYear() ?? 2026);
  const [month, setMonth] = useState((initial?.getMonth() ?? now.getMonth()) + 1);
  const [day, setDay] = useState(initial?.getDate() ?? now.getDate());
  const defaultTime = roundToHalfHour(now);
  const [hour, setHour] = useState(initial ? roundToHalfHour(initial).getHours() : defaultTime.getHours());
  const [minute, setMinute] = useState(initial ? (roundToHalfHour(initial).getMinutes() as 0 | 30) : (defaultTime.getMinutes() as 0 | 30));
  const [open, setOpen] = useState(false);
  const [dateInput, setDateInput] = useState('');

  useEffect(() => {
    if (!open) return;
    const days = getDaysInMonth(year, month);
    if (day > days) setDay(days);
    if (!YEARS.includes(year)) setYear(2026);
  }, [year, month, open]);

  useEffect(() => {
    if (open) {
      setDateInput(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute === 30 ? '30' : '00'}`);
    }
  }, [open, year, month, day, hour, minute]);

  const commit = () => {
    const d = new Date(year, month - 1, day, hour, minute, 0, 0);
    onChange(d.toISOString());
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 30];

  const displayText = value
    ? (() => {
        const d = new Date(value);
        const m = d.getMinutes();
        const minStr = m < 30 ? '00' : '30';
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${minStr}`;
      })()
    : placeholder;

  const parseDateInput = (s: string) => {
    const trimmed = s.trim();
    const withTime = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
    const dateOnly = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const m = withTime || dateOnly;
    if (m) {
      const [, y, mo, d, h, min] = m;
      const yi = parseInt(y!, 10);
      const moi = parseInt(mo!, 10);
      const di = parseInt(d!, 10);
      const hi = h != null ? parseInt(h!, 10) : 23;
      const minVal = min != null ? parseInt(min!, 10) : 30;
      const mini = minVal >= 30 ? 30 : 0;
      if (YEARS.includes(yi) && moi >= 1 && moi <= 12 && di >= 1 && di <= getDaysInMonth(yi, moi) && hi >= 0 && hi <= 23) {
        setYear(yi);
        setMonth(moi);
        setDay(di);
        setHour(hi);
        setMinute(mini);
      }
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`px-2 py-1 rounded text-[10px] border transition ${
          value
            ? 'bg-slate-800/80 border-slate-600 text-slate-300'
            : 'bg-slate-900/80 border-slate-700/80 text-slate-500 hover:border-slate-600'
        }`}
      >
        {displayText}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-medium text-slate-300 mb-3">设置截止日期</div>
            <input
              type="text"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              onBlur={() => parseDateInput(dateInput)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') parseDateInput(dateInput);
              }}
              placeholder="2026-01-15 14:30"
              className="w-full px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] mb-3 focus:outline-none focus:border-slate-500"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
              >
                {days.map((d) => (
                  <option key={d} value={d}>{d}日</option>
                ))}
              </select>
              <span className="text-slate-500 text-[10px]">|</span>
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}时</option>
                ))}
              </select>
              <select
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value) as 0 | 30)}
                className="px-2 py-1.5 rounded bg-slate-800/80 border border-slate-600 text-slate-200 text-[11px] focus:outline-none focus:border-slate-500"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}分</option>
                ))}
              </select>
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-slate-700/80">
              <button
                type="button"
                onClick={clear}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                清除
              </button>
              <button
                type="button"
                onClick={commit}
                className="text-[10px] text-emerald-400 hover:text-emerald-300"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimeWheelPicker;
