/**
 * 清华大学网络学堂爬虫
 * 抓取课程、公告、作业，使用已登录 Session
 * 直接使用 auth 模块的 cookie，与登录状态保持一致
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE = 'https://learn.tsinghua.edu.cn';
const DATA_FILE = 'learn-data.json';

function getAuthStorePath() {
  const storageConfig = require('./storageConfig');
  return path.join(storageConfig.getDataBasePath(), 'auth-session.json');
}

function getCookieHeader() {
  const auth = require('./auth');
  let header = auth.getCookieHeaderForCrawler();
  if (header) return header;
  // 备用：直接读取 auth-session.json（与 auth 模块同源）
  try {
    const data = JSON.parse(fs.readFileSync(getAuthStorePath(), 'utf8'));
    const cookies = data?.cookies || [];
    if (cookies.length) {
      return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
  } catch (_) {}
  return null;
}

function request(method, urlPath, postData = null) {
  return new Promise((resolve, reject) => {
    const cookieHeader = getCookieHeader();
    if (!cookieHeader) {
      reject(new Error('SESSION_EXPIRED'));
      return;
    }

    const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
    const auth = require('./auth');
    const xsrf = auth.getXsrfToken?.();
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Cookie: cookieHeader,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + '/',
      Origin: BASE
    };
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method, headers };

    if (postData) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error('SESSION_EXPIRED'));
          return;
        }
        if (res.statusCode === 302 && res.headers.location && res.headers.location.includes('/f/login')) {
          reject(new Error('SESSION_EXPIRED'));
          return;
        }
        const looksLikeLoginPage =
          typeof body === 'string' &&
          (body.includes('请登录') || body.includes('未登录') || body.includes('会话已过期') || body.startsWith('<!'));
        if (looksLikeLoginPage && body.length < 5000) {
          reject(new Error('SESSION_EXPIRED'));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function get(path) {
  return request('GET', path);
}

function post(path, data) {
  const body = typeof data === 'string' ? data : new URLSearchParams(data).toString();
  return request('POST', path, body);
}

function getDataStorePath() {
  const storageConfig = require('./storageConfig');
  return path.join(storageConfig.getDataBasePath(), DATA_FILE);
}

function saveData(data) {
  fs.writeFileSync(getDataStorePath(), JSON.stringify(data, null, 2), 'utf8');
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(getDataStorePath(), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 获取当前学期（及下一学期，若有）
 */
async function getCurrentSemester() {
  const res = await get('/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester');
  const r = res?.result;
  return r?.xnxq ?? r?.id ?? null;
}

function getCurrentAndNextSemesterIds(res) {
  const r = res?.result;
  if (!r) return [];
  const ids = [];
  if (r.xnxq) ids.push(r.xnxq);
  if (r.id && !ids.includes(r.id)) ids.push(r.id);
  if (r.xxq) ids.push(r.xxq);
  if (r.nextXnxq && !ids.includes(r.nextXnxq)) ids.push(r.nextXnxq);
  return ids.filter(Boolean);
}

/**
 * 获取学期列表（网络学堂顶部切换学期用）
 * API: /b/wlxt/kc/v_wlkc_xs_xktjb_coassb/queryxnxq
 * 可能返回直接数组或 {result/object/list: [...]}
 */
async function getSemesterList() {
  try {
    const res = await get('/b/wlxt/kc/v_wlkc_xs_xktjb_coassb/queryxnxq');
    let arr = [];
    if (Array.isArray(res)) arr = res;
    else if (res?.result) arr = Array.isArray(res.result) ? res.result : [res.result];
    else if (res?.object) arr = Array.isArray(res.object) ? res.object : [res.object];
    else if (res?.list) arr = Array.isArray(res.list) ? res.list : [res.list];
    else if (res?.xnxq) arr = Array.isArray(res.xnxq) ? res.xnxq : [res.xnxq];
    const list = arr.filter((s) => s != null && String(s).trim());
    if (list.length) return list;
    const cur = await getCurrentSemester();
    return cur ? [cur] : [];
  } catch {
    try {
      const cur = await getCurrentSemester();
      return cur ? [cur] : [];
    } catch {
      return [];
    }
  }
}

