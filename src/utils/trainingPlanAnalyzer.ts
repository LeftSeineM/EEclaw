/** 培养方案分析器 - 移植自 course-helper */

import type { ParsedTrainingPlan, ParsedGroup } from './trainingPlanParser';
import type { GroupAnalysis } from '../types/courseSelection';

export class TrainingPlanAnalyzer {
  constructor(private data: ParsedTrainingPlan) {}

  analyzeGroup(group: ParsedGroup, groupType: string): GroupAnalysis {
    const result: GroupAnalysis = {
      groupName: group.name,
      groupType,
      requiredCredits: group.stats?.requiredCredits || 0,
      completedCredits: group.stats?.completedCredits || 0,
      requiredCourses: group.stats?.requiredCourses || 0,
      completedCourses: group.stats?.completedCourses || 0,
      isCompleted: group.stats?.isCompleted || false,
      remainingCredits: 0,
      remainingCourses: 0,
      incompleteCourseList: [],
      completedCourseList: [],
      enrolledCourseList: []
    };
    result.remainingCredits = Math.max(0, result.requiredCredits - result.completedCredits);
    result.remainingCourses = Math.max(0, result.requiredCourses - result.completedCourses);

    for (const course of group.courses) {
      const info = { courseId: course.courseId, courseName: course.courseName, credits: course.credits, grade: course.grade, gpa: course.gpa };
      if (course.status === 'completed' && !course.isOutOfPlan) result.completedCourseList!.push(info);
      else if (course.status === 'enrolled') result.enrolledCourseList!.push(info);
      else if (course.status === 'not_taken') result.incompleteCourseList.push(info);
    }
    return result;
  }

  generateReport() {
    const report = {
      studentInfo: this.data.studentInfo,
      summary: {
        totalRequired: this.data.studentInfo.totalCredits,
        totalCompleted: this.data.studentInfo.completedCredits,
        totalRemaining: 0,
        completionRate: '0'
      },
      byType: {
        required: { groups: [] as GroupAnalysis[], totalRequired: 0, totalCompleted: 0 },
        elective: { groups: [] as GroupAnalysis[], totalRequired: 0, totalCompleted: 0 },
        optional: { groups: [] as GroupAnalysis[], totalRequired: 0, totalCompleted: 0 }
      },
      incompleteGroups: [] as GroupAnalysis[],
      timestamp: new Date().toISOString()
    };
    report.summary.totalRemaining = report.summary.totalRequired - report.summary.totalCompleted;
    report.summary.completionRate = report.summary.totalRequired > 0 ? ((report.summary.totalCompleted / report.summary.totalRequired) * 100).toFixed(2) : '0';

    for (const typeData of this.data.courseTypes) {
      const typeName = typeData.type || typeData.name;
      let cat = typeName?.includes('必修') ? report.byType.required : typeName?.includes('限选') ? report.byType.elective : typeName?.includes('任选') ? report.byType.optional : null;
      if (cat) {
        for (const group of typeData.groups) {
          const ga = this.analyzeGroup(group, typeName || '');
          cat.groups.push(ga);
          cat.totalRequired += ga.requiredCredits;
          cat.totalCompleted += ga.completedCredits;
          if (!ga.isCompleted && ga.requiredCredits > 0) report.incompleteGroups.push(ga);
        }
      }
    }
    return report;
  }

  generateRecommendations(report: ReturnType<typeof this.generateReport>) {
    return report.incompleteGroups.map(g => ({
      groupName: g.groupName,
      groupType: g.groupType,
      remainingCredits: g.remainingCredits,
      suggestions: g.incompleteCourseList.length ? [{ type: 'specific', courses: g.incompleteCourseList }] : []
    }));
  }
}
