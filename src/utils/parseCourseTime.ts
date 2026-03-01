/**
 * 解析课程时间，如 "第1-16周星期五第2节" -> { weekday: 5, period: 2 }
 * 星期：一=1, 二=2, 三=3, 四=4, 五=5, 六=6, 日=7
 * 支持 HTML 格式："第1-16周星期二第2节，五教5102"（中文逗号分隔时间与地点）
 */
const WEEKDAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7
};

export interface ParsedTime {
  weekday: number; // 1-7 周一到周日
  period: number;
  raw?: string;
}

export interface ParsedTimeLocation {
  time: string;   // 如 "第1-16周星期二第2节"
  location: string; // 如 "五教5102"
  raw: string;
}

/**
 * 从 HTML 格式解析上课时间地点
 * 格式：第1-16周星期二第2节，五教5102（支持中文逗号 ， 或英文逗号 ,）
 */
export function parseTimeLocationFromHtml(raw?: string): ParsedTimeLocation | null {
  if (!raw?.trim()) return null;
  const sep = raw.includes('，') ? '，' : ',';
  const idx = raw.indexOf(sep);
  if (idx < 0) {
    // 无分隔符，整段作为时间（可能不含地点）
    return { time: raw.trim(), location: '', raw: raw.trim() };
  }
  return {
    time: raw.slice(0, idx).trim(),
    location: raw.slice(idx + 1).trim(),
    raw: raw.trim()
  };
}

export function parseCourseTime(sksj?: string, skdd?: string, skddxx?: string): ParsedTime | null {
  const all = parseAllCourseTimes(sksj, skdd, skddxx);
  return all.length > 0 ? all[0] : null;
}

/**
 * 解析课程的所有上课时间（支持一周多节）
 * 格式示例：
 * - "第1-16周星期二第2节，五教5102"
 * - "第1-16周星期二第2节；第1-16周星期四第4节"（分号分隔多时段）
 * - "第1-16周星期二第1-2节"（连续两节）
 */
export function parseAllCourseTimes(sksj?: string, skdd?: string, skddxx?: string): ParsedTime[] {
  const raw = [sksj, skdd, skddxx].filter(Boolean).join('');
  if (!raw) return [];

  const result: ParsedTime[] = [];
  // 按 ；; \n 分割多个时段
  const parts = raw.split(/[；;]\s*|\n+/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const tl = parseTimeLocationFromHtml(part);
    const timeStr = tl ? tl.time : part;

    let weekday: number | undefined;
    const weekdayMatch = timeStr.match(/星期([一二三四五六日])/);
    if (weekdayMatch) {
      weekday = WEEKDAY_MAP[weekdayMatch[1]];
    } else {
      const shortMatch = timeStr.match(/周([一二三四五六日])/);
      if (shortMatch) weekday = WEEKDAY_MAP[shortMatch[1]];
    }
    if (!weekday) continue;

    // 支持 "第1-2节" 或 "第1节" 或 "1-2节"
    const rangeMatch = timeStr.match(/第?(\d+)-(\d+)节/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let p = start; p <= end; p++) {
        result.push({ weekday, period: p, raw: part });
      }
      continue;
    }

    const periodMatch = timeStr.match(/第?(\d+)节/);
    if (periodMatch) {
      const period = parseInt(periodMatch[1], 10);
      result.push({ weekday, period, raw: part });
    }
  }

  return result;
}

export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
