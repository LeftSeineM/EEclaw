/**
 * 培养方案解析器测试脚本
 * 在培养方案页面的控制台中运行
 */

// ========== 测试函数 ==========

/**
 * 完整测试流程
 */
async function testFullPipeline() {
  console.log('\n=== 开始完整测试 ===\n');
  
  try {
    // 步骤1: 获取HTML
    console.log('步骤1: 获取页面HTML...');
    const html = document.documentElement.outerHTML;
    console.log(`✓ HTML长度: ${html.length} 字符\n`);
    
    // 步骤2: 解析
    console.log('步骤2: 解析培养方案...');
    const parser = new TrainingPlanParser(html);
    const parsedData = parser.parse();
    console.log('✓ 解析完成\n');
    
    // 步骤3: 验证学生信息
    console.log('步骤3: 验证学生信息...');
    console.log('学生信息:', parsedData.studentInfo);
    if (!parsedData.studentInfo.studentId) {
      console.warn('⚠️ 警告: 学号为空');
    } else {
      console.log('✓ 学号:', parsedData.studentInfo.studentId);
    }
    if (!parsedData.studentInfo.name) {
      console.warn('⚠️ 警告: 姓名为空');
    } else {
      console.log('✓ 姓名:', parsedData.studentInfo.name);
    }
    console.log('✓ 总学分:', parsedData.studentInfo.totalCredits);
    console.log('✓ 已完成:', parsedData.studentInfo.completedCredits);
    console.log('');
    
    // 步骤4: 验证课程类型
    console.log('步骤4: 验证课程类型...');
    console.log(`找到 ${parsedData.courseTypes.length} 个课程类型:`);
    parsedData.courseTypes.forEach((type, i) => {
      console.log(`  ${i + 1}. ${type.type} - ${type.groups.length} 个课程组`);
    });
    console.log('');
    
    // 步骤5: 验证课程组
    console.log('步骤5: 验证课程组（前5个）...');
    let groupCount = 0;
    for (const type of parsedData.courseTypes) {
      for (const group of type.groups) {
        if (groupCount >= 5) break;
        
        console.log(`\n课程组 ${groupCount + 1}: ${group.name}`);
        console.log(`  类型: ${type.type}`);
        console.log(`  应修学分: ${group.stats.requiredCredits}`);
        console.log(`  已修学分: ${group.stats.completedCredits}`);
        console.log(`  课程数量: ${group.courses.length}`);
        console.log(`  是否完成: ${group.stats.isCompleted ? '是' : '否'}`);
        
        if (group.courses.length > 0) {
          console.log(`  第一门课: [${group.courses[0].courseId}] ${group.courses[0].courseName} (${group.courses[0].credits}学分) - ${group.courses[0].grade}`);
        }
        
        groupCount++;
      }
      if (groupCount >= 5) break;
    }
    console.log('');
    
    // 步骤6: 分析
    console.log('步骤6: 生成分析报告...');
    const analyzer = new TrainingPlanAnalyzer(parsedData);
    const report = analyzer.generateReport();
    console.log('✓ 分析完成\n');
    
    // 步骤7: 显示摘要
    console.log('步骤7: 报告摘要...');
    console.log('总体情况:');
    console.log(`  应修: ${report.summary.totalRequired} 学分`);
    console.log(`  已修: ${report.summary.totalCompleted} 学分`);
    console.log(`  剩余: ${report.summary.totalRemaining} 学分`);
    console.log(`  完成率: ${report.summary.completionRate}%`);
    console.log('');
    
    console.log('分类情况:');
    console.log(`  必修: ${report.byType.required.totalCompleted}/${report.byType.required.totalRequired} 学分`);
    console.log(`  限选: ${report.byType.elective.totalCompleted}/${report.byType.elective.totalRequired} 学分`);
    console.log(`  任选: ${report.byType.optional.totalCompleted}/${report.byType.optional.totalRequired} 学分`);
    console.log('');
    
    console.log(`未完成课程组: ${report.incompleteGroups.length} 个`);
    console.log('');
    
    // 步骤8: 生成建议
    console.log('步骤8: 生成学习建议...');
    const recommendations = analyzer.generateRecommendations(report);
    console.log(`✓ 生成 ${recommendations.length} 条建议\n`);
    
    // 步骤9: 测试导出
    console.log('步骤9: 测试导出功能...');
    const exporter = new TrainingPlanExporter(report, recommendations);
    
    const jsonLength = exporter.exportToJSON().length;
    const textLength = exporter.exportToText().length;
    const csvLength = exporter.exportToCSV().length;
    const mdLength = exporter.exportToMarkdown().length;
    
    console.log(`✓ JSON 导出: ${jsonLength} 字符`);
    console.log(`✓ 文本 导出: ${textLength} 字符`);
    console.log(`✓ CSV  导出: ${csvLength} 字符`);
    console.log(`✓ Markdown 导出: ${mdLength} 字符`);
    console.log('');
    
    console.log('=== 测试完成！===\n');
    
    // 返回所有数据供查看
    return {
      parsedData,
      report,
      recommendations,
      exporter
    };
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
    return null;
  }
}

/**
 * 测试解析器
 */
