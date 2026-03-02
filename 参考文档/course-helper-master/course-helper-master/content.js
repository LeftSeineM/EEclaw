console.log("Course Helper loaded on:", location.href);

// ========== 工具函数：序列化表单 ==========
function serializeForm() {
  const data = {};
  const inputs = document.querySelectorAll("input");

  inputs.forEach((input) => {
    if (!input.id) return;
    if (input.type === "checkbox") return;
    data[input.id] = input.value;
  });

  return data;
}

// ========== 插入"记住登录信息"复选框 ==========
function tryInsertCheckbox() {
  // ✨ 修复问题1：只在WebVPN的选课系统登录页面注入复选框
  // 排除网络学堂等其他页面
  const isWebVPNLoginPage = location.href.includes('webvpn.tsinghua.edu.cn') || 
                            location.href.includes('zhjwxk.cic.tsinghua.edu.cn/xklogin');
  
  if (!isWebVPNLoginPage) {
    console.log("Course Helper: not WebVPN login page, skip checkbox insertion");
    return;
  }

  const btn = document.querySelector("a.btn");
  if (!btn) return;

  if (document.getElementById("courseHelperCheckbox")) return;

  const wrapper = document.createElement("div");
  wrapper.style.marginBottom = "12px";
  wrapper.style.fontSize = "14px";

  wrapper.innerHTML = `
    <label style="cursor: pointer;">
      <input type="checkbox" id="courseHelperCheckbox" />
      登录后自动进入选课系统（由 Course Helper 添加）
    </label>
  `;

  btn.parentElement.insertBefore(wrapper, btn);
  console.log("Course Helper: checkbox inserted on WebVPN login page");
}

// ========== Hook 登录按钮，用于保存登录信息 ==========
function hookLoginButtonClick() {
  const btn = document.querySelector("a.btn.btn-primary");
  if (!btn) return;

  if (btn.__courseHelperHooked) return;
  btn.__courseHelperHooked = true;

  btn.addEventListener("click", () => {
    console.log("Course Helper: login button clicked");

    const checkbox = document.getElementById("courseHelperCheckbox");
    if (!checkbox || !checkbox.checked) {
      console.log("Course Helper: checkbox not checked, skip save");
      return;
    }

    const formData = serializeForm();

    chrome.runtime.sendMessage(
      {
        type: "saveLoginProfile",
        data: {
          url: location.href,
          time: Date.now(),
          formData,
        },
      },
      (res) => {
        console.log("Course Helper: login profile saved", res);
      }
    );
  });

  console.log("Course Helper: login button click hooked");
}

// ========== 自动填充并触发登录 ==========
function tryAutoFillLogin() {
  chrome.runtime.sendMessage(
    { type: "loadLoginProfile" },
    (res) => {
      const profile = res && res.data;
      if (!profile || !profile.formData) {
        console.log("Course Helper: no login profile for autofill");
        return;
      }

      console.log("Course Helper: start autofill");

      const formData = profile.formData;

      Object.keys(formData).forEach((key) => {
        const input = document.getElementById(key);
        if (!input) return;
        if (input.type === "checkbox") return;

        input.value = formData[key];
        input.dataset.courseHelper = "1"; // 标记插件填充
      });

      console.log("Course Helper: autofill done");

      const loginBtn = document.querySelector(
        'a.btn.btn-lg.btn-primary.btn-block'
      );

      if (loginBtn) {
        console.log("Course Helper: clicking login button");
        loginBtn.click();
        chrome.runtime.sendMessage({ type: "loginTriggered" });
      } else {
        console.log("Course Helper: login button not found");
      }
    }
  );
}

// ========== 等待页面就绪 ==========
const timer = setInterval(() => {
  const form = document.querySelector("form");
  if (!form) return;

  tryInsertCheckbox();
  hookLoginButtonClick();
  tryAutoFillLogin();

  clearInterval(timer);
}, 500);

// ====== 判断是否在选课系统页面（WebVPN 内） ======
const isCourseSystem =
  location.pathname.includes("xkBks") ||
  location.pathname.includes("xklogin") ||
  location.pathname.includes("xk");

if (isCourseSystem) {
  console.log("Course Helper: in course system page");

  chrome.runtime.sendMessage(
    { type: "CHECK_AUTO_REFRESH" },
    (res) => {
      if (res && res.enabled) {
        console.log(
          "Course Helper: scheduling next refresh in",
          res.intervalMs,
          "ms"
        );

        setTimeout(() => {
          location.reload();
        }, res.intervalMs);
      }
    }
  );
}



// ====== 手动启动 / 停止自动刷新 ======
function triggerManualRefresh() {
  chrome.runtime.sendMessage({ type: "START_AUTO_REFRESH", intervalMs: 3000 });
  console.log("Course Helper: manually started auto refresh");
}

function stopManualRefresh() {
  chrome.runtime.sendMessage({ type: "STOP_AUTO_REFRESH" });
  console.log("Course Helper: manually stopped auto refresh");
}


// ====== 接收手动刷新指令（调试用） ======
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data && event.data.type === "COURSE_HELPER_REFRESH") {
    console.log("Course Helper: refresh message received");
    location.reload();
  }
});

// ====== 手动触发立即刷新（用于启动刷新循环） ======
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TRIGGER_REFRESH_NOW") {
    console.log("Course Helper: trigger refresh now");
    location.reload();
  }
});