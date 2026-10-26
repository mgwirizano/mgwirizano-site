import fs from 'node:fs';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,t)=>fs.writeFileSync(path.join(root,p),t);
write('dist/ledger.js',read('ledger.js'));
write('apps-script/Ledger.gs',read('ledger.js').replace(/if\(typeof module[^\n]+/g,''));
let html=read('dist/index.html');
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+read('dist/styles.css')+'</style>')
 .replace("window.MW_BOOT={mode:'demo'};",'window.MW_BOOT=<?!= boot ?>;')
 .replace('<script src="ledger.js"></script>','<script>'+read('ledger.js').replace(/<\/script/gi,'<\\/script')+'</script>')
 .replace('<script src="app.js"></script>','<script>'+read('dist/app.js').replace(/<\/script/gi,'<\\/script')+'</script>');
write('apps-script/MemberPortal.html',html);
console.log('Built Apps Script HTML and shared ledger.');
