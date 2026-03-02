const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eeInfo', {
  crawler: {
    fetch: (semesterId) => ipcRenderer.invoke('crawler:fetch', semesterId),
    getSemesterList: () => ipcRenderer.invoke('crawler:getSemesterList'),
    getCached: () => ipcRenderer.invoke('crawler:getCached'),
    diagnose: () => ipcRenderer.invoke('crawler:diagnose'),
    getCourseDetail: (wlkcid) => ipcRenderer.invoke('crawler:getCourseDetail', wlkcid),
    getCourseFiles: (wlkcid) => ipcRenderer.invoke('crawler:getCourseFiles', wlkcid),
    getCourseFileList: (wlkcid, flid) => ipcRenderer.invoke('crawler:getCourseFileList', wlkcid, flid),
    getNotices: (wlkcid) => ipcRenderer.invoke('crawler:getNotices', wlkcid),
    getHomework: (wlkcid) => ipcRenderer.invoke('crawler:getHomework', wlkcid),
    getNoticeDetail: (wlkcid, ggid) => ipcRenderer.invoke('crawler:getNoticeDetail', wlkcid, ggid),
    getHomeworkDetail: (wlkcid, xszyid) => ipcRenderer.invoke('crawler:getHomeworkDetail', wlkcid, xszyid),
    downloadFile: (url, filename) => ipcRenderer.invoke('crawler:downloadFile', url, filename)
  },
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getStatus: () => ipcRenderer.invoke('auth:status'),
    getCookiesForCrawler: () => ipcRenderer.invoke('auth:getCookiesForCrawler'),
    openLoginInBrowser: () => ipcRenderer.invoke('auth:openLoginInBrowser')
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  llm: {
    chat: (opts) => ipcRenderer.invoke('llm:chat', opts)
  },
  storage: {
    getDataPath: () => ipcRenderer.invoke('storage:getDataPath'),
    setDataPath: (path) => ipcRenderer.invoke('storage:setDataPath', path),
    selectFolder: () => ipcRenderer.invoke('storage:selectFolder')
  },
  courseSelection: {
    fetchTrainingPlan: () => ipcRenderer.invoke('courseSelection:fetchTrainingPlan'),
    getData: () => ipcRenderer.invoke('courseSelection:getData'),
    setData: (data) => ipcRenderer.invoke('courseSelection:setData', data),
    onLog: (cb) => {
      const handler = (_, msg) => cb(msg);
      ipcRenderer.on('courseSelection:log', handler);
      return () => ipcRenderer.removeListener('courseSelection:log', handler);
    }
  },
  agent: {
    getSessions: () => ipcRenderer.invoke('agent:getSessions'),
    saveSessions: (sessions) => ipcRenderer.invoke('agent:saveSessions', sessions),
    getMemory: () => ipcRenderer.invoke('agent:getMemory'),
    saveMemory: (memories) => ipcRenderer.invoke('agent:saveMemory', memories)
  }
});
