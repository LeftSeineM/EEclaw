/**
 * 培养方案导出器
 * 负责将分析结果导出为各种格式（JSON、TXT、CSV、Markdown等）
 */

class TrainingPlanExporter {
  constructor(report, recommendations) {
    this.report = report;
    this.recommendations = recommendations;
  }

  /**
   * 导出为JSON格式
   */
  exportToJSON() {
    const data = {
      report: this.report,
      recommendations: this.recommendations
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导出为可读文本格式
   */
  exportToText() {
    let text = '';

    // 标题
    text += '=' .repeat(60) + '\n';
    text += '          清华大学培养方案完成情况报告\n';
    text += '=' .repeat(60) + '\n\n';

    // 学生信息
    text += `学号: ${this.report.studentInfo.studentId}\n`;
    text += `姓名: ${this.report.studentInfo.name}\n`;
    text += `生成时间: ${new Date(this.report.timestamp).toLocaleString('zh-CN')}\n\n`;

    // 总体概览
    text += '-'.repeat(60) + '\n';
    text += '总体完成情况\n';
    text += '-'.repeat(60) + '\n';
    text += `应完成总学分: ${this.report.summary.totalRequired}\n`;
    text += `已完成学分: ${this.report.summary.totalCompleted}\n`;
    text += `剩余学分: ${this.report.summary.totalRemaining}\n`;
    text += `完成率: ${this.report.summary.completionRate}%\n\n`;

    // 分类统计
    text += '-'.repeat(60) + '\n';
    text += '分类完成情况\n';
    text += '-'.repeat(60) + '\n';
    text += this.formatTypeSection('必修课程', this.report.byType.required);
    text += this.formatTypeSection('限选课程', this.report.byType.elective);
    text += this.formatTypeSection('任选课程', this.report.byType.optional);

    // 详细课程组信息
    text += '\n' + '='.repeat(60) + '\n';
    text += '详细课程组完成情况\n';
    text += '='.repeat(60) + '\n\n';

    const allGroups = [
      ...this.report.byType.required.groups,
      ...this.report.byType.elective.groups,
      ...this.report.byType.optional.groups
    ];

    for (const group of allGroups) {
      text += this.formatGroupDetail(group);
    }

    // 学习建议
    if (this.recommendations && this.recommendations.length > 0) {
      text += '\n' + '='.repeat(60) + '\n';
      text += '学习建议（按优先级排序）\n';
      text += '='.repeat(60) + '\n\n';

      for (let i = 0; i < this.recommendations.length; i++) {
        text += this.formatRecommendation(i + 1, this.recommendations[i]);
      }
    }

    return text;
  }

  /**
   * 格式化课程类型部分
   */
  formatTypeSection(typeName, typeData) {
    let text = `\n【${typeName}】\n`;
    text += `  应修学分: ${typeData.totalRequired}\n`;
    text += `  已修学分: ${typeData.totalCompleted}\n`;
    text += `  剩余学分: ${typeData.totalRequired - typeData.totalCompleted}\n`;
    text += `  课程组数: ${typeData.groups.length}\n`;
    
    const completedGroups = typeData.groups.filter(g => g.isCompleted).length;
    text += `  已完成课程组: ${completedGroups}/${typeData.groups.length}\n`;
    
    return text;
  }

  /**
   * 格式化课程组详情
   */
  formatGroupDetail(group) {
    let text = '';
    text += '-'.repeat(60) + '\n';
    text += `课程组: ${group.groupName} (${group.groupType})\n`;
    text += '-'.repeat(60) + '\n';
    text += `应修学分: ${group.requiredCredits} | 已修学分: ${group.completedCredits}\n`;
    text += `应修门数: ${group.requiredCourses} | 已修门数: ${group.completedCourses}\n`;
    text += `完成状态: ${group.isCompleted ? '✓ 已完成' : '✗ 未完成'}\n`;

    if (group.completedCourseList.length > 0) {
      text += `\n已完成课程:\n`;
      for (const course of group.completedCourseList) {
        text += `  [${course.courseId}] ${course.courseName} (${course.credits}学分) - 成绩: ${course.grade}\n`;
      }
    }

    if (group.enrolledCourseList.length > 0) {
      text += `\n正在选修:\n`;
      for (const course of group.enrolledCourseList) {
        text += `  [${course.courseId}] ${course.courseName} (${course.credits}学分)\n`;
      }
    }

    if (group.incompleteCourseList.length > 0 && !group.groupName.includes('通识')) {
      text += `\n未修课程:\n`;
      for (const course of group.incompleteCourseList) {
        text += `  [${course.courseId}] ${course.courseName} (${course.credits}学分)\n`;
      }
    }

    text += '\n';
    return text;
  }

  /**
   * 格式化建议
   */
  formatRecommendation(index, rec) {
    let text = '';
    text += `${index}. ${rec.groupName}\n`;
    text += `   类型: ${rec.groupType} | 剩余学分: ${rec.remainingCredits}\n`;
    
    for (const suggestion of rec.suggestions) {
      text += `   ${suggestion.message}\n`;
      if (suggestion.courses.length > 0) {
        for (const course of suggestion.courses) {
          text += `     - [${course.courseId}] ${course.courseName} (${course.credits}学分)\n`;
        }
      }
    }
    
    text += '\n';
    return text;
  }

  /**
   * 导出为CSV格式
   */
  exportToCSV() {
    let csv = 'UTF-8 BOM\n'; // 添加BOM以支持中文
    csv = '\uFEFF'; // BOM字符
    
    // 表头
    csv += '课程组,课程类型,应修学分,已修学分,剩余学分,应修门数,已修门数,完成状态\n';

    const allGroups = [
      ...this.report.byType.required.groups,
      ...this.report.byType.elective.groups,
      ...this.report.byType.optional.groups
    ];

    for (const group of allGroups) {
      csv += `"${group.groupName}",`;
      csv += `"${group.groupType}",`;
      csv += `${group.requiredCredits},`;
      csv += `${group.completedCredits},`;
      csv += `${group.remainingCredits},`;
      csv += `${group.requiredCourses},`;
      csv += `${group.completedCourses},`;
      csv += `${group.isCompleted ? '是' : '否'}\n`;
    }

    return csv;
  }

  /**
   * 导出为Markdown格式
   */
  exportToMarkdown() {
    let md = '';

    // 标题
    md += '# 清华大学培养方案完成情况报告\n\n';
    md += `**学号**: ${this.report.studentInfo.studentId}  \n`;
    md += `**姓名**: ${this.report.studentInfo.name}  \n`;
    md += `**生成时间**: ${new Date(this.report.timestamp).toLocaleString('zh-CN')}\n\n`;

    // 总览
    md += '## 总体完成情况\n\n';
    md += '| 项目 | 数值 |\n';
    md += '|------|------|\n';
    md += `| 应完成总学分 | ${this.report.summary.totalRequired} |\n`;
    md += `| 已完成学分 | ${this.report.summary.totalCompleted} |\n`;
    md += `| 剩余学分 | ${this.report.summary.totalRemaining} |\n`;
    md += `| 完成率 | ${this.report.summary.completionRate}% |\n\n`;

    // 分类统计
    md += '## 分类完成情况\n\n';
    md += '| 类型 | 应修学分 | 已修学分 | 剩余学分 | 课程组数 | 已完成课程组 |\n';
    md += '|------|----------|----------|----------|----------|-------------|\n';
    
    const types = [
      ['必修课程', this.report.byType.required],
      ['限选课程', this.report.byType.elective],
      ['任选课程', this.report.byType.optional]
    ];

    for (const [name, data] of types) {
      const completed = data.groups.filter(g => g.isCompleted).length;
      md += `| ${name} | ${data.totalRequired} | ${data.totalCompleted} | `;
      md += `${data.totalRequired - data.totalCompleted} | ${data.groups.length} | `;
      md += `${completed}/${data.groups.length} |\n`;
    }

    // 详细课程组
    md += '\n## 详细课程组完成情况\n\n';

    const allGroups = [
      ...this.report.byType.required.groups,
      ...this.report.byType.elective.groups,
      ...this.report.byType.optional.groups
    ];

    for (const group of allGroups) {
      md += `### ${group.groupName} (${group.groupType})\n\n`;
      md += `- **应修学分**: ${group.requiredCredits} | **已修学分**: ${group.completedCredits}\n`;
      md += `- **应修门数**: ${group.requiredCourses} | **已修门数**: ${group.completedCourses}\n`;
      md += `- **完成状态**: ${group.isCompleted ? '✓ 已完成' : '✗ 未完成'}\n\n`;

      if (group.completedCourseList.length > 0) {
        md += '**已完成课程**:\n\n';
        for (const course of group.completedCourseList) {
          md += `- [${course.courseId}] ${course.courseName} (${course.credits}学分) - 成绩: ${course.grade}\n`;
        }
        md += '\n';
      }

      if (group.incompleteCourseList.length > 0 && !group.groupName.includes('通识')) {
        md += '**未修课程**:\n\n';
        for (const course of group.incompleteCourseList) {
          md += `- [${course.courseId}] ${course.courseName} (${course.credits}学分)\n`;
        }
        md += '\n';
      }
    }

    // 学习建议
    if (this.recommendations && this.recommendations.length > 0) {
      md += '## 学习建议（按优先级排序）\n\n';

      for (let i = 0; i < this.recommendations.length; i++) {
        const rec = this.recommendations[i];
        md += `### ${i + 1}. ${rec.groupName}\n\n`;
        md += `- **类型**: ${rec.groupType}\n`;
        md += `- **剩余学分**: ${rec.remainingCredits}\n\n`;

        for (const suggestion of rec.suggestions) {
          md += `${suggestion.message}\n\n`;
          if (suggestion.courses.length > 0) {
            for (const course of suggestion.courses) {
              md += `- [${course.courseId}] ${course.courseName} (${course.credits}学分)\n`;
            }
            md += '\n';
          }
        }
      }
    }

    return md;
  }

  /**
   * 触发下载
   */
  download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 导出所有格式
   */
  exportAll(baseFilename) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const base = baseFilename || `培养方案报告_${this.report.studentInfo.studentId}_${timestamp}`;

    // 导出JSON
    this.download(this.exportToJSON(), `${base}.json`, 'application/json');

    // 导出文本
    this.download(this.exportToText(), `${base}.txt`, 'text/plain;charset=utf-8');

    // 导出CSV
    this.download(this.exportToCSV(), `${base}.csv`, 'text/csv;charset=utf-8');

    // 导出Markdown
    this.download(this.exportToMarkdown(), `${base}.md`, 'text/markdown;charset=utf-8');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrainingPlanExporter;
} else {
  window.TrainingPlanExporter = TrainingPlanExporter;
}