/**
 * 获取课程列表（当前学期）
 */
async function getCourses(semesterId = null) {
  let semester = semesterId;
  if (!semester) {
    semester = await getCurrentSemester();
    if (!semester) throw new Error('SESSION_EXPIRED');
  }

  const res = await get(`/b/wlxt/kc/v_wlkc_xs_xkb_kcb_extend/student/loadCourseBySemesterId/${semester}/zh`);
  const list = res?.resultList || [];
  return list.filter(Boolean).map((c) => ({
    wlkcid: c.wlkcid,
    kcm: c.kcm,
    jsm: c.jsm,
    xnxq: c.xnxq || semester,
    skdd: c.skdd,
    sksj: c.sksj,
    skddxx: c.skddxx || c.skddxxStr
  }));
}

/**
 * 从 HTML 中解析上课时间地点（参考 Learn-Helper / 网络学堂页面结构）
 * 格式：<div class="classroom"><p title="第1-16周星期二第2节，五教5102"><span>...</span></p></div>
 */
function parseTimeLocationFromHtml(html) {
  if (!html || typeof html !== 'string') return null;
  // 匹配 title="第1-16周星期二第2节，五教5102" 或 span 内文本
  const titleMatch = html.match(/title\s*=\s*["']([^"']+)["']/);
  if (titleMatch) return titleMatch[1].trim();
  const spanMatch = html.match(/<span[^>]*>([^<]+)<\/span>/);
  if (spanMatch) return spanMatch[1].trim();
  return null;
}

/**
 * 获取课程上课时间地点（thu-learn-lib 专用 API）
 * API: /b/kc/v_wlkc_xk_sjddb/detail?id=wlkcid
 * 返回格式可能是数组或对象，每项含 sksjdd/skdd/sksj 或为字符串
 */
async function getCourseTimeLocation(wlkcid) {
  try {
    const res = await get(`/b/kc/v_wlkc_xk_sjddb/detail?id=${wlkcid}`);
    const toStr = (r) => (typeof r === 'string' ? r : (r?.sksjdd ?? r?.skdd ?? r?.sksj ?? r?.sksjddStr ?? ''));
    let arr = [];
    if (Array.isArray(res)) arr = res;
    else if (res?.object) arr = Array.isArray(res.object) ? res.object : [res.object];
    else if (res?.result) arr = Array.isArray(res.result) ? res.result : [res.result];
    else if (res?.list) arr = Array.isArray(res.list) ? res.list : [res.list];
    if (arr.length) {
      const parts = arr.map(toStr).filter(Boolean);
      return parts.length ? parts.join('；') : null;
    }
  } catch {}
  return null;
}

/**
 * 获取课程详情（含上课时间地点）
 * 优先使用 v_wlkc_xk_sjddb 时间地点 API，再尝试 loadCourseByWlkcid
 */
async function getCourseDetail(wlkcid) {
  let skdd = '';
  let sksj = '';
  let skddxx = '';

  // 1. 专用时间地点 API（thu-learn-lib 使用）
  try {
    const timeLoc = await getCourseTimeLocation(wlkcid);
    if (timeLoc) skddxx = timeLoc;
  } catch {}

  // 2. 若仍无，尝试课程详情 API
  if (!skddxx) {
    const apis = [
      `/b/wlxt/kc/v_wlkc_xs_xkb_kcb_extend/student/loadCourseByWlkcid/${wlkcid}/zh`,
      `/b/wlxt/kc/v_wlkc_xs_xkb_kcb_extend/student/getCourseByWlkcid/${wlkcid}`
    ];
    for (const p of apis) {
      try {
        const res = await get(p);
        const c = res?.result ?? res?.object ?? res?.resultList?.[0];
        if (c && (c.wlkcid || c.kcm)) {
          skdd = c.skdd || '';
          sksj = c.sksj || '';
          skddxx = skddxx || c.skddxx || c.skddxxStr || '';
          if (!skddxx && c.kcxx) {
            const parsed = parseTimeLocationFromHtml(c.kcxx);
            if (parsed) skddxx = parsed;
          }
          break;
        }
      } catch {}
    }
  }

  if (skddxx || skdd || sksj) {
    return { wlkcid, skdd, sksj, skddxx: skddxx || null };
  }
  return null;
}

