// ========== 数据获取模块 ==========
// 负责从网络学堂和教务系统获取数据

class TrainingPlanFetcher {
  constructor() {
    this.baseUrl = "https://learn.tsinghua.edu.cn";
    this.ticket = null;
    this.xsrfToken = null;
  }

  // 步骤1: 获取XSRF-TOKEN
  async getXSRFToken() {
    console.log("正在获取XSRF-TOKEN...");
    
    try {
      // 访问网络学堂首页,从Cookie中提取token
      const response = await fetch(this.baseUrl, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`访问网络学堂失败: ${response.status}`);
      }
      
      // 从Cookie中提取XSRF-TOKEN
      const cookies = document.cookie;
      const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
      
      if (match) {
        this.xsrfToken = match[1];
        console.log("✅ XSRF-TOKEN获取成功:", this.xsrfToken);
        return this.xsrfToken;
      } else {
        throw new Error("未找到XSRF-TOKEN,可能未登录");
      }
      
    } catch (error) {
      console.error("❌ 获取XSRF-TOKEN失败:", error);
      throw error;
    }
  }

  // 步骤2: 获取教务系统ticket
  async getZhjwTicket() {
    console.log("正在获取教务ticket...");
    
    if (!this.xsrfToken) {
      await this.getXSRFToken();
    }
    
    try {
      const url = `${this.baseUrl}/b/wlxt/common/auth/getzhjwTicket?_csrf=${this.xsrfToken}`;
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`获取ticket失败: ${response.status}`);
      }
      
      const ticket = await response.text();
      this.ticket = ticket.trim();
      
      console.log("✅ Ticket获取成功:", this.ticket);
      return this.ticket;
      
    } catch (error) {
      console.error("❌ 获取ticket失败:", error);
      throw error;
    }
  }

  // 步骤3: 访问培养方案页面
  async fetchTrainingPlan() {
    console.log("正在获取培养方案...");
    
    if (!this.ticket) {
      await this.getZhjwTicket();
    }
    
    try {
      // 构建教务系统URL(带ticket)
      const eduUrl = `http://zhjw.cic.tsinghua.edu.cn/j_acegi_login.do?ticket=${this.ticket}&url=/jhBks.by_fascjgmxb_gr.do?m=queryFaScjgmx_gr&xsViewFlag=pyfa&pathContent=培养方案完成情况`;
      
      const response = await fetch(eduUrl, {
        credentials: 'include',
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`访问培养方案失败: ${response.status}`);
      }
      
      const html = await response.text();
      
      console.log("✅ 培养方案HTML获取成功,长度:", html.length);
      
      // 简单验证
      if (html.includes("table") || html.includes("课组")) {
        console.log("✅ 内容验证通过!");
        return { success: true, html };
      } else {
        console.log("⚠️ 内容可能不完整");
        return { success: false, html, reason: "内容验证失败" };
      }
      
    } catch (error) {
      console.error("❌ 获取培养方案失败:", error);
      throw error;
    }
  }

  // 一键获取完整流程
  async fetchAll() {
    console.log("=== 开始完整流程 ===");
    
    try {
      await this.getXSRFToken();
      await this.getZhjwTicket();
      const result = await this.fetchTrainingPlan();
      
      console.log("=== 流程完成 ===");
      return result;
      
    } catch (error) {
      console.error("=== 流程失败 ===", error);
      return { success: false, error: error.message };
    }
  }
}

// 导出供其他模块使用
window.TrainingPlanFetcher = TrainingPlanFetcher;