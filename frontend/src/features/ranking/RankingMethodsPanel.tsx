import React,{useEffect,useMemo,useState} from 'react';
import {localStore} from '../../core/storage/localStore';
import {ahp,bwm,aggregatePairwiseMatrices,aggregateBwmJudgments,makeRankingSnapshot,type PairwiseMatrix} from './rankingMethods';
type Props={language:'fa'|'en'};
type Expert={name:string,matrix:PairwiseMatrix,bestToOthers:number[],othersToWorst:number[]};
const newMatrix=(n:number):PairwiseMatrix=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:1));
export default function RankingMethodsPanel({language}:Props){
 const en=language==='en'; const [method,setMethod]=useState<'AHP'|'BWM'>('AHP');
 const [criteria,setCriteria]=useState(['هزینه سرمایه‌گذاری','ریسک اجرا','زمان اجرا']);
 const [experts,setExperts]=useState<Expert[]>([{name:'خبره ۱',matrix:[[1,1,1],[1,1,1],[1,1,1]],bestToOthers:[1,1,1],othersToWorst:[1,1,1]}]);
 const [best,setBest]=useState(0); const [worst,setWorst]=useState(2); const [notice,setNotice]=useState(''); const [history,setHistory]=useState<any[]>([]);
 const [active,setActive]=useState<any>(null);
 useEffect(()=>{void localStore.get<any[]>('mod10-ranking-method-history:v1').then(v=>setHistory(Array.isArray(v)?v:[])).catch(()=>undefined)},[]);
 const updateExpert=(idx:number,fn:(e:Expert)=>Expert)=>setExperts(es=>es.map((e,i)=>i===idx?fn(e):e));
 const addExpert=()=>setExperts(es=>[...es,{name:`${en?'Expert':'خبره'} ${es.length+1}`,matrix:newMatrix(criteria.length),bestToOthers:Array(criteria.length).fill(1),othersToWorst:Array(criteria.length).fill(1)}]);
 const addCriterion=()=>{if(criteria.length>=8)return;setCriteria(cs=>[...cs,`${en?'Criterion':'معیار'} ${cs.length+1}`]);setExperts(es=>es.map(e=>({...e,matrix:newMatrix(criteria.length+1),bestToOthers:[...e.bestToOthers,1],othersToWorst:[...e.othersToWorst,1]})))};
 const run=async()=>{
  try{
   let weights:number[],diagnostics:any,judgments:any;
   if(method==='AHP'){
    const matrices=experts.map(e=>e.matrix); const group=aggregatePairwiseMatrices(matrices); const result=ahp(group);
    weights=result.weights;diagnostics={lambdaMax:result.lambdaMax,ci:result.ci,cr:result.cr,consistent:result.consistent};judgments={expertMatrices:matrices,aggregatedMatrix:group};
    if(!result.consistent){setNotice(en?'Consistency ratio exceeds 0.10. Revise judgments before accepting weights.':'نسبت ناسازگاری بیش از ۰٫۱۰ است؛ قضاوت‌ها را اصلاح کنید.');return;}
   }else{
    const agg=aggregateBwmJudgments(experts);const result=bwm(best,worst,agg.bestToOthers,agg.othersToWorst);weights=result.weights;diagnostics={xi:result.xi,bestIndex:best,worstIndex:worst};judgments={expertJudgments:experts.map(e=>({name:e.name,bestToOthers:e.bestToOthers,othersToWorst:e.othersToWorst})),aggregated:agg};
   }
   const snapshot=makeRankingSnapshot({method,criteria,expertCount:experts.length,weights,diagnostics,judgments});
   const next=[snapshot,...history].slice(0,100);await localStore.set('mod10-ranking-method-history:v1',next);setHistory(next);setActive(snapshot);setNotice(en?'Calculation version saved':'نسخه محاسبه ذخیره شد');
  }catch(error){setNotice(error instanceof Error?error.message:String(error))}
 };
 const scale=[1,2,3,4,5,6,7,8,9];
 return <section className="module-workspace-card" style={{marginTop:18}} aria-label={en?'AHP and BWM methods':'روش‌های AHP و BWM'}>
  <div className="section-head"><div><h2>{en?'Advanced weighting · AHP / BWM':'وزن‌دهی پیشرفته · AHP و BWM'}</h2><p>{en?'Expert judgments, consistency diagnostics, group aggregation and immutable calculation history':'قضاوت خبرگان، کنترل سازگاری، تجمیع گروهی و تاریخچه نسخه‌های محاسبه'}</p></div><span className="muted">{en?'Independent engine tests':'دارای آزمون مستقل موتور محاسبات'}</span></div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}><button className={method==='AHP'?'primary':'secondary'} onClick={()=>setMethod('AHP')}>AHP</button><button className={method==='BWM'?'primary':'secondary'} onClick={()=>setMethod('BWM')}>BWM</button></div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><b>{en?'Criteria':'معیارها'}:</b>{criteria.map((c,i)=><span key={i} className="tag">{c}</span>)}<button className="secondary-button" onClick={addCriterion} disabled={criteria.length>=8}>{en?'Add criterion':'افزودن معیار'}</button></div>
  {experts.map((e,ei)=><div key={ei} style={{border:'1px solid var(--line)',borderRadius:10,padding:12,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>{e.name}</b><button className="secondary-button" onClick={()=>setExperts(es=>es.filter((_,i)=>i!==ei))} disabled={experts.length===1}>{en?'Remove':'حذف'}</button></div>
   {method==='AHP'?<div style={{overflowX:'auto',marginTop:10}}><table style={{borderCollapse:'collapse',width:'100%'}}><tbody>{criteria.map((c,i)=><tr key={i}><th>{c}</th>{criteria.map((_,j)=><td key={j} style={{padding:4}}>{i===j?'1':i<j?<select aria-label={en?`${e.name} ${c} vs ${criteria[j]}`:`${e.name}: ${c} در برابر ${criteria[j]}`} value={e.matrix[i][j]} onChange={ev=>{const v=Number(ev.target.value);updateExpert(ei,x=>{const m=x.matrix.map(r=>[...r]);m[i][j]=v;m[j][i]=1/v;return {...x,matrix:m}})}}>{scale.map(v=><option key={v} value={v}>{v}</option>)}</select>:<span>{e.matrix[i][j].toFixed(3)}</span>}</td>)}</tr>)}</tbody></table><small className="muted">{en?'Saaty 1–9 scale; reciprocal entries are maintained automatically.':'مقیاس ۱ تا ۹ ساعتی؛ مقدار معکوس به‌طور خودکار ثبت می‌شود.'}</small></div>:<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{criteria.map((c,i)=><label key={i} style={{display:'grid',gap:4}}>{en?'Best over':'برتری بهترین بر'} {c}<select value={e.bestToOthers[i]} disabled={i===best} onChange={ev=>updateExpert(ei,x=>({...x,bestToOthers:x.bestToOthers.map((v,k)=>k===i?Number(ev.target.value):v)}))}>{scale.map(v=><option key={v}>{v}</option>)}</select><small>{en?'Other over worst':'برتری '+c+' بر بدترین'}</small><select value={e.othersToWorst[i]} disabled={i===worst} onChange={ev=>updateExpert(ei,x=>({...x,othersToWorst:x.othersToWorst.map((v,k)=>k===i?Number(ev.target.value):v)}))}>{scale.map(v=><option key={v}>{v}</option>)}</select></label>)}</div>}
  </div>)}
  <button className="secondary-button" style={{marginTop:10}} onClick={addExpert}>{en?'Add expert':'افزودن خبره'}</button>
  {method==='BWM'&&<div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}><label>{en?'Best criterion':'معیار بهترین'} <select value={best} onChange={e=>setBest(Number(e.target.value))}>{criteria.map((c,i)=><option value={i} key={i}>{c}</option>)}</select></label><label>{en?'Worst criterion':'معیار بدترین'} <select value={worst} onChange={e=>setWorst(Number(e.target.value))}>{criteria.map((c,i)=><option value={i} key={i}>{c}</option>)}</select></label></div>}
  <button className="primary" style={{marginTop:14}} onClick={()=>void run()} disabled={method==='BWM'&&best===worst}>{en?'Calculate and version':'محاسبه و ثبت نسخه'}</button>
  {notice&&<p className="muted" role="status">{notice}</p>}
  {active&&<div style={{marginTop:14,padding:12,border:'1px solid var(--line)',borderRadius:10}}><b>{en?'Accepted weights':'وزن‌های تأییدشده'} · {active.method}</b><ol>{active.criteria.map((c:string,i:number)=><li key={c}>{c}: {(active.weights[i]*100).toFixed(2)}%</li>)}</ol><small className="muted">{en?'Version':'نسخه'}: {active.createdAt} · {JSON.stringify(active.diagnostics)}</small></div>}
  <div style={{marginTop:14}}><b>{en?'Calculation history':'تاریخچه نسخه‌های محاسبه'} ({history.length})</b>{history.slice(0,5).map((s:any,i:number)=><div key={s.createdAt+i} style={{padding:8,borderBottom:'1px solid var(--line)'}}>{s.method} · {s.createdAt} · {s.expertCount} {en?'experts':'خبره'} · {s.weights.map((w:number)=>`${(w*100).toFixed(1)}%`).join(' / ')}</div>)}</div>
 </section>
}
