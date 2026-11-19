// Behaviour test with a small DOM stub: node checks/a11y.mjs <outdir>
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const out=process.argv[2];let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
function boot(hash){
 const doc={active:null,ids:{}};
 class N{constructor(t){this.tag=t;this.ch=[];this.style={};this.attrs={};this._t='';this.ls={};this.open=false;this.parent=null;this.className=''}
  set textContent(v){this._t=String(v);this.ch.forEach(c=>c.parent=null);this.ch=[]} get textContent(){return this._t+this.ch.map(c=>c.textContent).join('')}
  appendChild(c){c.parent=this;this.ch.push(c);return c} setAttribute(k,v){this.attrs[k]=v} getAttribute(k){return this.attrs[k]}
  addEventListener(e,f){(this.ls[e]??=[]).push(f)} fire(e,x={}){(this.ls[e]||[]).forEach(f=>f.call(this,{target:this,...x}))}
  get isConnected(){let n=this;while(n){if(n===doc.root)return true;n=n.parent}return false}
  focus(){if(this.isConnected||this.tag==='dialog')doc.active=this} click(){this.fire('click')}
  showModal(){this.open=true} close(){if(this.open){this.open=false;this.fire('close')}}
  set value(v){this._v=v} get value(){return this._v??''}
  querySelectorAll(s){return this.find(n=>n.tag==='button'&&/link/.test(n.className))}
  find(p,a=[]){if(p(this))a.push(this);this.ch.forEach(c=>c.find(p,a));return a}}
 doc.root=new N('root');
 doc.createElement=t=>new N(t);doc.createTextNode=t=>Object.assign(new N('#t'),{_t:t});
 const ids=doc.ids;doc.getElementById=i=>{if(!ids[i]){ids[i]=new N(i==='dlg'?'dialog':i);doc.root.appendChild(ids[i])}return ids[i]};
 const views=['board','live'].map(v=>{const b=new N('button');b.attrs['data-view']=v;doc.root.appendChild(b);return b});
 doc.querySelectorAll=()=>views;Object.defineProperty(doc,'activeElement',{get:()=>doc.active});
 const win={location:{hash,pathname:'/',search:''},history:{replaceState(a,b,h){win.location.hash=String(h).startsWith('#')?h:''}},handlers:{},addEventListener(e,f){win.handlers[e]=f}};
 const ctx={window:win,document:doc,location:win.location,history:win.history};vm.createContext(ctx);
 vm.runInContext(readFileSync(out+'/data.js','utf8'),ctx);
 vm.runInContext(readFileSync(out+'/dashboard/app.js','utf8'),ctx);
 return {doc,win,ids};
}
const rowBtns=a=>a.ids.tbl.find(n=>n.tag==='button'&&/link/.test(n.className));
// 1 normal open/close with focus return
let a=boot('');let b0=rowBtns(a)[2];b0.focus();b0.click();
ok(a.ids.dlg.open,'click opens dialog');ok(a.win.location.hash.includes('row='),'hash records row');
ok(a.doc.active&&a.doc.active.textContent==='Close','focus moves to Close button');
a.doc.active.click();ok(!a.ids.dlg.open,'Close button closes');ok(a.doc.active===b0,'focus returns to the row button');ok(!a.win.location.hash.includes('row='),'hash row cleared');
// 2 close after filter re-render: focus must land on the same row's control (or a sane fallback)
a=boot('');b0=rowBtns(a)[1];b0.focus();b0.click();
a.ids.q.value='';a.ids.dlg.close();ok(a.doc.active&&a.doc.active.isConnected,'focus is on a connected element after close');
// 2b focus returns to the same row's button even though the table was rebuilt
a=boot('');b0=rowBtns(a)[3];b0.focus();b0.click();a.ids.q.value='dex';a.ids.q.fire('input');a.ids.q.value='';a.ids.q.fire('input');
a.ids.dlg.close();ok(a.doc.active&&a.doc.active.getAttribute('data-slug')===b0.getAttribute('data-slug')&&a.doc.active.isConnected,'focus returns to same row after table re-render');
// 2c hash-opened dialog closes with focus on that row or search box
a=boot('#row=3f');a.ids.dlg.close();ok(a.doc.active&&a.doc.active.isConnected,'hash-opened dialog restores focus to a live element');
// 3 prototype-key hashes must not break anything
const hostile=process.argv[3]==='hostile';
for(const h of[...(hostile?[]:['#row=constructor','#row=__proto__']),'#row=toString','#cat=constructor','#cat=__proto__','#row=hasOwnProperty']){
 try{a=boot(h);ok(!a.ids.dlg.open&&a.ids.count.textContent.startsWith('Showing 200 of 200'),'hash '+h+' ignored cleanly')}catch(e){ok(false,'hash '+h+' threw '+e.message)}}
// 4 hash-driven open, then second hash while open keeps focus restoration sane
a=boot('#row=3f');ok(a.ids.dlg.open,'#row opens dialog');a.win.location.hash='#row=gauntlet';a.win.handlers.hashchange();
ok(a.ids.dlg.open&&/Gauntlet/.test(a.ids.dbody.textContent),'hashchange switches row while open');
a.ids.dlg.close();ok(a.doc.active===null||a.doc.active.isConnected,'focus not stranded on detached node');
// 5 escaping: hostile hash values never reach markup, only textContent/value
a=boot('#q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&cat=%3Cb%3E');ok(a.ids.q.value.startsWith('<img'),'query kept as plain text in input value');
ok(JSON.stringify(a.ids.tbl.ch.map(c=>c.tag)).indexOf('img')<0,'no img element created');
// 6 semantics
a=boot('#row=3f');ok(/<dialog[^>]*aria-labelledby="dtitle"/.test(readFileSync(out+'/dashboard/index.html','utf8'))&&a.ids.dbody.find(n=>n.tag==='h2'&&n.attrs.id==='dtitle').length===1,'dialog is labelled by its heading');
if(hostile){for(const s of['__proto__','constructor']){a=boot('#row='+s);ok(a.ids.dlg.open&&/img|script/.test(a.ids.dbody.textContent)&&a.ids.dbody.find(n=>n.tag==='img'||n.tag==='script').length===0,'hostile slug '+s+' opens as inert text')}}
console.log(fails?`${fails} FAILED`:'all passed');process.exit(fails?1:0);
