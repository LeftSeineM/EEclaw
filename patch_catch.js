const fs = require('fs');
let c = fs.readFileSync('electron/courseSelectionCrawler.js', 'utf8');

const search = '} catch (err) {\n            log(❌ 异常: \);\n            finish(false, null, err?.message || \'抓取异常\');\n          }\n        });\n        return;\n      }\n\n      // 其他情况';
const repl = '} catch (err) {\n            const msg = (err && err.message) || String(err);\n            if (msg.includes(\'destroyed\') || msg.includes(\'Object has been destroyed\')) {\n              finish(false, null, \'窗口已关闭\');\n              return;\n            }\n            log(\❌ 异常: \\);\n            finish(false, null, msg || \'抓取异常\');\n          }\n        });\n        return;\n      }\n\n      // 其他情况';

if (c.includes(search)) {
  c = c.replace(search, repl);
  fs.writeFileSync('electron/courseSelectionCrawler.js', c);
  console.log('replaced');
} else {
  console.log('not found');
  const i = c.indexOf('} catch (err) {');
  console.log('snippet:', c.substring(i, i+200));
}
