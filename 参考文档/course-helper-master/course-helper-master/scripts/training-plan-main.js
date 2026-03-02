/**
 * 培养方案分析主程序
 * 整合所有模块，提供统一的入口
 */

class TrainingPlanManager {
  constructor() {
    this.parser = null;
    this.analyzer = null;
    this.exporter = null;
    this.report = null;
    this.recommendations = null;
  }

  /**
   * 从HTML分析培养方案
   */
  async analyzeFromHTML(html) {
    console.log('开始分析培养方案...');

    try {
      // 步骤1: 解析HTML
      console.log('步骤1: 解析HTML数据...');
      this.parser = new TrainingPlanParser(html);
      const parsedData = this.parser.parse();
      console.log('✓ 解析完成, 找到', parsedData.courseTypes.length, '个课程类型');

      // 步骤2: 分析数据
      console.log('步骤2: 分析培养方案数据...');
      this.analyzer = new TrainingPlanAnalyzer(parsedData);
      this.report = this.analyzer.generateReport();
      console.log('✓ 分析完成, 总学分:', this.report.summary.totalRequired);

      // 步骤3: 生成建议
      console.log('步骤3: 生成学习建议...');
      this.recommendations = this.analyzer.generateRecommendations(this.report);
      console.log('✓ 生成', this.recommendations.length, '条建议');

      // 步骤4: 创建导出器
      this.exporter = new TrainingPlanExporter(this.report, this.recommendations);

      console.log('分析完成!');
      return {
        success: true,
        report: this.report,
        recommendations: this.recommendations
      };

    } catch (error) {
      console.error('分析失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 从后台获取并分析
   */
  async fetchAndAnalyze() {
    console.log('正在从后台获取培养方案HTML...');

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'FETCH_TRAINING_PLAN_HTML' },
        async (response) => {
          if (response.success) {
            console.log('✓ 获取HTML成功');
            const result = await this.analyzeFromHTML(response.html);
            resolve(result);
          } else {
            console.error('✗ 获取HTML失败:', response.error);
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  /**
   * 导出报告（指定格式）
   */
  exportReport(format = 'all') {
    if (!this.exporter) {
      console.error('请先分析培养方案');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const baseFilename = `培养方案报告_${this.report.studentInfo.studentId}_${timestamp}`;

    switch (format.toLowerCase()) {
      case 'json':
        this.exporter.download(
          this.exporter.exportToJSON(),
          `${baseFilename}.json`,
          'application/json'
        );
        break;

      case 'txt':
      case 'text':
        this.exporter.download(
          this.exporter.exportToText(),
          `${baseFilename}.txt`,
          'text/plain;charset=utf-8'
        );
        break;

      case 'csv':
        this.exporter.download(
          this.exporter.exportToCSV(),
          `${baseFilename}.csv`,
          'text/csv;charset=utf-8'
        );
        break;

      case 'md':
      case 'markdown':
        this.exporter.download(
          this.exporter.exportToMarkdown(),
          `${baseFilename}.md`,
          'text/markdown;charset=utf-8'
        );
        break;

      case 'all':
      default:
        this.exporter.exportAll(baseFilename);
        break;
    }
  }

  /**
   * 获取报告摘要（用于UI显示）
   */
  getReportSummary() {
    if (!this.report) {
      return null;
    }

    return {
      studentInfo: this.report.studentInfo,
      summary: this.report.summary,
      incompleteCount: this.report.incompleteGroups.length,
      topRecommendations: this.recommendations.slice(0, 5)
    };
  }

  /**
   * 获取特定课程组的详细信息
   */
  getGroupDetail(groupName) {
    if (!this.report) {
      return null;
    }

    const allGroups = [
      ...this.report.byType.required.groups,
      ...this.report.byType.elective.groups,
      ...this.report.byType.optional.groups
    ];

    return allGroups.find(g => g.groupName === groupName);
  }

  /**
   * 获取所有未完成的课程组
   */
  getIncompleteGroups() {
    return this.report?.incompleteGroups || [];
  }

  /**
   * 按类型获取课程组
   */
  getGroupsByType(type) {
    if (!this.report) {
      return [];
    }

    switch (type.toLowerCase()) {
      case 'required':
      case '必修':
        return this.report.byType.required.groups;
      
      case 'elective':
      case '限选':
        return this.report.byType.elective.groups;
      
      case 'optional':
      case '任选':
        return this.report.byType.optional.groups;
      
      default:
        return [];
    }
  }
}

// 全局实例（方便在控制台调试）
if (typeof window !== 'undefined') {
  window.trainingPlanManager = new TrainingPlanManager();
  
  // 提供便捷方法
  window.analyzeTrainingPlan = async function() {
    const result = await window.trainingPlanManager.fetchAndAnalyze();
    if (result.success) {
      console.log('分析成功!');
      console.log('完成情况:', result.report.summary);
      console.log('未完成课程组:', result.report.incompleteGroups.length);
      console.log('\n使用 exportTrainingPlan() 导出报告');
      console.log('使用 showRecommendations() 查看建议');
    }
    return result;
  };

  window.exportTrainingPlan = function(format = 'all') {
    window.trainingPlanManager.exportReport(format);
    console.log(`报告已导出 (格式: ${format})`);
  };

  window.showRecommendations = function() {
    const recs = window.trainingPlanManager.recommendations;
    if (!recs) {
      console.log('请先运行 analyzeTrainingPlan()');
      return;
    }

    console.log('\n=== 学习建议（按优先级排序）===\n');
    recs.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.groupName} (${rec.groupType})`);
      console.log(`   剩余学分: ${rec.remainingCredits}`);
      rec.suggestions.forEach(s => {
        console.log(`   ${s.message}`);
        if (s.courses.length > 0 && s.courses.length <= 5) {
          s.courses.forEach(c => {
            console.log(`     - ${c.courseName} (${c.credits}学分)`);
          });
        }
      });
      console.log('');
    });
  };
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrainingPlanManager;
}