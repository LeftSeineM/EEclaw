console.log("Course Helper background loaded (refactored version)");

chrome.tabs.onCreated.addListener(tab => {
  console.log("[GLOBAL] tab created:", tab.id, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") {
    console.log("[GLOBAL] tab updated:", tabId, tab.url);
  }
});

// =======================================================
// 全局状态管理
// =======================================================
let autoRefreshEnabled = false;
let autoRefreshIntervalMs = 500000;
let pluginInitiatedLogin = false;
let pendingRedirectTabId = null;

// =======================================================
// 点击插件图标
// =======================================================
chrome.action.onClicked.addListener(async () => {
  console.log("Course Helper: icon clicked");

  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html")
  });

  pluginInitiatedLogin = true;
  chrome.tabs.create({
    url: "http://zhjwxk.cic.tsinghua.edu.cn/xklogin.do",
  });
});

// =======================================================
// 登录跳转控制
// =======================================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== pendingRedirectTabId) return;
  if (changeInfo.status !== "complete") return;

  chrome.tabs.update(tabId, {
    url: "http://zhjwxk.cic.tsinghua.edu.cn/xklogin.do",
  });

  pluginInitiatedLogin = false;
  pendingRedirectTabId = null;
});

// =======================================================
// 消息中心
// =======================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === "FETCH_TRAINING_PLAN_HTML") {
    fetchTrainingPlanHTML().then(sendResponse);
    return true;
  }

  if (msg.type === "FETCH_NEXT_SEMESTER_COURSES") {
    fetchNextSemesterCourses().then(sendResponse);
    return true;
  }

  if (msg.type === "FETCH_ALL_COURSE_SCHEDULE") {
    fetchAllCourseSchedule(sender.tab?.id, msg.progressTabId).then(sendResponse);
    return true;
  }

  if (msg.type === "COURSE_SCHEDULE_PROGRESS") {
    // 转发进度给 dashboard
    chrome.runtime.sendMessage({ type: "COURSE_SCHEDULE_PROGRESS_UPDATE", data: msg.data });
    return false;
  }

  if (msg.type === "saveLoginProfile") {
    chrome.storage.local.set({ loginProfile: msg.data }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "loadLoginProfile") {
    chrome.storage.local.get(["loginProfile"], res => {
      sendResponse({ data: res.loginProfile || null });
    });
    return true;
  }
});

// =======================================================
// 点击「刷新培养方案完成情况」按钮
// =======================================================
async function clickRefreshButton(tabId) {
  console.log("[TP] trying to click refresh button");

  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      return new Promise(resolve => {
        const timer = setInterval(() => {
          const btn = Array.from(document.querySelectorAll('input[type="button"]'))
            .find(b => b.value.includes('刷新培养方案完成情况'));

          if (btn) {
            clearInterval(timer);
            btn.click();
            resolve(true);
          }
        }, 300);

        setTimeout(() => {
          clearInterval(timer);
          resolve(false);
        }, 10000);
      });
    }
  });
}

// =======================================================
// 等刷新完成 → 抓 HTML → 关 tab → resolve
// =======================================================
function extractHtmlAfterRefresh(eduTabId, learnTabId, resolve) {
  console.log("[TP] waiting for refresh completion");

  const onUpdated = (tid, info) => {
    if (tid !== eduTabId) return;
    if (info.status !== "complete") return;

    chrome.tabs.onUpdated.removeListener(onUpdated);

    console.log("[TP] refresh completed, extracting HTML");

    chrome.scripting.executeScript({
      target: { tabId: eduTabId },
      func: () => ({
        url: location.href,
        html: document.documentElement.outerHTML,
      }),
    }).then(res => {
      const data = res[0].result;

      chrome.tabs.remove(learnTabId);
      chrome.tabs.remove(eduTabId);

      resolve({
        success: true,
        url: data.url,
        html: data.html,
      });
    });
  };

  chrome.tabs.onUpdated.addListener(onUpdated);
}