/**
 * 获取课程文件分类列表
 * API 返回 object.rows，每项含 kjflid 或 id、bt（标题）
 */
async function getCourseFiles(wlkcid) {
  try {
    const res = await get(`/b/wlxt/kj/wlkc_kjflb/student/pageList?wlkcid=${wlkcid}`);
    const obj = res?.object;
    const rows = obj?.rows ?? obj?.aaData ?? obj?.resultsList ?? [];
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({ id: r.kjflid ?? r.id, bt: r.bt ?? r.title ?? '' }));
  } catch {
    return [];
  }
}

/**
 * 获取课程某分类下的文件列表（含下载链接）
 * API 可能返回数组的数组（f[1]=标题, f[7]=wjid, f[9]=大小）或对象数组
 * 下载链接格式：downloadFile?sfgk=0&wjid=xxx（thu-learn-lib）
 */
async function getCourseFileList(wlkcid, flid) {
  try {
    const res = await get(`/b/wlxt/kj/wlkc_kjxxb/student/kjxxb/${wlkcid}/${flid}`);
    const list = res?.object ?? res?.result ?? [];
    const arr = Array.isArray(list) ? list : [];
    const BASE = 'https://learn.tsinghua.edu.cn';

    return arr.map((f) => {
      const isArrayItem = Array.isArray(f);
      const wjid = isArrayItem ? f[7] : (f.wjid ?? f.id ?? f.kjxxid ?? f.fileId);
      const name = isArrayItem ? (f[1] ?? '') : (f.wjmc ?? f.name ?? f.bt ?? '');
      const size = isArrayItem ? (f[9] ?? '') : (f.wjdx ?? f.size ?? '');
      const downloadUrl =
        (isArrayItem ? null : (f.wjdz ?? f.downloadUrl ?? f.url)) ||
        (wjid ? `${BASE}/b/wlxt/kj/wlkc_kjxxb/student/downloadFile?sfgk=0&wjid=${wjid}` : null);
      const previewUrl = wjid
        ? `${BASE}/f/wlxt/kc/wj_wjb/student/beforePlay?wjid=${wjid}&mk=mk_kcwj&browser=-1&sfgk=0&pageType=first`
        : null;

      return {
        id: isArrayItem ? f[0] : (f.id ?? f.kjxxid),
        wjid,
        wjmc: name,
        wjdx: size,
        downloadUrl,
        previewUrl,
        ...(typeof f === 'object' && !Array.isArray(f) ? f : {})
      };
    });
  } catch {
    return [];
  }
}

/**
 * 获取课程公告
 */
async function getNotices(wlkcid) {
  const aoData = JSON.stringify([
    { name: 'sEcho', value: 1 },
    { name: 'iColumns', value: 3 },
    { name: 'iDisplayStart', value: 0 },
    { name: 'iDisplayLength', value: -1 },
    { name: 'wlkcid', value: wlkcid }
  ]);
  const res = await post('/b/wlxt/kcgg/wlkc_ggb/student/pageListXs', `aoData=${encodeURIComponent(aoData)}`);
  const obj = res?.object;
  if (!obj) return [];
  return (obj.aaData || []).map((n) => ({
    ggid: n.ggid,
    bt: n.bt,
    fbr: n.fbr,
    fbsj: n.fbsjStr || n.fbsj,
    ggnrStr: n.ggnrStr,
    wlkcid: n.wlkcid
  }));
}

/**
 * 获取作业列表（含未提交、已交未改、已批改）
 */
