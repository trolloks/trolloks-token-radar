// Independent board audit: node checks/verify.mjs <snapshot.json> <output dir>
import {readFileSync} from 'node:fs';
const [snapFile,dir]=process.argv.slice(2);
const s=JSON.parse(readFileSync(snapFile,'utf8'));
const b=JSON.parse(readFileSync(dir+'/board.json','utf8')).rows;
const R=JSON.parse(readFileSync(dir+'/data.js','utf8').replace(/^window\.RADAR=/,'').replace(/;\s*$/,''));
const cnt=new Map();for(const r of b)cnt.set(r.slug,(cnt.get(r.slug)||0)+1);
const out={};
out.watchlist_len=s.watchlist.length;out.watchlist_unique=new Set(s.watchlist).size;
out.watch_not_exactly_once=s.watchlist.filter(w=>cnt.get(w)!==1);
out.dup_slugs=[...cnt].filter(([,c])=>c>1).length;out.rows=b.length;
out.ranks_ok=b.every((r,i)=>r.rank===i+1);
out.bracket_violations=R.rows.filter(r=>!(r.low<=r.implied&&r.implied<=r.high)).map(r=>[r.slug,r.low,r.implied,r.high]);
out.not_strict=R.rows.filter(r=>!(r.low<r.implied&&r.implied<r.high)).length;
out.data_matches_board=R.rows.length===b.length&&R.rows.every((r,i)=>r.slug===b[i].slug&&r.implied===b[i].implied_value_usd);
let ord=0,ties=0,tb=0;for(let i=1;i<b.length;i++){const p=b[i-1],c=b[i];if(c.implied_value_usd>p.implied_value_usd)ord++;if(c.implied_value_usd===p.implied_value_usd){ties++;if(!(p.slug<c.slug))tb++}}
out.order_violations=ord;out.ties=ties;out.tiebreak_violations=tb;
out.token_rows_on_board=b.filter(r=>r.mcap_usd!==null||r.gecko_id||r.symbol).length;
const early=b.filter(r=>!s.watchlist.includes(r.slug));
out.early=early.length;out.early_at_or_above_floor=early.filter(r=>r.tvl_usd>=s.floor_usd).length;
out.early_cex=early.filter(r=>r.category==='CEX').length;
out.early_versioned=early.filter(r=>/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(r.name)).length;
out.nonfinite=JSON.stringify(R).includes('null')?'has nulls (expected only cat_ratio/ch7/age/listed)':'none';
console.log(JSON.stringify(out,null,1));
