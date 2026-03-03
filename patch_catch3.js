const fs = require("fs");
let c = fs.readFileSync("electron/courseSelectionCrawler.js", "utf8");
const needle = "log(`❌ 异常: " + "${err?.message || err}" + "`);\n            finish(false, null, err?.message || '抓取异常');";
const repl = "const msg = (err && err.message) || String(err);\n            if (msg.includes('destroyed') || msg.includes('Object has been destroyed')) {\n              finish(false, null, '窗口已关闭');\n              return;\n            }\n            log(`❌ 异常: ${msg}`);\n            finish(false, null, msg || '抓取异常');";
c = c.split(needle).join(repl);
fs.writeFileSync("electron/courseSelectionCrawler.js", c);
console.log("done");