// =======================================================
// 获取培养方案 HTML（完整流程）
// =======================================================
async function fetchTrainingPlanHTML() {
  console.log("=== Fetch Training Plan HTML ===");

  return new Promise(resolve => {

    chrome.tabs.create(
      { url: "https://learn.tsinghua.edu.cn/f/login", active: false },
      learnTab => {

        const learnTabId = learnTab.id;

        const onLearnUpdated = (tabId, info) => {
          if (tabId !== learnTabId || info.status !== "complete") return;

          chrome.scripting.executeScript({
            target: { tabId: learnTabId },
            func: () => location.href,
          }).then(([res]) => {

            const url = res.result;

            // 登录页
            if (url.includes("/f/login")) {
              chrome.scripting.executeScript({
                target: { tabId: learnTabId },
                func: () => {
                  const btn = document.getElementById("loginButtonId");
                  if (btn) btn.click();
                },
              });
              return;
            }

            if (!url.startsWith("https://learn.tsinghua.edu.cn/")) return;

            chrome.tabs.onUpdated.removeListener(onLearnUpdated);

            // 点击培养方案入口
            chrome.scripting.executeScript({
              target: { tabId: learnTabId },
              func: () => {
                const link = Array.from(document.querySelectorAll("a"))
                  .find(a =>
                    a.textContent.includes("培养方案完成情况") &&
                    a.getAttribute("onclick")?.includes("tiaozhuan")
                  );
                if (link) link.click();
              }
            });

            // 监听教务 tab
            const onEduCreated = tab => {

              const eduTabId = tab.id;

              const onEduUpdated = async (tid, info, updatedTab) => {
                if (tid !== eduTabId) return;
                if (!updatedTab.url?.includes("jhBks.by_fascjgmxb_gr.do")) return;
                if (info.status !== "complete") return;

                chrome.tabs.onUpdated.removeListener(onEduUpdated);
                chrome.tabs.onCreated.removeListener(onEduCreated);

                console.log("[TP] edu page loaded");

                // ① 先监听刷新完成
                extractHtmlAfterRefresh(eduTabId, learnTabId, resolve);

                // ② 再点击刷新按钮
                await clickRefreshButton(eduTabId);
              };

              chrome.tabs.onUpdated.addListener(onEduUpdated);
            };

            chrome.tabs.onCreated.addListener(onEduCreated);
          });
        };

        chrome.tabs.onUpdated.addListener(onLearnUpdated);
      }
    );
  });
}

// =======================================================
// 工具：在指定 tab 等待页面加载完成后执行脚本
// =======================================================
function waitForTabComplete(tabId) {
  return new Promise(resolve => {
    const listener = (tid, info) => {
      if (tid !== tabId || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      // 多等 300ms 让 JS 渲染完成
      setTimeout(resolve, 300);
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}


// =======================================================
// 工具：轮询等待页面上的当前页码变为目标页（用于 form.submit 翻页）
// =======================================================
function waitForPageNumber(tabId, targetPage, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const poll = async () => {
      if (Date.now() - start > timeoutMs) {
        console.warn("[XK] waitForPageNumber timeout waiting for page " + targetPage);
        resolve(); // 超时不报错，直接继续
        return;
      }

      try {
        const res = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const input = document.querySelector('input[name="goPageNumber"]');
            if (input) return parseInt(input.value) || 0;
            const text = document.querySelector("p.yeM") ? document.querySelector("p.yeM").textContent : "";
            const m = text.match(/第\s*(\d+)\s*页/);
            return m ? parseInt(m[1]) : 0;
          }
        });

        const currentPage = res[0] && res[0].result ? res[0].result : 0;
        if (currentPage === targetPage) {
          setTimeout(resolve, 200);
        } else {
          setTimeout(poll, 300);
        }
      } catch (e) {
        setTimeout(poll, 300);
      }
    };

    poll();
  });
}

// =======================================================
// 工具：确保选课系统已登录（打开选课登录页等待跳转）
// =======================================================
async function findExistingXkTab() {
  // 找已打开的、已登录的选课系统 tab（不是登录页）
  const tabs = await chrome.tabs.query({});
  const xkTab = tabs.find(t => {
    const url = t.url || "";
    return url.includes("zhjwxk.cic.tsinghua.edu.cn") && !url.includes("xklogin.do");
  });
  return xkTab ? xkTab.id : null;
}

// =======================================================
// 抓取下学期培养方案推荐课程列表
// =======================================================
async function fetchNextSemesterCourses() {
  console.log("=== Fetch Next Semester Courses ===");

  const xnxq = "2025-2026-2";
  const url = `http://zhjwxk.cic.tsinghua.edu.cn/jhBks.vjhBksPyfakcbBs.do?m=showBksZxZdxjxjhXmxqkclist&p_xnxq=${xnxq}`;

  // 新开 tab 访问目标页面
  return new Promise(resolve => {
    chrome.tabs.create({ url, active: false }, async newTab => {
      const newTabId = newTab.id;
      await waitForTabComplete(newTabId);

      try {
        const res = await chrome.scripting.executeScript({
          target: { tabId: newTabId },
          func: () => ({
            url: location.href,
            html: document.documentElement.outerHTML,
          }),
        });

        const data = res[0].result;
        chrome.tabs.remove(newTabId);

        resolve({
          success: true,
          url: data.url,
          html: data.html,
        });
      } catch (e) {
        chrome.tabs.remove(newTabId).catch(() => {});
        resolve({ success: false, error: e.message });
      }
    });
  });
}

