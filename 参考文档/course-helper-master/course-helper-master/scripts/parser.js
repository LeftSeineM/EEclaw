/**
 * 培养方案HTML解析器 v3 (修复版)
 * 1. 增加 vpn_eval 代码清洗功能
 * 2. 采用指针步进法处理 rowspan，不依赖固定列号
 * 3. 自动识别课程组统计信息
 */

class TrainingPlanParser {
  constructor(html) {
    this.html = html;
    this.parser = new DOMParser();
    this.doc = this.parser.parseFromString(html, 'text/html');
  }

  /**
   * 清洗文本，移除 vpn_eval 等脚本干扰
   */
  cleanText(text) {
    if (!text) return '';
    let cleaned = text.trim();
    
    // 移除 vpn_eval((...)); 这种乱码
    if (cleaned.includes('vpn_eval')) {
      const parts = cleaned.split(');');
      if (parts.length > 1) {
        cleaned = parts[parts.length - 1];
      }
      cleaned = cleaned.replace(/[";)]/g, '').trim();
    }

    // 移除 truncdata("...", 数字) 这种乱码，真正的文本在括号后面
    // 格式: truncdata("课组名", 数字)课组名  → 取最后的数字)之后的内容
    if (cleaned.includes('truncdata')) {
      const m = cleaned.match(/truncdata\(.*?,\s*\d+\)([\s\S]*)/);
      if (m) cleaned = m[1].trim();
    }
    
    return cleaned;
  }

  /**
   * 提取学生基本信息
   */
  getStudentInfo() {
    try {
      const bodyText = this.doc.body.textContent;
      
      // 提取学号
      const studentIdMatch = bodyText.match(/学号[：:\s]*(\d+)/);
      const studentId = studentIdMatch ? studentIdMatch[1].trim() : '';
      
      // 提取姓名
      const nameMatch = bodyText.match(/姓名[：:\s]*([^\s&,]+)/);
      const name = nameMatch ? nameMatch[1].trim() : '';
      
      // 提取总学分
      const totalCreditsMatch = bodyText.match(/应完成总学分[：:\s]*(\d+)/);
      const totalCredits = totalCreditsMatch ? parseFloat(totalCreditsMatch[1]) : 0;

      const completedCreditsMatch = bodyText.match(/方案内实际完成总学分[：:\s]*([\d.]+)/);
      const completedCredits = completedCreditsMatch ? parseFloat(completedCreditsMatch[1]) : 0;

      return { studentId, name, totalCredits, completedCredits };
    } catch (e) {
      console.warn('提取学生信息失败:', e);
      return { studentId: '', name: '', totalCredits: 0, completedCredits: 0 };
    }
  }

  /**
   * 主解析逻辑
   */
  parse() {
    const table = this.findMainTable();
    if (!table) {
      console.error('未找到培养方案主表格');
      return { courseTypes: [], studentInfo: this.getStudentInfo() };
    }

    const rows = Array.from(table.querySelectorAll('tr'));
    const result = {
      studentInfo: this.getStudentInfo(),
      courseTypes: []
    };

    let currentType = null;
    let currentGroup = null;

    // 状态计数器：记录当前的 rowspan 还有多少行结束
    let typeRowsLeft = 0;
    let groupRowsLeft = 0;

    // 跳过表头，从数据行开始
    let startIndex = 0;
    for(let i=0; i<rows.length; i++) {
        if(rows[i].textContent.includes('课程属性') && rows[i].textContent.includes('课组名')) {
            startIndex = i + 1;
            break;
        }
    }

    console.log(`开始解析表格，数据行从第 ${startIndex} 行开始122`);
    const typenames=["必修","限选","任选"];
    const typenames_index = -1;
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      const cells = Array.from(row.cells);
      
      // 如果是一行空数据或者装饰行，跳过
      if (cells.length < 5) {
        continue;
      }

      let cellCursor = 0; // 当前行的列指针

      // === 1. 处理课程属性 (必修/限选/任选) ===
      if (typeRowsLeft === 0) {
        // 这一行应该包含课程属性
        if (cellCursor < cells.length) {
            const cell = cells[cellCursor];
            const typeName = this.cleanText(cell.textContent);
            const rowSpan = parseInt(cell.getAttribute('rowspan') || '1');
            // 只有当文本是有效的类型时才创建新类型
            if (typeName.includes('必修') || typeName.includes('限选') || typeName.includes('任选')) {
                currentType = {
                    name: typeName,
                    groups: [] // 重置课程组列表
                };
                result.courseTypes.push(currentType);
                typeRowsLeft = rowSpan;
                cellCursor++; // 指针后移，因为这一行消耗了第一列
            } else {
                // 可能是解析错位，或者这不是类型列
                // 假如上一行的 rowspan 算错了，这里做个容错：不后移指针
            }
        }
      }
      // 处理完当前行后，类型剩余行数 - 1
      typeRowsLeft = Math.max(0, typeRowsLeft - 1);


      // === 2. 处理课程组 (如 政治理论课) ===
      if (groupRowsLeft === 0) {
        // 这一行应该包含课程组名
        if (cellCursor < cells.length) {
            const cell = cells[cellCursor];
            const rawText = cell.textContent;
            const groupName = this.cleanText(rawText);
            const rowSpan = parseInt(cell.getAttribute('rowspan') || '1');

            // 创建新课组
            currentGroup = {
                name: groupName,
                courses: [],
                stats: null
            };
            
            if (currentType) {
                currentType.groups.push(currentGroup);
            }

            // === 提取课组统计信息 (位于行的末尾) ===
            // 根据你的描述，统计信息（应修学分等）在这一行的最后几列
            // 倒数第5列开始：应修学分 | 完成学分 | 应修门数 | 完成门数 | 是否完成
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
            cellCursor++; // 指针后移
        }
      }
      groupRowsLeft = Math.max(0, groupRowsLeft - 1);


      // === 3. 处理具体课程 ===
      // 此时 cellCursor 指向的应该是课程号
      // 课程结构通常是: 课程号 | 课程名 | 学分 | 成绩 | 绩点
      if (cellCursor + 4 < cells.length) {
          const courseId = this.cleanText(cells[cellCursor].textContent);
          const courseName = this.cleanText(cells[cellCursor + 1].textContent);
          const grade = this.cleanText(cells[cellCursor + 3].textContent);
          // 简单验证：课程号通常是数字或字母组合，长度较短
          if (courseId && courseName) {
              // 判断课程状态
              let status = 'unknown'; // 默认未知
              let isOutOfPlan = false;

              if (grade.includes('未修')) {
                  status = 'not_taken';
              } else if (grade.includes('选课')) {
                  status = 'completed';
              } else if (grade === 'W') {
                  status = 'withdrawn';
              } else if (grade === 'F') {
                  status = 'failed';
              } else if (grade === 'P' || grade.match(/^[A-D][+-]?$/)) {
                  // P(通过) 或 A/B/C/D 字母成绩 → 已完成
                  status = 'completed';
              } else if (grade && grade.trim() !== '') {
                  // 其他非空成绩（如数字成绩）也算完成
                  status = 'completed';
              }

              // 检查是否为蓝色字体（方案外课程）
              const nameCell = cells[cellCursor + 1];
              if (nameCell && nameCell.querySelector('font[color="#0000FF"]')) {
                  isOutOfPlan = true;
              }
              const course = {
                  courseId: courseId,
                  courseName: courseName,
                  credits: parseFloat(this.cleanText(cells[cellCursor + 2].textContent)) || 0,
                  grade: grade,
                  gpa: parseFloat(this.cleanText(cells[cellCursor + 4].textContent)) || 0,
                  status: status,           // ← 加上这行
                  isOutOfPlan: isOutOfPlan  // ← 加上这行
              };

              if (currentGroup) {
                  currentGroup.courses.push(course);
              }
          }
      }
    }

    let type_count = 0;
    for(const type of result.courseTypes){
      type.type=typenames[type_count];
      type_count++;
    }
    // ===== 重新统计课组完成学分 =====
    for (const type of result.courseTypes) {
      for (const group of type.groups) {
        let completedCredits = 0;
        let completedCourses = 0;

        for (const course of group.courses) {
          // 如果 status 是 completed，就算作已完成
          if (course.status === 'completed') {
            completedCredits += course.credits;
            completedCourses += 1;
          }
        }

        // 更新 group.stats
        if (group.stats) {
          group.stats.completedCredits = completedCredits;
          group.stats.completedCourses = completedCourses;
          group.stats.isCompleted = (completedCredits >= group.stats.requiredCredits);
        } else {
          group.stats = {
            requiredCredits: 0,
            completedCredits,
            requiredCourses: group.courses.length,
            completedCourses,
            isCompleted: completedCredits >= 0
          };
        }
      }
    }

    return result;
  }

  /**
   * 查找包含"课程属性"的主表格
   */
  findMainTable() {
    const tables = this.doc.querySelectorAll('table');
    for (const table of tables) {
      if (table.textContent.includes('课程属性') && 
          table.textContent.includes('课组名')) {
        return table;
      }
    }
    return null;
  }
}