const fs = require('fs');
let c = fs.readFileSync('electron/courseSelectionCrawler.js', 'utf8');

c = c.replace(
  /(\} catch \(err\) \{\s+)(log\(❌ 异常: \$\{err\?\.message \|\| err\}\);\s+finish\(false, null, err\?\.message \|\| '抓取异常'\);\s+\})/g,
  function(m, p1, p2) {
    return p1 + "const msg = (err && err.message) || String(err);\n            if (msg.includes('destroyed') || msg.includes('Object has been destroyed')) {\n              finish(false, null, '窗口已关闭');\n              return;\n            }\n            " + p2;
  }
);

fs.writeFileSync('electron/courseSelectionCrawler.js', c);
console.log('done');