// =======================================================
// 抓取所有开课信息（多页）
// =======================================================
async function fetchAllCourseSchedule(fromTabId, progressTabId) {
  console.log("=== Fetch All Course Schedule ===");

  const xnxq = "2025-2026-2";
  const postUrl = "http://zhjwxk.cic.tsinghua.edu.cn/xkBks.vxkBksJxjhBs.do";

  // 发送进度更新给 dashboard
  function sendProgress(current, total, status) {
    chrome.runtime.sendMessage({
      type: "COURSE_SCHEDULE_PROGRESS_UPDATE",
      data: { current, total, status }
    }).catch(() => {}); // dashboard 可能已关闭，忽略错误
  }

  // 实时查找选课系统的 tab（每次调用都重新查，不缓存）
  const tabs = await chrome.tabs.query({});
  const xkTab = tabs.find(t => (t.url || "").includes("zhjwxk.cic.tsinghua.edu.cn") && !(t.url || "").includes("xklogin.do"));
  if (!xkTab) {
    return { success: false, error: "未找到已登录的选课系统，请先手动打开并登录 zhjwxk.cic.tsinghua.edu.cn" };
  }
  const workerTabId = xkTab.id;
  console.log("[XK] 使用 tab:", workerTabId, xkTab.url);

  // 在新 tab 里用同步 XHR 发 POST
  // 第一页：获取 HTML、token、总页数
  const firstPageRes = await chrome.scripting.executeScript({
    target: { tabId: workerTabId },
    func: (url, xnxq) => {
      try {
        const body = "m=kkxxSearch&page=1&p_xnxq=" + xnxq +
          "&pathContent=&showtitle=&p_kch=&p_kcm=&p_zjjsxm=&p_kkdwnm=" +
          "&p_kcflm=&p_skxq=&p_skjc=&p_xkwzsm=&p_rxklxm=&p_kctsm=&p_ssnj=" +
          "&p_bkskyl_ig=&p_yjskyl_ig=&goPageNumber=1" +
          "&p_sort.p1=&p_sort.p2=&p_sort.asc1=true&p_sort.asc2=true";
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, false);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.withCredentials = true;
        xhr.send(body);
        const html = xhr.responseText;
        const tokenMatch = html.match(/name="token"[^>]*value="([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : "";
        const endpageMatch = html.match(/href='javascript:turn\((\d+)\);'\s+id="endpage"/);
        const totalPages = endpageMatch ? parseInt(endpageMatch[1]) : null;
        const countMatch = html.match(/共\s*([\d,]+)\s*条记录/);
        const totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, "")) : null;
        // 在 tab 里直接解析 HTML（background service worker 没有 DOMParser）
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = [];
        doc.querySelectorAll("table tr.trr2").forEach(tr => {
          const cells = tr.querySelectorAll("td");
          if (cells.length < 11) return;
          const g = c => c ? c.textContent.trim().replace(/\s+/g, " ") : "";
          const features = [];
          (cells[12] ? cells[12].textContent : "").split(";").forEach(f => { f = f.trim(); if (f) features.push(f); });
          rows.push({
            department: g(cells[0]), courseId: g(cells[1]), courseSeq: g(cells[2]),
            courseName: g(cells[3]), credits: parseFloat(g(cells[4])) || 0,
            teacher: g(cells[5]), bkCapacity: parseInt(g(cells[6])) || 0,
            bkRemaining: parseInt(g(cells[7])) || 0, yjsCapacity: parseInt(g(cells[8])) || 0,
            yjsRemaining: parseInt(g(cells[9])) || 0, schedule: g(cells[10]),
            notes: g(cells[11]), features: features, grade: g(cells[13]),
            isSecondLevel: g(cells[14]), repeatFillsCapacity: g(cells[16]),
            hasTimeLimit: g(cells[17]), generalGroup: g(cells[18]),
          });
        });
        return { ok: true, rows, token, totalPages, totalCount };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    args: [postUrl, xnxq]
  });

  const firstPage = firstPageRes[0] && firstPageRes[0].result;
  if (!firstPage || !firstPage.ok) {
    return { success: false, error: (firstPage && firstPage.error) || "第一页请求失败" };
  }
  if (!firstPage.totalPages) {
    return { success: false, error: "无法获取总页数，请确认已登录选课系统" };
  }

  const totalPages = firstPage.totalPages;
  const totalCount = firstPage.totalCount;
  let currentToken = firstPage.token;
  console.log("[XK] 共 " + totalPages + " 页，" + totalCount + " 条记录");
  sendProgress(1, totalPages, "running");

  const allRows = [];
  allRows.push(...firstPage.rows);

  // 逐页同步 XHR，每页从响应里取新 token
  for (let page = 2; page <= totalPages; page++) {
    sendProgress(page, totalPages, "running");

    const pageRes = await chrome.scripting.executeScript({
      target: { tabId: workerTabId },
      func: (url, xnxq, page, token) => {
        try {
          const body = "m=kkxxSearch&page=" + page + "&token=" + token +
            "&p_xnxq=" + xnxq +
            "&pathContent=&showtitle=&p_kch=&p_kcm=&p_zjjsxm=&p_kkdwnm=" +
            "&p_kcflm=&p_skxq=&p_skjc=&p_xkwzsm=&p_rxklxm=&p_kctsm=&p_ssnj=" +
            "&p_bkskyl_ig=&p_yjskyl_ig=&goPageNumber=" + page +
            "&p_sort.p1=&p_sort.p2=&p_sort.asc1=true&p_sort.asc2=true";
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url, false);
          xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
          xhr.withCredentials = true;
          xhr.send(body);
          const html = xhr.responseText;
          const tokenMatch = html.match(/name="token"[^>]*value="([^"]+)"/);
          const nextToken = tokenMatch ? tokenMatch[1] : token;
          // 在 tab 里直接解析
          const doc = new DOMParser().parseFromString(html, "text/html");
          const rows = [];
          doc.querySelectorAll("table tr.trr2").forEach(tr => {
            const cells = tr.querySelectorAll("td");
            if (cells.length < 11) return;
            const g = c => c ? c.textContent.trim().replace(/\s+/g, " ") : "";
            const features = [];
            (cells[12] ? cells[12].textContent : "").split(";").forEach(f => { f = f.trim(); if (f) features.push(f); });
            rows.push({
              department: g(cells[0]), courseId: g(cells[1]), courseSeq: g(cells[2]),
              courseName: g(cells[3]), credits: parseFloat(g(cells[4])) || 0,
              teacher: g(cells[5]), bkCapacity: parseInt(g(cells[6])) || 0,
              bkRemaining: parseInt(g(cells[7])) || 0, yjsCapacity: parseInt(g(cells[8])) || 0,
              yjsRemaining: parseInt(g(cells[9])) || 0, schedule: g(cells[10]),
              notes: g(cells[11]), features: features, grade: g(cells[13]),
              isSecondLevel: g(cells[14]), repeatFillsCapacity: g(cells[16]),
              hasTimeLimit: g(cells[17]), generalGroup: g(cells[18]),
            });
          });
          return { ok: true, rows, nextToken };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      args: [postUrl, xnxq, page, currentToken]
    });

    const pageResult = pageRes[0] && pageRes[0].result;
    if (!pageResult || !pageResult.ok) {
      console.warn("[XK] 第 " + page + " 页失败，跳过");
      continue;
    }

    currentToken = pageResult.nextToken;
    allRows.push(...pageResult.rows);
    console.log("[XK] 第 " + page + "/" + totalPages + " 页，本页 " + pageResult.rows.length + " 条");
  }

  sendProgress(totalPages, totalPages, "done");
  console.log("[XK] 全部完成，共 " + allRows.length + " 条");

  return {
    success: true,
    total: allRows.length,
    data: allRows,
    xnxq,
    fetchTime: new Date().toISOString()
  };
}