async function getHomework(wlkcid) {
  const aoData = JSON.stringify([
    { name: 'sEcho', value: 1 },
    { name: 'iColumns', value: 8 },
    { name: 'iDisplayStart', value: 0 },
    { name: 'iDisplayLength', value: -1 },
    { name: 'wlkcid', value: wlkcid }
  ]);
  const body = `aoData=${encodeURIComponent(aoData)}`;

  const types = ['zyListWj', 'zyListYjwg', 'zyListYpg'];
  const statusMap = { zyListWj: '未提交', zyListYjwg: '已交未改', zyListYpg: '已批改' };
  const all = [];

  for (const t of types) {
    try {
      const res = await post(`/b/wlxt/kczy/zy/student/${t}`, body);
      const list = res?.object?.aaData || [];
      for (const h of list) {
        all.push({
          zyid: h.zyid,
          xszyid: h.xszyid,
          bt: h.bt,
          wlkcid: h.wlkcid,
          kssj: h.kssj,
          jzsj: h.jzsj,
          zywcfs: h.zywcfs,
          status: statusMap[t],
          isUnsubmitted: t === 'zyListWj'
        });
      }
    } catch {}
  }
  return all;
}

/**
 * 获取公告详情（按需拉取完整内容，列表中的 ggnrStr 可能被截断）
 */
async function getNoticeDetail(wlkcid, ggid) {
  try {
    const res = await get(`/b/wlxt/kcgg/wlkc_ggb/student/viewXs?wlkcid=${encodeURIComponent(wlkcid)}&id=${encodeURIComponent(ggid)}`);
    const obj = res?.object ?? res;
    return {
      bt: obj?.bt ?? '',
      fbr: obj?.fbr ?? '',
      fbsj: obj?.fbsjStr ?? obj?.fbsj ?? '',
      ggnrStr: obj?.ggnrStr ?? obj?.ggnr ?? ''
    };
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') throw e;
    return null;
  }
}

/**
 * 获取作业详情（题目要求、提交说明等）
 */
async function getHomeworkDetail(wlkcid, xszyid) {
  try {
    const res = await post('/b/wlxt/kczy/zy/student/detail', `id=${encodeURIComponent(xszyid)}`);
    const obj = res?.object ?? res;
    return {
      bt: obj?.bt ?? '',
      zynr: obj?.zynr ?? obj?.zytx ?? '', // 作业内容/题目要求
      kssj: obj?.kssj ?? '',
      jzsj: obj?.jzsj ?? '',
      zywcfs: obj?.zywcfs ?? ''
    };
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') throw e;
    return null;
  }
}

/**
 * Learn-Helper 风格：合并旧状态，检测新内容（推送逻辑）
 * 若公告/作业的发布时间与上次相同则保持已读，否则标记为未读
 */
function mergeContentState(oldData, newNotices, newHomework) {
  const state = oldData?.contentState || {};
  const noticeSeen = state.noticeSeen || {};
  const homeworkSeen = state.homeworkSeen || {};

  const notices = newNotices.map((n) => {
    const key = n.ggid || n.bt;
    const lastSeen = noticeSeen[key];
    const dateStr = n.fbsj || '';
    const hasRead = lastSeen === dateStr;
    return { ...n, hasRead, _dateKey: dateStr };
  });

  const homework = newHomework.map((h) => {
    const key = h.zyid || h.xszyid || h.bt;
    const lastSeen = homeworkSeen[key];
    const dateStr = h.jzsj || h.kssj || '';
    const hasRead = lastSeen === dateStr;
    return { ...h, hasRead, _dateKey: dateStr };
  });

  // 更新 contentState：记录本次看到的所有条目的日期，供下次比较
  const nextNoticeSeen = {};
  const nextHomeworkSeen = {};
  notices.forEach((n) => {
    nextNoticeSeen[n.ggid || n.bt] = n._dateKey;
  });
  homework.forEach((h) => {
    nextHomeworkSeen[h.zyid || h.xszyid || h.bt] = h._dateKey;
  });

  return {
    notices: notices.map(({ _dateKey, ...r }) => r),
    homework: homework.map(({ _dateKey, ...r }) => r),
    contentState: { noticeSeen: nextNoticeSeen, homeworkSeen: nextHomeworkSeen }
  };
}

