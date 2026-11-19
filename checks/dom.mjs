// Offline smoke test with a tiny DOM stub: node checks/dom.mjs <outdir> [hash]
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const out=process.argv[2],hash=process.argv[3]||'';
class N{constructor(t){this.tag=t;this.ch=[];this.style={};this.attrs={};this._t='';this.open=false}
 set textContent(v){this._t=String(v);this.ch=[]} get textContent(){return this._t+this.ch.map(c=>c.textContent).join('')}
 appendChild(c){this.ch.push(c);return c} setAttribute(k,v){this.attrs[k]=v} getAttribute(k){return this.attrs[k]}
 addEventListener(){} focus(){} showModal(){this.open=true} close(){this.open=false} set value(v){} get value(){return ''}}
const ids={};const doc={createElement:t=>new N(t),createTextNode:t=>{const n=new N('#t');n._t=t;return n},
 getElementById:i=>ids[i]??(ids[i]=new N(i)),querySelectorAll:()=>[]};
const win={location:{hash,pathname:'/',search:''},history:{replaceState(){}},addEventListener(){}};
const ctx={window:win,document:doc,location:win.location,history:win.history};vm.createContext(ctx);
vm.runInContext(readFileSync(out+'/data.js','utf8'),ctx);
vm.runInContext(readFileSync(out+'/dashboard/app.js','utf8'),ctx);
console.log(ids.check.ch.map(c=>c.textContent).join('\n'));
if(ids.dbody)console.log('--- dialog\n'+ids.dbody.ch.filter(c=>/Back-test/.test(c.textContent)).map(c=>c.textContent).join('\n'));
