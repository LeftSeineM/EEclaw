/** 培养方案 HTML 解析器 - 移植自 course-helper */

export interface ParsedCourse {
  courseId: string;
  courseName: string;
  credits: number;
  grade: string;
  gpa: number;
  status: 'completed' | 'not_taken' | 'withdrawn' | 'failed' | 'enrolled' | 'unknown';
  isOutOfPlan?: boolean;
}

export interface ParsedGroup {
  name: string;
  courses: ParsedCourse[];
  stats: { requiredCredits: number; completedCredits: number; requiredCourses: number; completedCourses: number; isCompleted: boolean } | null;
}

export interface ParsedType {
  name: string;
  type?: string;
  groups: ParsedGroup[];
}

export interface ParsedTrainingPlan {
  studentInfo: { studentId: string; name: string; totalCredits: number; completedCredits: number };
  courseTypes: ParsedType[];
}

export class TrainingPlanParser {
  private doc: Document;

  constructor(html: string) {
    this.doc = new DOMParser().parseFromString(html, 'text/html');
  }

  private cleanText(text: string | null | undefined): string {
    if (!text) return '';
    let cleaned = text.trim();
    if (cleaned.includes('vpn_eval')) {
      const parts = cleaned.split(');');
      if (parts.length > 1) cleaned = parts[parts.length - 1];
      cleaned = cleaned.replace(/[";)]/g, '').trim();
    }
    if (cleaned.includes('truncdata')) {
      const m = cleaned.match(/truncdata\(.*?,\s*\d+\)([\s\S]*)/);
      if (m) cleaned = m[1].trim();
    }
    return cleaned;
  }

  getStudentInfo() {
    try {
      const bodyText = this.doc.body?.textContent || '';
      return {
        studentId: bodyText.match(/学号[：:\s]*(\d+)/)?.[1]?.trim() || '',
        name: bodyText.match(/姓名[：:\s]*([^\s&,]+)/)?.[1]?.trim() || '',
        totalCredits: parseFloat(bodyText.match(/应完成总学分[：:\s]*(\d+)/)?.[1] || '0') || 0,
        completedCredits: parseFloat(bodyText.match(/方案内实际完成总学分[：:\s]*([\d.]+)/)?.[1] || '0') || 0
      };
    } catch {
      return { studentId: '', name: '', totalCredits: 0, completedCredits: 0 };
    }
  }

  private findMainTable(): HTMLTableElement | null {
    for (const table of this.doc.querySelectorAll('table')) {
      if (table.textContent?.includes('课程属性') && table.textContent?.includes('课组名')) {
        return table as HTMLTableElement;
      }
    }
    return null;
  }

  parse(): ParsedTrainingPlan {
    const table = this.findMainTable();
    if (!table) return { courseTypes: [], studentInfo: this.getStudentInfo() };

    const rows = Array.from(table.querySelectorAll('tr'));
    const result: ParsedTrainingPlan = { studentInfo: this.getStudentInfo(), courseTypes: [] };
    let currentType: ParsedType | null = null;
    let currentGroup: ParsedGroup | null = null;
    let typeRowsLeft = 0;
    let groupRowsLeft = 0;

    let startIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].textContent?.includes('课程属性') && rows[i].textContent?.includes('课组名')) {
        startIndex = i + 1;
        break;
      }
    }

    const typenames = ['必修', '限选', '任选'];
    for (let i = startIndex; i < rows.length; i++) {
      const cells = Array.from(rows[i].cells);
      if (cells.length < 5) continue;
      let cellCursor = 0;

      if (typeRowsLeft === 0 && cellCursor < cells.length) {
        const typeName = this.cleanText(cells[cellCursor].textContent);
        const rowSpan = parseInt(cells[cellCursor].getAttribute('rowspan') || '1');
        if (typeName.includes('必修') || typeName.includes('限选') || typeName.includes('任选')) {
          currentType = { name: typeName, groups: [] };
          result.courseTypes.push(currentType);
          typeRowsLeft = rowSpan;
          cellCursor++;
        }
      }
      typeRowsLeft = Math.max(0, typeRowsLeft - 1);

      if (groupRowsLeft === 0 && cellCursor < cells.length) {
        const groupName = this.cleanText(cells[cellCursor].textContent);
        const rowSpan = parseInt(cells[cellCursor].getAttribute('rowspan') || '1');
        currentGroup = { name: groupName, courses: [], stats: null };
        if (currentType) currentType.groups.push(currentGroup);
        const len = cells.length;
        if (len >= 5) {
          currentGroup.stats = {
            requiredCredits: parseFloat(this.cleanText(cells[len - 5].textContent)) || 0,
            completedCredits: parseFloat(this.cleanText(cells[len - 4].textContent)) || 0,
            requiredCourses: parseFloat(this.cleanText(cells[len - 3].textContent)) || 0,
            completedCourses: parseFloat(this.cleanText(cells[len - 2].textContent)) || 0,
            isCompleted: this.cleanText(cells[len - 1].textContent).includes('是')
          };
        }
        groupRowsLeft = rowSpan;
        cellCursor++;
      }
      groupRowsLeft = Math.max(0, groupRowsLeft - 1);

      if (cellCursor + 4 < cells.length) {
        const courseId = this.cleanText(cells[cellCursor].textContent);
        const courseName = this.cleanText(cells[cellCursor + 1].textContent);
        const grade = this.cleanText(cells[cellCursor + 3].textContent);
        if (courseId && courseName) {
          let status: ParsedCourse['status'] = 'unknown';
          if (grade.includes('未修')) status = 'not_taken';
          else if (grade.includes('选课') || grade === 'P' || /^[A-D][+-]?$/.test(grade) || grade?.trim()) status = 'completed';
          else if (grade === 'W') status = 'withdrawn';
          else if (grade === 'F') status = 'failed';

          const course: ParsedCourse = {
            courseId,
            courseName,
            credits: parseFloat(this.cleanText(cells[cellCursor + 2].textContent)) || 0,
            grade,
            gpa: parseFloat(this.cleanText(cells[cellCursor + 4].textContent)) || 0,
            status,
            isOutOfPlan: !!cells[cellCursor + 1]?.querySelector('font[color="#0000FF"]')
          };
          if (currentGroup) currentGroup.courses.push(course);
        }
      }
    }

    let typeCount = 0;
    for (const type of result.courseTypes) {
      type.type = typenames[typeCount++];
      for (const group of type.groups) {
        let cc = 0, cn = 0;
        for (const c of group.courses) {
          if (c.status === 'completed') { cc += c.credits; cn++; }
        }
        if (group.stats) {
          group.stats.completedCredits = cc;
          group.stats.completedCourses = cn;
          group.stats.isCompleted = cc >= group.stats.requiredCredits;
        }
      }
    }
    return result;
  }
}