/**
 * 抓取全部数据
 * @param {string} [semesterId] 指定学期 ID，不传则用当前学期
 */
async function fetchAll(semesterId = null) {
  const auth = require('./auth');
  // 若无 learn 会话但有保存的凭据，尝试按需登录
  if (!auth.hasValidLearnSession() && auth.hasCredentials()) {
    const cred = auth.loadCredentials();
    const loginResult = await auth.ensureLoginToLearn(cred);
    if (!loginResult.success) {
      return { success: false, error: 'SESSION_EXPIRED', message: loginResult.error || '请先登录网络学堂' };
    }
  }
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) {
    return { success: false, error: 'SESSION_EXPIRED', message: '请先登录网络学堂' };
  }
  try {
    await auth.restoreAuthToSession(auth.getSessionForCrawler());
  } catch (_) {}

  try {
    const [rawList, currentSemRes] = await Promise.all([
      getSemesterList(),
      get('/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester')
    ]);
    const currentSem = currentSemRes?.result?.xnxq ?? currentSemRes?.result?.id ?? null;
    const semester = semesterId || currentSem;
    if (!semester) throw new Error('SESSION_EXPIRED');
    const fromCurrentApi = getCurrentAndNextSemesterIds(currentSemRes);
    const semesterList = [...new Set([...fromCurrentApi, currentSem, ...rawList].filter(Boolean))];
    let courses = await getCourses(semester);
    await Promise.all(
      courses.map(async (c) => {
        if (c.skddxx) return;
        try {
          const timeLoc = await getCourseTimeLocation(c.wlkcid);
          if (timeLoc) {
            c.skddxx = timeLoc;
            return;
          }
          const d = await getCourseDetail(c.wlkcid);
          if (d) {
            if (d.skdd) c.skdd = d.skdd;
            if (d.sksj) c.sksj = d.sksj;
            if (d.skddxx) c.skddxx = d.skddxx;
          }
        } catch {}
      })
    );

    const notices = [];
    const homework = [];

    for (const c of courses) {
      try {
        const [nList, hList] = await Promise.all([getNotices(c.wlkcid), getHomework(c.wlkcid)]);
        notices.push(...nList.map((n) => ({ ...n, courseName: c.kcm })));
        homework.push(...hList.map((h) => ({ ...h, courseName: c.kcm })));
      } catch (e) {
        if (e.message === 'SESSION_EXPIRED') throw e;
      }
    }

    const oldData = loadData();
    const { notices: mergedNotices, homework: mergedHomework, contentState } = mergeContentState(
      oldData,
      notices,
      homework
    );

    const unsubmittedHomework = mergedHomework.filter((h) => h.isUnsubmitted);
    const newCount = mergedNotices.filter((n) => !n.hasRead).length + mergedHomework.filter((h) => !h.hasRead).length;

    const BASE = 'https://learn.tsinghua.edu.cn';
    const noticesWithUrl = mergedNotices.map((n) => ({
      ...n,
      detailUrl: n.wlkcid && n.ggid
        ? `${BASE}/f/wlxt/kcgg/wlkc_ggb/student/beforeViewXs?wlkcid=${n.wlkcid}&id=${n.ggid}`
        : null
    }));
    const homeworkWithUrl = mergedHomework.map((h) => ({
      ...h,
      submitUrl: h.wlkcid && h.xszyid
        ? `${BASE}/f/wlxt/kczy/zy/student/tijiao?wlkcid=${h.wlkcid}&xszyid=${h.xszyid}`
        : null,
      detailUrl: h.wlkcid && h.xszyid
        ? h.isUnsubmitted
          ? `${BASE}/f/wlxt/kczy/zy/student/tijiao?wlkcid=${h.wlkcid}&xszyid=${h.xszyid}`
          : `${BASE}/f/wlxt/kczy/zy/student/viewCj?wlkcid=${h.wlkcid}&xszyid=${h.xszyid}`
        : null
    }));

    const data = {
      fetchedAt: Date.now(),
      semester,
      semesters: semesterList.length ? semesterList : [semester],
      courses,
      notices: noticesWithUrl.sort((a, b) => String(b.fbsj || '').localeCompare(String(a.fbsj || ''))),
      homework: homeworkWithUrl.sort((a, b) => String(a.jzsj || '').localeCompare(String(b.jzsj || ''))),
      unsubmittedHomework: homeworkWithUrl.filter((h) => h.isUnsubmitted),
      contentState,
      newCount
    };

    saveData(data);
    return { success: true, data };
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') {
      return { success: false, error: 'SESSION_EXPIRED', message: '登录已过期，请重新登录' };
    }
    return { success: false, error: e.message || '抓取失败' };
  }
}

