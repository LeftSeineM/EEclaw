// ===== 进度 Toast 工具 =====
function showToast(title, text, percent) {
  const toast = document.getElementById("progressToast");
  document.getElementById("progressToastTitle").textContent = title;
  document.getElementById("progressToastText").textContent = text;
  document.getElementById("progressToastBar").style.width = percent + "%";
  toast.style.display = "block";
}

function hideToast() {
  document.getElementById("progressToast").style.display = "none";
}

// ===== 触发下载 JSON 文件 =====
function downloadJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== 监听后台进度推送 =====
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "COURSE_SCHEDULE_PROGRESS_UPDATE") {
    const { current, total, status } = msg.data;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (status === "done") {
      showToast("✅ 开课信息抓取完成", "共 " + total + " 页，已全部完成", 100);
      setTimeout(hideToast, 3000);
    } else {
      showToast("🗓️ 正在抓取开课信息...", "第 " + current + " / " + total + " 页 (" + pct + "%)", pct);
    }
  }
});

// ===== 页面加载完成后绑定按钮事件 =====
document.addEventListener("DOMContentLoaded", () => {

  // ----- 抓取下学期推荐课 -----
  document.getElementById("fetchNextSemester").addEventListener("click", async () => {
    const btn = document.getElementById("fetchNextSemester");
    btn.disabled = true;
    showToast("📋 正在抓取推荐课列表...", "请稍候，正在打开选课系统...", 10);

    try {
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "FETCH_NEXT_SEMESTER_COURSES" }, resolve);
      });

      if (!result || !result.success) {
        showToast("❌ 抓取失败", (result && result.error) ? result.error : "未知错误", 0);
        setTimeout(hideToast, 4000);
        return;
      }

      showToast("✅ 推荐课列表已获取", "正在解析 HTML...", 80);

      // 解析 HTML，提取课程列表
      // 表格结构：学年(rowspan) + 学期(rowspan) + 课程号 + 课程名 + 属性 + 学分 + 课组
      // 由于 rowspan，第一行有 7 个 td，后续行只有 5 个 td
      // 需要根据列数动态判断偏移量
      const parser = new DOMParser();
      const doc = parser.parseFromString(result.html, "text/html");
      const rows = [];

      doc.querySelectorAll("table tr.trr2").forEach(tr => {
        const cells = tr.querySelectorAll("td");
        const getText = c => c ? c.textContent.trim().replace(/\s+/g, " ") : "";

        let offset;
        if (cells.length >= 7) {
          // 第一行：有学年、学期两列 rowspan，偏移 +2
          offset = 2;
        } else if (cells.length >= 5) {
          // 后续行：rowspan 已消耗，直接从 0 开始
          offset = 0;
        } else {
          return; // 列数不够，跳过
        }

        const courseId   = getText(cells[offset]);
        const courseName = getText(cells[offset + 1]);
        const type       = getText(cells[offset + 2]);
        const credits    = parseFloat(getText(cells[offset + 3])) || 0;
        const group      = getText(cells[offset + 4]);

        // 过滤掉无效行（课程号应为纯数字）
        if (!courseId || !/^\d+$/.test(courseId)) return;

        rows.push({ courseId, courseName, type, credits, group });
      });

      const output = {
        xnxq: "2025-2026-2",
        fetchTime: new Date().toISOString(),
        total: rows.length,
        courses: rows
      };

      downloadJSON(output, "next_semester_recommended_" + Date.now() + ".json");
      showToast("✅ 完成", "已下载 " + rows.length + " 门推荐课程", 100);
      setTimeout(hideToast, 3000);

    } catch (e) {
      showToast("❌ 出错", e.message, 0);
      setTimeout(hideToast, 4000);
    } finally {
      btn.disabled = false;
    }
  });

  // ----- 抓取全部开课信息 -----
  document.getElementById("fetchCourseSchedule").addEventListener("click", async () => {
    const btn = document.getElementById("fetchCourseSchedule");
    btn.disabled = true;
    showToast("🗓️ 开始抓取开课信息...", "正在登录选课系统，请稍候...", 2);

    try {
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "FETCH_ALL_COURSE_SCHEDULE" }, resolve);
      });

      if (!result || !result.success) {
        showToast("❌ 抓取失败", (result && result.error) ? result.error : "未知错误", 0);
        setTimeout(hideToast, 4000);
        return;
      }

      downloadJSON(result, "course_schedule_" + result.xnxq + "_" + Date.now() + ".json");
      showToast("✅ 全部完成", "已下载 " + result.total + " 条开课记录", 100);
      setTimeout(hideToast, 4000);

    } catch (e) {
      showToast("❌ 出错", e.message, 0);
      setTimeout(hideToast, 4000);
    } finally {
      btn.disabled = false;
    }
  });

});