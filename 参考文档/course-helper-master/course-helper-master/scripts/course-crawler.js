// ========== 选课社区爬虫模块 ==========
// 负责从 yourschool.cc 爬取课程评价数据

class CourseCrawler {
  constructor() {
    this.baseUrl = 'https://yourschool.cc/thucourse_api/api/review/';
    this.pageSize = 20;
    this.requestDelay = 400; // 每次请求间隔 400ms，避免限速
    this.retryDelay = 1000;  // 被限速后重试间隔
    this.maxRetries = 3;     // 最大重试次数
  }

  // 延时函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 单次请求（带重试）
  async fetchPage(pageNum) {
    const url = `${this.baseUrl}?page=${pageNum}&size=${this.pageSize}`;
    
    for (let retry = 0; retry < this.maxRetries; retry++) {
      try {
        await this.sleep(this.requestDelay);
        
        const response = await fetch(url);
        const data = await response.json();
        
        // 检查是否被限速
        if (data.detail && data.detail.includes('限速')) {
          console.log(`[Crawler] Page ${pageNum} rate limited, retry ${retry + 1}/${this.maxRetries}`);
          await this.sleep(this.retryDelay);
          continue;
        }
        
        return { success: true, data };
      } catch (error) {
        console.error(`[Crawler] Error fetching page ${pageNum}:`, error);
        if (retry === this.maxRetries - 1) {
          return { success: false, error: error.message };
        }
        await this.sleep(this.retryDelay);
      }
    }
    
    return { success: false, error: 'Max retries exceeded' };
  }

  // 获取总页数
  async getTotalPages() {
    const result = await this.fetchPage(1);
    if (!result.success) {
      throw new Error('Failed to get total page count');
    }
    
    const count = result.data.count || 0;
    const totalPages = Math.ceil(count / this.pageSize);
    
    console.log(`[Crawler] Total reviews: ${count}, total pages: ${totalPages}`);
    return { totalPages, firstPageData: result.data };
  }

  // 爬取所有数据
  async crawlAll(onProgress) {
    console.log('[Crawler] Starting to crawl course reviews...');
    
    // 获取总页数
    const { totalPages, firstPageData } = await this.getTotalPages();
    
    const allResults = [];
    allResults.push(...firstPageData.results);
    
    if (onProgress) {
      onProgress({ current: 1, total: totalPages, percentage: Math.round(100 / totalPages) });
    }
    
    // 逐页爬取（从第2页开始）
    for (let page = 2; page <= totalPages; page++) {
      console.log(`[Crawler] Fetching page ${page}/${totalPages}`);
      
      const result = await this.fetchPage(page);
      
      if (result.success && result.data.results) {
        allResults.push(...result.data.results);
      } else {
        console.warn(`[Crawler] Failed to fetch page ${page}, skipping...`);
      }
      
      if (onProgress) {
        onProgress({
          current: page,
          total: totalPages,
          percentage: Math.round((page / totalPages) * 100)
        });
      }
    }
    
    console.log(`[Crawler] Crawling complete, total ${allResults.length} reviews`);
    return allResults;
  }

  // 处理原始数据，转换为课程对象
  processCourseData(rawResults) {
    const courseMap = new Map();
    
    rawResults.forEach(item => {
      const courseId = item.course.id;
      
      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          course_name: item.course.name,
          course_teacher: item.course.teacher,
          course_id: courseId,
          rating: 0,
          comments: [],
          comment_sum: 0
        });
      }
      
      const course = courseMap.get(courseId);
      
      // 更新平均评分
      if (course.comment_sum === 0) {
        course.rating = item.rating;
      } else {
        course.rating = (course.rating * course.comment_sum + item.rating) / (course.comment_sum + 1);
      }
      
      course.comment_sum += 1;
      course.comments.push(item.comment);
    });
    
    return Array.from(courseMap.values());
  }
}

// 暴露给其他模块使用
if (typeof window !== 'undefined') {
  window.CourseCrawler = CourseCrawler;
}