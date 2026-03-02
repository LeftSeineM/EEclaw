// ========== 选课社区爬虫 UI 模块 ==========
// 负责在页面上显示爬虫控制界面

class CourseCrawlerUI {
  constructor() {
    this.crawler = null;
    this.isRunning = false;
    this.container = null;
  }

  // 初始化（仅在 yourschool.cc 页面）
  init() {
    if (!location.href.includes('yourschool.cc')) {
      return;
    }

    console.log('[Crawler UI] Initializing on yourschool.cc');
    this.crawler = new CourseCrawler();
    this.createUI();
  }

  // 创建浮动控制面板
  createUI() {
    // 避免重复创建
    if (document.getElementById('courseHelperCrawlerPanel')) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'courseHelperCrawlerPanel';
    panel.innerHTML = `
      <style>
        #courseHelperCrawlerPanel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 300px;
          background: white;
          border: 2px solid #4CAF50;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 999999;
          font-family: Arial, sans-serif;
        }
        #courseHelperCrawlerPanel h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #333;
        }
        #courseHelperCrawlerPanel button {
          width: 100%;
          padding: 10px;
          margin: 5px 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.3s;
        }
        #courseHelperCrawlerPanel button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        #crawlerStartBtn {
          background: #4CAF50;
          color: white;
        }
        #crawlerStartBtn:hover:not(:disabled) {
          background: #45a049;
        }
        #crawlerStopBtn {
          background: #f44336;
          color: white;
        }
        #crawlerStopBtn:hover:not(:disabled) {
          background: #da190b;
        }
        #crawlerProgress {
          margin: 10px 0;
          font-size: 13px;
          color: #666;
        }
        .progress-bar {
          width: 100%;
          height: 20px;
          background: #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
          margin: 10px 0;
        }
        .progress-fill {
          height: 100%;
          background: #4CAF50;
          transition: width 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
      </style>
      <h3>🎓 Course Helper 爬虫</h3>
      <button id="crawlerStartBtn">开始爬取课程数据</button>
      <button id="crawlerStopBtn" disabled>停止爬取</button>
      <div id="crawlerProgress">等待开始...</div>
      <div class="progress-bar">
        <div class="progress-fill" id="crawlerProgressBar" style="width: 0%">0%</div>
      </div>
    `;

    document.body.appendChild(panel);
    this.container = panel;

    // 绑定事件
    document.getElementById('crawlerStartBtn').addEventListener('click', () => this.startCrawling());
    document.getElementById('crawlerStopBtn').addEventListener('click', () => this.stopCrawling());
  }

  // 更新进度
  updateProgress(progress) {
    const progressText = document.getElementById('crawlerProgress');
    const progressBar = document.getElementById('crawlerProgressBar');

    if (progressText) {
      progressText.textContent = `进度: ${progress.current}/${progress.total} 页`;
    }

    if (progressBar) {
      progressBar.style.width = `${progress.percentage}%`;
      progressBar.textContent = `${progress.percentage}%`;
    }
  }

  // 开始爬取
  async startCrawling() {
    if (this.isRunning) return;

    this.isRunning = true;
    const startBtn = document.getElementById('crawlerStartBtn');
    const stopBtn = document.getElementById('crawlerStopBtn');
    const progressText = document.getElementById('crawlerProgress');

    startBtn.disabled = true;
    stopBtn.disabled = false;
    progressText.textContent = '正在爬取数据...';

    try {
      const rawResults = await this.crawler.crawlAll((progress) => {
        this.updateProgress(progress);
      });

      if (!this.isRunning) {
        progressText.textContent = '已停止';
        return;
      }

      // 处理数据
      progressText.textContent = '正在处理数据...';
      const courseData = this.crawler.processCourseData(rawResults);

      // 下载 JSON
      this.downloadJSON(courseData);

      progressText.textContent = `完成！共 ${courseData.length} 门课程`;
      
    } catch (error) {
      console.error('[Crawler UI] Error:', error);
      progressText.textContent = `错误: ${error.message}`;
    } finally {
      this.isRunning = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // 停止爬取
  stopCrawling() {
    this.isRunning = false;
    const progressText = document.getElementById('crawlerProgress');
    if (progressText) {
      progressText.textContent = '正在停止...';
    }
  }

  // 下载 JSON 文件
  downloadJSON(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `course_data_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[Crawler UI] JSON file downloaded');
  }
}

// 页面加载完成后初始化
if (typeof window !== 'undefined') {
  const crawlerUI = new CourseCrawlerUI();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => crawlerUI.init());
  } else {
    crawlerUI.init();
  }
}