/**
 * 获取本地缓存数据
 */
function getCachedData() {
  return loadData();
}

/**
 * 诊断：检查 cookie 和简单请求，便于排查登录/抓取问题
 */
async function diagnose() {
  const auth = require('./auth');
  const cookies = auth.loadAuthState();
  const cookieCount = cookies?.length ?? 0;
  const cookieNames = cookies?.map((c) => c.name).join(', ') || '(无)';
  const hasXsrf = !!auth.getXsrfToken?.();
  let testResult = null;
  if (cookieCount > 0) {
    try {
      const res = await get('/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester');
      testResult = {
        ok: !!res?.result,
        semester: res?.result?.xnxq ?? null,
        rawKeys: typeof res === 'object' ? Object.keys(res) : []
      };
    } catch (e) {
      const raw = await rawRequest('/b/kc/zhjw_v_code_xnxq/getCurrentAndNextSemester');
      testResult = {
        ok: false,
        error: e?.message || String(e),
        statusCode: raw?.statusCode,
        bodySnippet: typeof raw?.body === 'string' ? raw.body.slice(0, 300) : '(非文本)'
      };
    }
  }
  return { cookieCount, cookieNames, hasXsrf, testResult };
}

function rawRequest(path) {
  return new Promise((resolve) => {
    const cookieHeader = getCookieHeader();
    if (!cookieHeader) {
      resolve({ statusCode: 0, body: 'no cookies' });
      return;
    }
    const auth = require('./auth');
    const xsrf = auth.getXsrfToken?.();
    const u = new URL(path.startsWith('http') ? path : BASE + path);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      Cookie: cookieHeader,
      Referer: BASE + '/'
    };
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, location: res.headers.location, body }));
      }
    );
    req.on('error', (e) => resolve({ statusCode: 0, body: e.message }));
    req.end();
  });
}

/**
 * 使用已登录 session 下载文件到用户目录
 */
async function downloadFile(url, filename) {
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) throw new Error('SESSION_EXPIRED');
  const auth = require('./auth');
  const xsrf = auth.getXsrfToken?.();
  const u = new URL(url.startsWith('http') ? url : BASE + url);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    Cookie: cookieHeader,
    Referer: BASE + '/'
  };
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

  const res = await new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers },
      (r) => {
        if (r.statusCode === 302 && r.headers.location) {
          const loc = r.headers.location;
          const nextUrl = loc.startsWith('http') ? loc : `${BASE}${loc}`;
          return downloadFile(nextUrl, filename).then(resolve).catch(reject);
        }
        if (r.statusCode !== 200) {
          reject(new Error(`HTTP ${r.statusCode}`));
          return;
        }
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => {
          const { app } = require('electron');
          const downloadsPath = app?.getPath?.('downloads') || process.cwd();
          const safeName = (filename || 'download').replace(/[<>:"/\\|?*]/g, '_');
          const filepath = path.join(downloadsPath, safeName);
          fs.writeFileSync(filepath, Buffer.concat(chunks));
          resolve({ ok: true, path: filepath });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
  return res;
}

module.exports = {
  fetchAll,
  getCachedData,
  getSemesterList,
  getCourses,
  getNotices,
  getHomework,
  getNoticeDetail,
  getHomeworkDetail,
  getCurrentSemester,
  getCourseDetail,
  getCourseFiles,
  getCourseFileList,
  downloadFile,
  diagnose
};
