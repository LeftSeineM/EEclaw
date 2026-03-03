const fs = require('fs');
let c = fs.readFileSync('electron/courseSelectionCrawler.js', 'utf8');

c = c.replace(/win\.webContents\.setWindowOpenHandler\(\(\{ url \}\) => \{\s+if \(url &&/,
  "win.webContents.setWindowOpenHandler(({ url }) => {\n      if (!win || win.isDestroyed()) return { action: 'deny' };\n      if (url &&");

c = c.replace(/setTimeout\(\(\) => \{\s+if \(!resolved\) \{\s+log\('❌ 抓取超时 \(60s\)'\);\s+finish\(false, null, '抓取超时'\);\s+\}\s+\}, 60000\);/,
  "setTimeout(() => {\n      if (!resolved) finish(false, null, '抓取超时', true);\n    }, 60000);");

fs.writeFileSync('electron/courseSelectionCrawler.js', c);
console.log('patch2 done');
