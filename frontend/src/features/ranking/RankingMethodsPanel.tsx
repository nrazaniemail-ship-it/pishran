import {useEffect,useState} from 'react';
import {localStore} from '../../core/storage/localStore';
import {ahp,bwm,aggregatePairwiseMatrices,aggregateBwmJudgments,makeRankingSnapshot,topsis,type PairwiseMatrix,type CriterionDirection} from './rankingMethods';
type Props={language:'fa'|'en'};
type Method='AHP'|'BWM'|'TOPSIS'|'AHP+TOPSIS';
type Expert={name:string,matrix:PairwiseMatrix,bestToOthers:number[],othersToWorst:number[]};
const newMatrix=(n:number):PairwiseMatrix=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:1));
const initialScores=()=>[[80,7,12],[65,9,8],[90,6,15]];
export default function RankingMethodsPanel({language}:Props){
 const en=language==='en';
 const [method,setMethod]=useState<Method>('AHP');
 const [criteria,setCriteria]=useState(['هزینه سرمایه‌گذاری','ریسک اجرا','زمان اجرا']);
 const [experts,setExperts]=useState<Expert[]>([{name:'خبره ۱',matrix:newMatrix(3),bestToOthers:[1,1,1],othersToWorst:[1,1,1]}]);
 const [best,setBest]=useState(0); const [worst,setWorst]=useState(2);
 const [alternatives,setAlternatives]=useState(['گزینه الف','گزینه ب','گزینه ج']);
 const [scores,setScores]=useState<number[][]>(initialScores());
 const [directions,setDirections]=useState<CriterionDirection[]>(['cost','benefit','cost']);
 const [manualWeights,setManualWeights]=useState([0.5,0.3,0.2]);
 const [notice,setNotice]=useState(''); const [history,setHistory]=useState<any[]>([]);
 const [active,setActive]=useState<any>(null);
 useEffect(()=>{void localStore.get<any[]>('mod10-ranking-method-history:v1').then(v=>setHistory(Array.isArray(v)?v:[])).catch(()=>undefined)},[]);
 const usesExperts=method==='AHP'||method==='BWM'||method==='AHP+TOPSIS';
 const updateExpert=(idx:number,fn:(e:Expert)=>Expert)=>setExperts(es=>es.map((e,i)=>i===idx?fn(e):e));
 const addExpert=()=>setExperts(es=>[...es,{name:`${en?'Expert':'خبره'} ${es.length+1}`,matrix:newMatrix(criteria.length),bestToOthers:Array(criteria.length).fill(1),othersToWorst:Array(criteria.length).fill(1)}]);
 const addCriterion=()=>{if(criteria.length>=8)return;setCriteria(cs=>[...cs,`${en?'Criterion':'معیار'} ${cs.length+1}`]);setExperts(es=>es.map(e=>({...e,matrix:[...e.matrix.map(row=>[...row,1]),Array(criteria.length+1).fill(1)],bestToOthers:[...e.bestToOthers,1],othersToWorst:[...e.othersToWorst,1]})));setScores(ms=>ms.map(row=>[...row,0]));setDirections(ds=>[...ds,'benefit']);setManualWeights(ws=>[...ws,1]);};
 const addAlternative=()=>{if(alternatives.length>=12)return;setAlternatives(as=>[...as,`${en?'Alternative':'گزینه'} ${as.length+1}`]);setScores(ms=>[...ms,Array(criteria.length).fill(0)]);};
 const run=async()=>{
  try{
   let weights:number[],diagnostics:any,judgments:any,ranking:any=undefined;
   if(method==='AHP'||method==='AHP+TOPSIS'){
    const matrices=experts.map(e=>e.matrix);const group=aggregatePairwiseMatrices(matrices);const result=ahp(group);
    if(!result.consistent){setNotice(en?'Consistency ratio exceeds 0.10. Revise judgments before accepting weights.':'نسبت ناسازگاری بیش از ۰٫۱۰ است؛ قضاوت‌ها را اصلاح کنید.');return;}
    weights=result.weights;diagnostics={lambdaMax:result.lambdaMax,ci:result.ci,cr:result.cr,consistent:result.consistent};judgments={expertMatrices:matrices,aggregatedMatrix:group};
    if(method==='AHP+TOPSIS'){ranking=topsis(scores,weights,directions);diagnostics={...diagnostics,topsis:'vector-normalized Euclidean TOPSIS'};judgments={...judgments,alternatives,scores,directions};}
   }else if(method==='BWM'){
    const agg=aggregateBwmJudgments(experts);const result=bwm(best,worst,agg.bestToOthers,agg.othersToWorst);weights=result.weights;diagnostics={xi:result.xi,bestIndex:best,worstIndex:worst,solver:'projected subgradient approximation'};judgments={expertJudgments:experts.map(e=>({name:e.name,bestToOthers:e.bestToOthers,othersToWorst:e.othersToWorst})),aggregated:agg};
   }else{
    const result=topsis(scores,manualWeights,directions);weights=result.weights;ranking=result;diagnostics={rankingMethod:'TOPSIS',normalization:'vector',idealSolution:'benefit/cost aware'};judgments={alternatives,scores,directions,manualWeights};
   }
   const snapshot=makeRankingSnapshot({method,criteria,expertCount:usesExperts?experts.length:0,weights,diagnostics,judgments});
   const saved={...snapshot,ranking};const next=[saved,...history].slice(0,100);await localStore.set('mod10-ranking-method-history:v1',next);setHistory(next);setActive(saved);setNotice(en?'Calculation version saved':'نسخه محاسبه ذخیره شد');
  }catch(error){setNotice(error instanceof Error?error.message:String(error))}
 };
 const scale=[1,2,3,4,5,6,7,8,9];
 const titles:Record<Method,string>={AHP:'AHP',BWM:'BWM',TOPSIS:'TOPSIS','AHP+TOPSIS':'AHP + TOPSIS'};
 return <section className="module-workspace-card" style={{marginTop:18}} aria-label={en?'Ranking methods':'روش‌های رتبه‌بندی'}>
  <div className="section-head"><div><h2>{en?'Multi-criteria weighting & ranking':'وزن‌دهی و رتبه‌بندی چندمعیاره'}</h2><p>{en?'AHP/BWM weight criteria; TOPSIS ranks alternatives; AHP + TOPSIS combines both stages.':'AHP و BWM وزن معیارها را تعیین می‌کنند؛ TOPSIS گزینه‌ها را رتبه‌بندی می‌کند؛ ترکیب AHP + TOPSIS هر دو مرحله را انجام می‌دهد.'}</p></div><span className="muted">{en?'Independent engine tests':'موتور محاسبات قابل آزمون مستقل'}</span></div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{(['AHP','BWM','TOPSIS','AHP+TOPSIS'] as Method[]).map(m=><button key={m} className={method===m?'primary':'secondary'} onClick={()=>setMethod(m)}>{titles[m]}</button>)}</div>
  <p className="muted">{method==='TOPSIS'?(en?'TOPSIS uses manually supplied criterion weights.':'در TOPSIS وزن معیارها را به‌صورت دستی وارد کنید.'):method==='AHP+TOPSIS'?(en?'AHP derives criterion weights from expert pairwise judgments; TOPSIS then ranks alternatives.':'در ترکیب AHP + TOPSIS ابتدا وزن معیارها از قضاوت زوجی خبرگان در AHP استخراج و سپس گزینه‌ها با TOPSIS رتبه‌بندی می‌شوند.'):method==='BWM'?(en?'BWM is a criterion-weighting method; it does not rank alternatives by itself.':'BWM روش وزن‌دهی معیارهاست و به‌تنهایی رتبه گزینه‌ها را محاسبه نمی‌کند.'): (en?'AHP derives criterion weights; use TOPSIS to rank alternatives.':'AHP وزن معیارها را محاسبه می‌کند؛ برای رتبه‌بندی گزینه‌ها از TOPSIS استفاده کنید.')}</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><b>{en?'Criteria':'معیارها'}:</b>{criteria.map((c,i)=><span key={i} className="tag">{c}</span>)}<button className="secondary-button" onClick={addCriterion} disabled={criteria.length>=8}>{en?'Add criterion':'افزودن معیار'}</button></div>
  {usesExperts&&experts.map((e,ei)=><div key={ei} style={{border:'1px solid var(--line)',borderRadius:10,padding:12,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>{e.name}</b><button className="secondary-button" onClick={()=>setExperts(es=>es.filter((_,i)=>i!==ei))} disabled={experts.length===1}>{en?'Remove':'حذف'}</button></div>
   {method==='BWM'?<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{criteria.map((c,i)=><label key={i} style={{display:'grid',gap:4}}>{en?'Best over':'برتری بهترین بر'} {c}<select value={e.bestToOthers[i]} disabled={i===best} onChange={ev=>updateExpert(ei,x=>({...x,bestToOthers:x.bestToOthers.map((v,k)=>k===i?Number(ev.target.value):v)}))}>{scale.map(v=><option key={v}>{v}</option>)}</select><small>{en?'Other over worst':'برتری '+c+' بر بدترین'}</small><select value={e.othersToWorst[i]} disabled={i===worst} onChange={ev=>updateExpert(ei,x=>({...x,othersToWorst:x.othersToWorst.map((v,k)=>k===i?Number(ev.target.value):v)}))}>{scale.map(v=><option key={v}>{v}</option>)}</select></label>)}</div>:<div style={{overflowX:'auto',marginTop:10}}><table style={{borderCollapse:'collapse',width:'100%'}}><tbody>{criteria.map((c,i)=><tr key={i}><th>{c}</th>{criteria.map((_,j)=><td key={j} style={{padding:4}}>{i===j?'1':i<j?<select aria-label={en?`${e.name} ${c} vs ${criteria[j]}`:`${e.name}: ${c} در برابر ${criteria[j]}`} value={e.matrix[i][j]} onChange={ev=>{const v=Number(ev.target.value);updateExpert(ei,x=>{const m=x.matrix.map(r=>[...r]);m[i][j]=v;m[j][i]=1/v;return {...x,matrix:m}})}}>{scale.map(v=><option key={v} value={v}>{v}</option>)}</select>:<span>{e.matrix[i][j].toFixed(3)}</span>}</td>)}</tr>)}</tbody></table><small className="muted">{en?'Saaty 1–9 scale; reciprocal entries are automatic.':'مقیاس ۱ تا ۹ ساعتی؛ مقادیر معکوس خودکار ثبت می‌شوند.'}</small></div>}
  </div>)}
  {usesExperts&&<button className="secondary-button" style={{marginTop:10}} onClick={addExpert}>{en?'Add expert':'افزودن خبره'}</button>}
  {method==='BWM'&&<div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}><label>{en?'Best criterion':'معیار بهترین'} <select value={best} onChange={e=>{const v=Number(e.target.value);setBest(v);setExperts(es=>es.map(x=>({...x,bestToOthers:x.bestToOthers.map((n,i)=>i===v?1:n)})))}}>{criteria.map((c,i)=><option value={i} key={i}>{c}</option>)}</select></label><label>{en?'Worst criterion':'معیار بدترین'} <select value={worst} onChange={e=>{const v=Number(e.target.value);setWorst(v);setExperts(es=>es.map(x=>({...x,othersToWorst:x.othersToWorst.map((n,i)=>i===v?1:n)})))}}>{criteria.map((c,i)=><option value={i} key={i}>{c}</option>)}</select></label></div>}
  {(method==='TOPSIS'||method==='AHP+TOPSIS')&&<div style={{marginTop:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><b>{en?'Alternative performance matrix':'ماتریس عملکرد گزینه‌ها'}</b><button className="secondary-button" onClick={addAlternative} disabled={alternatives.length>=12}>{en?'Add alternative':'افزودن گزینه'}</button></div><p className="muted">{en?'Enter comparable numeric values. Set each criterion as benefit (higher is better) or cost (lower is better).':'مقادیر عددی و قابل مقایسه وارد کنید. برای هر معیار مشخص کنید سود (بیشتر بهتر) است یا هزینه (کمتر بهتر).'}</p>
   <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th>{en?'Alternative':'گزینه'}</th>{criteria.map((c,j)=><th key={j}>{c}<select aria-label={en?`${c} direction`:`جهت ${c}`} value={directions[j]} onChange={e=>setDirections(ds=>ds.map((d,k)=>k===j?e.target.value as CriterionDirection:d))}><option value="benefit">{en?'Benefit':'سود'}</option><option value="cost">{en?'Cost':'هزینه'}</option></select></th>)}</tr></thead><tbody>{alternatives.map((a,i)=><tr key={i}><th><input aria-label={en?'Alternative name':'نام گزینه'} value={a} onChange={e=>setAlternatives(as=>as.map((v,k)=>k===i?e.target.value:v))}/></th>{criteria.map((_,j)=><td key={j}><input type="number" min="0" step="any" value={scores[i]?.[j]??0} onChange={e=>setScores(ms=>ms.map((row,k)=>k===i?row.map((v,l)=>l===j?Number(e.target.value):v):row))} style={{width:90}}/></td>)}</tr>)}</tbody></table></div>
  </div>}
  {method==='TOPSIS'&&<div style={{marginTop:12}}><b>{en?'Manual criterion weights':'وزن‌های دستی معیارها'}</b><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{criteria.map((c,i)=><label key={i}>{c}<input type="number" min="0" step="any" value={manualWeights[i]??0} onChange={e=>setManualWeights(ws=>ws.map((v,k)=>k===i?Number(e.target.value):v))} style={{width:90}}/></label>)}</div><small className="muted">{en?'Weights are normalized automatically.':'وزن‌ها هنگام محاسبه به‌صورت خودکار نرمال می‌شوند.'}</small></div>}
  <button className="primary" style={{marginTop:14}} onClick={()=>void run()} disabled={method==='BWM'&&best===worst}>{en?'Calculate and save version':'محاسبه و ثبت نسخه'}</button>
  {notice&&<p className="muted" role="status">{notice}</p>}
  {active&&<div style={{marginTop:14,padding:12,border:'1px solid var(--line)',borderRadius:10}}><b>{en?'Calculation result':'نتیجه محاسبه'} · {active.method}</b>{active.ranking?<ol>{active.ranking.results.map((r:any)=><li key={r.alternativeIndex}>{active.judgments.alternatives[r.alternativeIndex]}: {(r.score*100).toFixed(2)}% · {en?'Rank':'رتبه'} {r.rank}</li>)}</ol>:<ol>{active.criteria.map((c:string,i:number)=><li key={c}>{c}: {(active.weights[i]*100).toFixed(2)}%</li>)}</ol>}<small className="muted">{en?'Version':'نسخه'}: {active.createdAt} · {JSON.stringify(active.diagnostics)}</small></div>}
  <div style={{marginTop:14}}><b>{en?'Calculation history':'تاریخچه نسخه‌های محاسبه'} ({history.length})</b>{history.slice(0,5).map((s:any,i:number)=><div key={s.createdAt+i} style={{padding:8,borderBottom:'1px solid var(--line)'}}>{s.method} · {s.createdAt} · {s.expertCount} {en?'experts':'خبره'} · {s.weights.map((w:number)=>`${(w*100).toFixed(1)}%`).join(' / ')}</div>)}</div>
 </section>
}
