/**
 * 培养方案分析器
 * 负责分析解析后的数据，生成统计报告
 */

class TrainingPlanAnalyzer {
  constructor(parsedData) {
    this.data = parsedData;
  }

  /**
   * 分析单个课程组
   */
  analyzeGroup(group, groupType) {
    const result = {
      groupName: group.name,
      groupType: groupType,
      requiredCredits: group.stats?.requiredCredits || 0,
      completedCredits: group.stats?.completedCredits || 0,
      requiredCourses: group.stats?.requiredCourses || 0,
      completedCourses: group.stats?.completedCourses || 0,
      isCompleted: group.stats?.isCompleted || false,
      remainingCredits: 0,
      remainingCourses: 0,
      completedCourseList: [],
      incompleteCourseList: [],
      enrolledCourseList: []
    };

    // 计算剩余学分和课程数
    result.remainingCredits = Math.max(0, result.requiredCredits - result.completedCredits);
    result.remainingCourses = Math.max(0, result.requiredCourses - result.completedCourses);

    // 分类课程
    for (const course of group.courses) {
      const courseInfo = {
        courseId: course.courseId,
        courseName: course.courseName,
        credits: course.credits,
        grade: course.grade,
        gpa: course.gpa
      };

      if (course.status === 'completed' && !course.isOutOfPlan) {
        result.completedCourseList.push(courseInfo);
      } else if (course.status === 'enrolled') {
        result.enrolledCourseList.push(courseInfo);
      } else if (course.status === 'not_taken') {
        result.incompleteCourseList.push(courseInfo);
      }
    }

    return result;
  }

  /**
   * 生成完整分析报告
   */
  generateReport() {
    const report = {
      studentInfo: this.data.studentInfo,
      summary: {
        totalRequired: this.data.studentInfo.totalCredits,
        totalCompleted: this.data.studentInfo.completedCredits,
        totalRemaining: 0,
        completionRate: 0
      },
      byType: {
        required: { groups: [], totalRequired: 0, totalCompleted: 0 },
        elective: { groups: [], totalRequired: 0, totalCompleted: 0 },
        optional: { groups: [], totalRequired: 0, totalCompleted: 0 }
      },
      incompleteGroups: [],
      timestamp: new Date().toISOString()
    };

    // 计算总体完成情况
    report.summary.totalRemaining = report.summary.totalRequired - report.summary.totalCompleted;
    report.summary.completionRate = report.summary.totalRequired > 0 
      ? (report.summary.totalCompleted / report.summary.totalRequired * 100).toFixed(2)
      : 0;

    // 分析各课程类型
    for (const typeData of this.data.courseTypes) {
      const typeName = typeData.type;
      let category = null;

      if (typeName.includes('必修')) {
        category = report.byType.required;
      } else if (typeName.includes('限选')) {
        category = report.byType.elective;
      } else if (typeName.includes('任选')) {
        category = report.byType.optional;
      }

      if (category) {
        for (const group of typeData.groups) {
          const groupAnalysis = this.analyzeGroup(group, typeName);
          category.groups.push(groupAnalysis);
          category.totalRequired += groupAnalysis.requiredCredits;
          category.totalCompleted += groupAnalysis.completedCredits;

          // 记录未完成的课程组
          if (!groupAnalysis.isCompleted && groupAnalysis.requiredCredits > 0) {
            report.incompleteGroups.push(groupAnalysis);
          }
        }
      }
    }

    return report;
  }

  /**
   * 生成建议（基于未完成课程组）
   */
  generateRecommendations(report) {
    const recommendations = [];

    for (const group of report.incompleteGroups) {
      const rec = {
        groupName: group.groupName,
        groupType: group.groupType,
        priority: this.calculatePriority(group),
        remainingCredits: group.remainingCredits,
        suggestions: []
      };

      // 必修课程组：列出所有未修课程
      if (group.groupType.includes('必修')) {
        if (group.incompleteCourseList.length > 0) {
          rec.suggestions.push({
            type: 'specific',
            message: `还需完成以下课程（${group.remainingCredits}学分）：`,
            courses: group.incompleteCourseList
          });
        }
      } 
      // 限选课程组：如果有具体未修课程则列出，否则给出学分要求
      else if (group.groupType.includes('限选')) {
        if (group.incompleteCourseList.length > 0) {
          rec.suggestions.push({
            type: 'specific',
            message: `建议从以下课程中选修（还需${group.remainingCredits}学分）：`,
            courses: group.incompleteCourseList
          });
        } else {
          rec.suggestions.push({
            type: 'general',
            message: `还需在该课组中选修${group.remainingCredits}学分`,
            courses: []
          });
        }
      }
      // 通识选修：只给出学分要求
      else if (group.groupType.includes('任选') || group.groupName.includes('通识')) {
        rec.suggestions.push({
          type: 'general',
          message: `还需选修${group.remainingCredits}学分`,
          courses: []
        });
      }

      recommendations.push(rec);
    }

    // 按优先级排序
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations;
  }

  /**
   * 计算课程组优先级（用于排序建议）
   */
  calculatePriority(group) {
    let priority = 0;

    // 必修课程组优先级最高
    if (group.groupType.includes('必修')) {
      priority += 100;
    } else if (group.groupType.includes('限选')) {
      priority += 50;
    }

    // 剩余学分越多，优先级越高
    priority += group.remainingCredits;

    // 必修课程数量越多，优先级越高
    priority += group.remainingCourses * 5;

    return priority;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrainingPlanAnalyzer;
} else {
  window.TrainingPlanAnalyzer = TrainingPlanAnalyzer;
}