function testParser() {
  console.log('\n=== 测试解析器 ===\n');
  
  const html = document.documentElement.outerHTML;
  const parser = new TrainingPlanParser(html);
  const result = parser.parse();
  
  console.log('解析结果:', result);
  console.log('\n学生信息:', result.studentInfo);
  console.log('\n课程类型数量:', result.courseTypes.length);
  
  if (result.courseTypes.length > 0) {
    console.log('\n第一个课程类型:', result.courseTypes[0]);
    
    if (result.courseTypes[0].groups.length > 0) {
      console.log('\n第一个课程组:', result.courseTypes[0].groups[0]);
    }
  }
  
  return result;
}

/**
 * 测试分析器
 */
function testAnalyzer() {
  console.log('\n=== 测试分析器 ===\n');
  
  const html = document.documentElement.outerHTML;
  const parser = new TrainingPlanParser(html);
  const parsedData = parser.parse();
  
  const analyzer = new TrainingPlanAnalyzer(parsedData);
  const report = analyzer.generateReport();
  
  console.log('分析报告:', report);
  console.log('\n总体摘要:', report.summary);
  console.log('\n未完成课程组:', report.incompleteGroups);
  
  return report;
}

/**
 * 测试导出器
 */
function testExporter() {
  console.log('\n=== 测试导出器 ===\n');
  
  const html = document.documentElement.outerHTML;
  const parser = new TrainingPlanParser(html);
  const parsedData = parser.parse();
  
  const analyzer = new TrainingPlanAnalyzer(parsedData);
  const report = analyzer.generateReport();
  const recommendations = analyzer.generateRecommendations(report);
  
  const exporter = new TrainingPlanExporter(report, recommendations);
  
  console.log('=== 文本格式预览 ===\n');
  const text = exporter.exportToText();
  console.log(text.substring(0, 500) + '...\n');
  
  console.log('完整文本长度:', text.length);
  
  return exporter;
}

/**
 * 快速诊断
 */
function quickDiagnose() {
  console.log('\n=== 快速诊断 ===\n');
  
  // 检查页面
  console.log('1. 检查页面是否正确...');
  const hasTable = document.querySelector('table') !== null;
  const hasStudentInfo = document.body.textContent.includes('学号');
  const hasGroupInfo = document.body.textContent.includes('课组名');
  
  console.log(`  - 包含表格: ${hasTable ? '✓' : '✗'}`);
  console.log(`  - 包含学生信息: ${hasStudentInfo ? '✓' : '✗'}`);
  console.log(`  - 包含课组信息: ${hasGroupInfo ? '✓' : '✗'}`);
  
  if (!hasTable || !hasStudentInfo || !hasGroupInfo) {
    console.error('❌ 页面结构不正确，请确保在培养方案页面运行');
    return;
  }
  
  // 检查脚本加载
  console.log('\n2. 检查脚本加载...');
  console.log(`  - TrainingPlanParser: ${typeof TrainingPlanParser !== 'undefined' ? '✓' : '✗'}`);
  console.log(`  - TrainingPlanAnalyzer: ${typeof TrainingPlanAnalyzer !== 'undefined' ? '✓' : '✗'}`);
  console.log(`  - TrainingPlanExporter: ${typeof TrainingPlanExporter !== 'undefined' ? '✓' : '✗'}`);
  
  // 简单测试
  console.log('\n3. 简单解析测试...');
  try {
    const html = document.documentElement.outerHTML;
    const parser = new TrainingPlanParser(html);
    const studentInfo = parser.getStudentInfo();
    
    console.log('  学生信息:', studentInfo);
    
    if (studentInfo.studentId) {
      console.log('✓ 解析器工作正常');
    } else {
      console.warn('⚠️ 学号提取失败，可能需要调整解析逻辑');
    }
  } catch (error) {
    console.error('❌ 解析器出错:', error.message);
  }
  
  console.log('\n诊断完成！');
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          培养方案解析器 - 测试工具                          ║
╚════════════════════════════════════════════════════════════╝

【快速开始】
  testFullPipeline()     - 运行完整测试流程（推荐）
  quickDiagnose()        - 快速诊断问题

【分步测试】
  testParser()           - 仅测试解析器
  testAnalyzer()         - 仅测试分析器
  testExporter()         - 仅测试导出器

【实用功能】
  refreshTrainingPlan()  - 刷新培养方案数据
  
【导出报告】
  // 先运行完整测试
  const result = await testFullPipeline();
  
  // 然后导出
  result.exporter.exportAll();           // 导出所有格式
  result.exporter.download(...);         // 导出指定格式

【查看数据】
  // 查看解析后的原始数据
  const result = testParser();
  console.log(JSON.stringify(result, null, 2));
  
  // 查看分析报告
  const report = testAnalyzer();
  console.log(report);

════════════════════════════════════════════════════════════
  `);
}

// 导出函数
if (typeof window !== 'undefined') {
  window.testFullPipeline = testFullPipeline;
  window.testParser = testParser;
  window.testAnalyzer = testAnalyzer;
  window.testExporter = testExporter;
  window.quickDiagnose = quickDiagnose;
  window.showHelp = showHelp;
  
  // 自动显示帮助
  console.log('✓ 测试工具已加载');
  console.log('输入 showHelp() 查看使用说明');
  console.log('输入 testFullPipeline() 开始测试');
}