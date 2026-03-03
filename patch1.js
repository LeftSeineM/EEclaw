const fs = require('fs');
const p = 'electron/courseSelectionCrawler.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/const \{ BrowserWindow \} = require\('electron'\);\r?\nconst auth = require\('\.\/auth'\);/,
  "const { BrowserWindow } = require('electron');\nconst path = require('path');\nconst fs = require('fs');\nconst auth = require('./auth');");
c = c.replace(/const casLogin = require\('\.\/casLogin'\);/,
  "const casLogin = require('./casLogin');\nconst storageConfig = require('./storageConfig');");

c = c.replace(/let resolved = false;\r?\n    function finish\(success, html, error\) \{/,
  'let resolved = false;\n    function safe() { return !resolved && win && !win.isDestroyed(); }\n    function finish(success, html, error, silent) {');
c = c.replace(/resolved = true;\r?\n      log\("\[位置\] finish 被调用/,
  'resolved = true;\n      if (!silent) log("[位置] finish 被调用');

fs.writeFileSync(p, c);
console.log('done');