// =======================================================
// 从 HTML 字符串解析开课数据行（在 background service worker 里运行）
// =======================================================
function parseScheduleHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [];

  doc.querySelectorAll("table tr.trr2").forEach(tr => {
    const cells = tr.querySelectorAll("td");
    if (cells.length < 11) return;

    const getText = (cell) => cell ? cell.textContent.trim().replace(/\s+/g, " ") : "";

    const features = [];
    const featureCell = cells[12];
    if (featureCell) {
      featureCell.textContent.split(";").forEach(f => {
        const t = f.trim();
        if (t) features.push(t);
      });
    }

    rows.push({
      department:          getText(cells[0]),
      courseId:            getText(cells[1]),
      courseSeq:           getText(cells[2]),
      courseName:          getText(cells[3]),
      credits:             parseFloat(getText(cells[4])) || 0,
      teacher:             getText(cells[5]),
      bkCapacity:          parseInt(getText(cells[6])) || 0,
      bkRemaining:         parseInt(getText(cells[7])) || 0,
      yjsCapacity:         parseInt(getText(cells[8])) || 0,
      yjsRemaining:        parseInt(getText(cells[9])) || 0,
      schedule:            getText(cells[10]),
      notes:               getText(cells[11]),
      features:            features,
      grade:               getText(cells[13]),
      isSecondLevel:       getText(cells[14]),
      repeatFillsCapacity: getText(cells[16]),
      hasTimeLimit:        getText(cells[17]),
      generalGroup:        getText(cells[18]),
    });
  });

  return rows;
}