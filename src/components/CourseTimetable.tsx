import React from 'react';
import { parseAllCourseTimes, WEEKDAY_NAMES } from '../utils/parseCourseTime';

interface Course {
  wlkcid: string;
  kcm: string;
  jsm: string;
  skdd?: string;
  sksj?: string;
  skddxx?: string;
}

interface CourseTimetableProps {
  courses: Course[];
  onCourseClick: (course: Course) => void;
}

const MAX_PERIOD = 6;

const CourseTimetable: React.FC<CourseTimetableProps> = ({ courses, onCourseClick }) => {
  const grid: (Course | null)[][] = Array.from({ length: MAX_PERIOD + 1 }, () =>
    Array(7).fill(null)
  );
  const unplaced: Course[] = [];

  for (const c of courses) {
    const allParsed = parseAllCourseTimes(c.sksj, c.skdd, c.skddxx);
    let placed = false;
    for (const parsed of allParsed) {
      if (parsed.period >= 1 && parsed.period <= MAX_PERIOD && parsed.weekday >= 1 && parsed.weekday <= 7) {
        const row = parsed.period - 1;
        const col = parsed.weekday - 1;
        if (!grid[row][col]) {
          grid[row][col] = c;
          placed = true;
        }
      }
    }
    if (!placed) unplaced.push(c);
  }

  return (
    <div className="flex flex-col h-full min-h-[280px]">
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full border-collapse text-xs table-fixed" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th className="w-12 p-2 border border-slate-700 bg-slate-900/80 text-slate-400 font-medium text-[10px]">
                节次
              </th>
              {WEEKDAY_NAMES.map((name) => (
                <th
                  key={name}
                  className="p-2 border border-slate-700 bg-slate-900/80 text-slate-400 font-medium"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.slice(0, MAX_PERIOD).map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="p-1 border border-slate-700/80 bg-slate-950/60 text-slate-500 text-center w-12">
                  {rowIdx + 1}
                </td>
                {row.map((c, colIdx) => (
                  <td
                    key={colIdx}
                    className="p-1 border border-slate-700/80 align-top bg-slate-950/40 min-h-[48px]"
                  >
                    {c ? (
                      <button
                        onClick={() => onCourseClick(c)}
                        className="w-full h-full min-h-[44px] rounded-md p-2 text-left bg-slate-800/80 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-slate-700/80 transition"
                      >
                        <p className="font-medium text-slate-200 truncate text-[11px]">{c.kcm}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5 truncate">{c.jsm}</p>
                        <p className="text-slate-500 text-[9px] mt-0.5 truncate">{c.skdd || c.skddxx || ''}</p>
                      </button>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unplaced.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/80">
          <p className="text-[10px] text-slate-500 mb-1">未解析时间 ({unplaced.length})</p>
          <div className="flex flex-wrap gap-1">
            {unplaced.map((c) => (
              <button
                key={c.wlkcid}
                onClick={() => onCourseClick(c)}
                className="px-2 py-1 rounded-md border border-slate-700 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-[10px] truncate max-w-[120px]"
              >
                {c.kcm}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseTimetable;
