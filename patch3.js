const fs = require('fs');
let c = fs.readFileSync('electron/courseSelectionCrawler.js', 'utf8');

// Fix catch block to handle destroyed
c = c.replace(/} catch \(err\) \{\s+log\(❌ 异常: \$\{err\?\.message \|\| err\}\);\s+finish\(false, null, err\?\.message \|\| '抓取异常'\);\s+\}\s+\}\);\s+return;\s+\}\s+\}\s+catch \(err\)/,
  } catch (err) {
            if ((err?.message || '').includes('destroyed') || (err?.message || '').includes('Object has been destroyed')) {
              finish(false, null, '窗口已关闭');
              return;
            }
            log(\❌ 异常: \\);
            finish(false, null, err?.message || '抓取异常');
          }
        });
        return;
      }
    } catch (err));

fs.writeFileSync('electron/courseSelectionCrawler.js', c);
console.log('patch3 done');
