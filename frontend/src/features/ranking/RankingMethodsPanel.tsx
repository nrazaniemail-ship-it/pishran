import {useEffect,useState} from 'react';
import {localStore} from '../../core/storage/localStore';
import {ahp,aggregatePairwiseMatrices,aggregateBwmExpertWeights,analyzeRankingSensitivity,makeRankingSnapshot,topsis,type PairwiseMatrix,type CriterionDirection} from './rankingMethods';
type Props={language:'fa'|'en';projectId?:string;initialMethod?:Method;suggestedCriteria?:string[];suggestedAlternatives?:string[];suggestedScores?:Array<Array<number|null>>;suggestedDirections?:CriterionDirection[]};
type Method='AHP'|'BWM'|'TOPSIS'|'AHP+TOPSIS';
type Expert={name:string,matrix:PairwiseMatrix,bestIndex:number,worstIndex:number,bestToOthers:number[],othersToWorst:number[]};
const newMatrix=(n:number):PairwiseMatrix=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:1));
const initialScores=()=>[[80,7,12],[65,9,8],[90,6,15]];
export default function RankingMethodsPanel({language,projectId='unsaved',initialMethod,suggestedCriteria,suggestedAlternatives,suggestedScores,suggestedDirections}:Props){
 const en=language==='en';
 const [method,setMethod]=useState<Method>(initialMethod??'AHP');
 const [criteria,setCriteria]=useState(()=>suggestedCriteria?.length?suggestedCriteria.slice(0,8):['هزینه سرمایه‌گذاری','ریسک اجرا','زمان اجرا']);
 const initialCriterionCount=suggestedCriteria?.length||3;
 const [experts,setExperts]=useState<Expert[]>([{name:en?'Expert 1':'خبره ۱',matrix:newMatrix(initialCriterionCount),bestIndex:0,worstIndex:Math.max(0,initialCriterionCount-1),bestToOthers:Array(initialCriterionCount).fill(1),othersToWorst:Array(initialCriterionCount).fill(1)}]);
 const [alternatives,setAlternatives]=useState(()=>suggestedAlternatives?.length?suggestedAlternatives.slice(0,12):['گزینه الف','گزینه ب','گزینه ج']);
 const [scores,setScores]=useState<number[][]>(()=>suggestedScores?.length?suggestedScores.map(row=>row.map(value=>value===null?Number.NaN:value)):initialScores());
 const [directions,setDirections]=useState<CriterionDirection[]>(()=>suggestedDirections?.length?suggestedDirections.slice(0,8):['cost','benefit','cost']);
 const [manualWeights,setManualWeights]=useState(()=>suggestedCriteria?.length?Array(suggestedCriteria.slice(0,8).length).fill(1):[0.5,0.3,0.2]);
 const [notice,setNotice]=useState(''); const scoresReady=scores.length===alternatives.length&&scores.every(row=>row.length===criteria.length&&row.every(value=>Number.isFinite(value)&&value>=0)); const numericScores=scores.map(row=>row.map(value=>Number.isFinite(value)?value:0)); const [history,setHistory]=useState<any[]>([]); const [sensitivityHistory,setSensitivityHistory]=useState<any[]>([]);
 const [active,setActive]=useState<any>(null); const [sensitivity,setSensitivity]=useState<any>(null); const [shock,setShock]=useState(20);
 const [projectDraftLoaded,setProjectDraftLoaded]=useState(false);
 const methodHistoryKey='mod10-ranking-method-history:'+projectId;
 const sensitivityHistoryKey='mod10-ranking-sensitivity-history:'+projectId;
 const methodDraftKey='mod10-ranking-method-draft:'+projectId;
 useEffect(()=>{
  let alive=true;
  Promise.all([localStore.get<any>(methodDraftKey),localStore.get<any[]>(methodHistoryKey),localStore.get<any[]>(sensitivityHistoryKey)]).then(([draft,historyItems,sensitivityItems])=>{
   if(!alive)return;
   if(draft){
    if(Array.isArray(draft.criteria))setCriteria(draft.criteria);
    if(Array.isArray(draft.alternatives))setAlternatives(draft.alternatives);
    if(Array.isArray(draft.scores))setScores(draft.scores);
    if(Array.isArray(draft.directions))setDirections(draft.directions);
    if(Array.isArray(draft.manualWeights))setManualWeights(draft.manualWeights);
    if(Array.isArray(draft.experts))setExperts(draft.experts);
    if(draft.method)setMethod(draft.method);
   }
   setHistory(Array.isArray(historyItems)?historyItems:[]);
   setSensitivityHistory(Array.isArray(sensitivityItems)?sensitivityItems:[]);
   setProjectDraftLoaded(true);
  }).catch(()=>{if(alive)setProjectDraftLoaded(true)});
  return()=>{alive=false};
 },[projectId]);
 useEffect(()=>{
  if(!projectDraftLoaded)return;
  void localStore.set(methodDraftKey,{method,criteria,alternatives,scores,directions,manualWeights,experts});
 },[projectDraftLoaded,methodDraftKey,method,criteria,alternatives,scores,directions,manualWeights,experts]);
 const usesExperts=method==='AHP'||method==='BWM'||method==='AHP+TOPSIS';
 const updateExpert=(idx:number,fn:(e:Expert)=>Expert)=>setExperts(es=>es.map((e,i)=>i===idx?fn(e):e));
 const addExpert=()=>setExperts(es=>[...es,{name:`${en?'Expert':'خبره'} ${es.length+1}`,matrix:newMatrix(criteria.length),bestIndex:0,worstIndex:criteria.length-1,bestToOthers:Array(criteria.length).fill(1),othersToWorst:Array(criteria.length).fill(1)}]);
 const removeCriterion=(idx:number)=>{
  setCriteria(cs=>cs.filter((_,i)=>i!==idx));
  setExperts(es=>es.map(e=>{
   const nextLength=Math.max(0,e.matrix.length-1);
   const bestIndex=e.bestIndex===idx?0:e.bestIndex>idx?e.bestIndex-1:e.bestIndex;
   const worstIndex=e.worstIndex===idx?Math.max(0,nextLength-1):e.worstIndex>idx?e.worstIndex-1:e.worstIndex;
   return {...e,matrix:e.matrix.filter((_,i)=>i!==idx).map(row=>row.filter((_,j)=>j!==idx)),bestIndex,worstIndex,bestToOthers:e.bestToOthers.filter((_,i)=>i!==idx),othersToWorst:e.othersToWorst.filter((_,i)=>i!==idx)};
  }));
  setScores(ms=>ms.map(row=>row.filter((_,i)=>i!==idx)));
  setDirections(ds=>ds.filter((_,i)=>i!==idx));
  setManualWeights(ws=>ws.filter((_,i)=>i!==idx));
  setSensitivity(null);setActive(null);
 };
 const removeAlternative=(idx:number)=>{setAlternatives(as=>as.filter((_,i)=>i!==idx));setScores(ms=>ms.filter((_,i)=>i!==idx));setSensitivity(null);setActive(null);};
 const addCriterion=()=>{if(criteria.length>=8)return;setCriteria(cs=>[...cs,`${en?'Criterion':'معیار'} ${cs.length+1}`]);setExperts(es=>es.map(e=>({...e,matrix:[...e.matrix.map(row=>[...row,1]),Array(criteria.length+1).fill(1)],bestToOthers:[...e.bestToOthers,1],othersToWorst:[...e.othersToWorst,1]})));setScores(ms=>ms.map(row=>[...row,Number.NaN]));setDirections(ds=>[...ds,'benefit']);setManualWeights(ws=>[...ws,1]);};
 const addAlternative=()=>{if(alternatives.length>=12)return;setAlternatives(as=>[...as,`${en?'Alternative':'گزینه'} ${as.length+1}`]);setScores(ms=>[...ms,Array(criteria.length).fill(Number.NaN)]);};
 const run=async()=>{
  try{
   let weights:number[],diagnostics:any,judgments:any,ranking:any=undefined;
   if(method==='AHP'||method==='AHP+TOPSIS'){
    const matrices=experts.map(e=>e.matrix);const individual=experts.map(e=>ahp(e.matrix));const group=aggregatePairwiseMatrices(matrices);const result=ahp(group);
    if(!result.consistent){setNotice(en?'Group consistency ratio exceeds 0.10. Revise judgments before accepting weights.':'نسبت ناسازگاری گروهی بیش از ۰٫۱۰ است؛ قضاوت‌ها را اصلاح کنید.');return;}
    const individualCRs=individual.map(x=>x.cr);
    weights=result.weights;diagnostics={lambdaMax:result.lambdaMax,ci:result.ci,cr:result.cr,consistent:result.consistent,maxExpertCR:Math.max(...individualCRs),meanExpertCR:individualCRs.reduce((a,b)=>a+b,0)/individualCRs.length,inconsistentExpertCount:individualCRs.filter(v=>v>0.1).length};judgments={expertMatrices:matrices,individualExpertDiagnostics:individual.map(x=>({lambdaMax:x.lambdaMax,ci:x.ci,cr:x.cr,consistent:x.consistent})),aggregatedMatrix:group};
    if(method==='AHP+TOPSIS'){ranking=topsis(numericScores,weights,directions);diagnostics={...diagnostics,topsis:'vector-normalized Euclidean TOPSIS'};judgments={...judgments,alternatives,scores:numericScores,directions};}
   }else if(method==='BWM'){
    const result=aggregateBwmExpertWeights(experts);weights=result.weights;const xis=result.individual.map(x=>x.xi);diagnostics={maxExpertXi:Math.max(...xis),meanExpertXi:xis.reduce((a,b)=>a+b,0)/xis.length,aggregation:'geometric mean of individual expert priorities'};judgments={expertJudgments:experts.map(e=>({name:e.name,bestIndex:e.bestIndex,worstIndex:e.worstIndex,bestToOthers:e.bestToOthers,othersToWorst:e.othersToWorst})),individualResults:result.individual};
   }else{
    const result=topsis(numericScores,manualWeights,directions);weights=result.weights;ranking=result;diagnostics={rankingMethod:'TOPSIS',normalization:'vector',idealSolution:'benefit/cost aware'};judgments={alternatives,scores:numericScores,directions,manualWeights};
   }
   if(!ranking) ranking=topsis(numericScores,weights,directions);
   judgments={...judgments,alternatives,scores:numericScores,directions};
   const snapshot=makeRankingSnapshot({method,criteria,expertCount:usesExperts?experts.length:0,weights,diagnostics,judgments});
   const saved={...snapshot,ranking};const next=[saved,...history].slice(0,100);await localStore.set(methodHistoryKey,next);setHistory(next);setActive(saved);setNotice(en?'Calculation version saved':'نسخه محاسبه ذخیره شد');
  }catch(error){setNotice(error instanceof Error?error.message:String(error))}
 };
 const runSensitivity=async()=>{
  try{
   let weights:number[];let expertWeightVectors:number[][]=[];
   if(method==='AHP'||method==='AHP+TOPSIS'){
    expertWeightVectors=experts.map(e=>ahp(e.matrix).weights);
    const base=ahp(aggregatePairwiseMatrices(experts.map(e=>e.matrix)));
    if(!base.consistent) throw new Error(en?'AHP consistency ratio exceeds 0.10.':'نسبت ناسازگاری AHP بیش از ۰٫۱۰ است.');
    weights=base.weights;
   }else if(method==='BWM') {const group=aggregateBwmExpertWeights(experts);weights=group.weights;expertWeightVectors=group.individual.map(x=>x.weights);}
   else weights=topsis(numericScores,manualWeights,directions).weights;
   const cases:Array<{label:string;weights:number[]}>=[];
   const delta=shock/100;
   if(method==='AHP'||method==='AHP+TOPSIS'){
    experts.forEach((expert,expertIndex)=>{
     for(let i=0;i<criteria.length;i++) for(let j=i+1;j<criteria.length;j++) for(const sign of [-1,1]){
      const changed=expert.matrix.map(row=>[...row]);
      changed[i][j]=Math.min(9,Math.max(1/9,changed[i][j]*(1+sign*delta)));
      changed[j][i]=1/changed[i][j];
      const matrices=experts.map((e,k)=>k===expertIndex?changed:e.matrix);
      const candidate=ahp(aggregatePairwiseMatrices(matrices));
      if(candidate.consistent) cases.push({label:'AHP · '+expert.name+' · '+criteria[i]+'/'+criteria[j]+' · '+(sign<0?'−':'+')+shock+'%',weights:candidate.weights});
     }
    });
   }else if(method==='BWM'){
    experts.forEach((expert,expertIndex)=>{
     for(let j=0;j<criteria.length;j++) if(j!==expert.bestIndex&&j!==expert.worstIndex) for(const sign of [-1,1]){
      const changed=experts.map((e,k)=>k===expertIndex?{
       ...e,
       bestToOthers:e.bestToOthers.map((v,i)=>i===j?Math.min(9,Math.max(1,v*(1+sign*delta))):v),
       othersToWorst:e.othersToWorst.map((v,i)=>i===j?Math.min(9,Math.max(1,v*(1+sign*delta))):v)
      }:e);
      cases.push({label:'BWM · '+expert.name+' · '+criteria[j]+' · '+(sign<0?'−':'+')+shock+'%',weights:aggregateBwmExpertWeights(changed).weights});
     }
    });
   }else{
    for(let j=0;j<weights.length;j++) for(const sign of [-1,1]){
     const changed=weights.map((v,i)=>i===j?v*(1+sign*delta):v);
     cases.push({label:'وزن دستی · '+criteria[j]+' · '+(sign<0?'−':'+')+shock+'%',weights:changed});
    }
   }
   const result=analyzeRankingSensitivity(numericScores,weights,directions,cases,delta,{trials:500,seed:20261125,expertWeightVectors});
   setSensitivity(result);
   const record={schema:'pishran-ranking-sensitivity/v1',createdAt:new Date().toISOString(),method,criteria:[...criteria],alternatives:[...alternatives],directions:[...directions],weights:[...weights],shock:delta,trials:result.robustness.trials,seed:result.robustness.seed,expertWeightVectors:expertWeightVectors.map(v=>[...v]),expertJudgments:experts.map(e=>({name:e.name,bestIndex:e.bestIndex,worstIndex:e.worstIndex,matrix:e.matrix.map(row=>[...row]),bestToOthers:[...e.bestToOthers],othersToWorst:[...e.othersToWorst]})),performanceMatrix:numericScores.map(row=>[...row]),result};
   const next=[record,...sensitivityHistory].slice(0,50);
   await localStore.set(sensitivityHistoryKey,next);
   setSensitivityHistory(next);
   setNotice(en?'Sensitivity analysis completed and saved':'تحلیل حساسیت محاسبه و ذخیره شد');
  }catch(error){setNotice(error instanceof Error?error.message:String(error))}
 };
 const scale=[1,2,3,4,5,6,7,8,9];
 const titles:Record<Method,string>={AHP:'AHP',BWM:'BWM',TOPSIS:'TOPSIS','AHP+TOPSIS':'AHP + TOPSIS'};
 return <section className="module-workspace-card" style={{marginTop:18}} aria-label={en?'Ranking methods':'روش‌های رتبه‌بندی'}>
  <div className="section-head"><div><h2>{en?'Multi-criteria weighting & ranking':'وزن‌دهی و رتبه‌بندی چندمعیاره'}</h2><p>{en?'AHP/BWM weight criteria; TOPSIS ranks alternatives; AHP + TOPSIS combines both stages.':'AHP و BWM وزن معیارها را تعیین می‌کنند؛ TOPSIS گزینه‌ها را رتبه‌بندی می‌کند؛ ترکیب AHP + TOPSIS هر دو مرحله را انجام می‌دهد.'}</p></div><span className="muted">{en?'Independent engine tests':'موتور محاسبات قابل آزمون مستقل'}</span></div>
  <div className="ranking-method-tabs" role="group" aria-label={en?'Advanced ranking methods':'روش‌های پیشرفته رتبه‌بندی'}>{(['AHP','BWM','TOPSIS','AHP+TOPSIS'] as Method[]).map(m=><button key={m} type="button" data-method={m} aria-label={titles[m]} aria-pressed={method===m} className={`ranking-method-tab ranking-method-tab--${m.toLowerCase().replace('+','-')} ${method===m?'is-active':''}`} onClick={()=>setMethod(m)}><span className="ranking-method-tab__name">{titles[m]}</span><span className="ranking-method-tab__state">{method===m?(en?'Selected':'فعال'):(en?'Open':'انتخاب')}</span></button>)}</div>
  <p className="muted">{method==='TOPSIS'?(en?'TOPSIS uses manually supplied criterion weights.':'در TOPSIS وزن معیارها را به‌صورت دستی وارد کنید.'):method==='AHP+TOPSIS'?(en?'AHP derives criterion weights from expert pairwise judgments; TOPSIS then ranks alternatives.':'در ترکیب AHP + TOPSIS ابتدا وزن معیارها از قضاوت زوجی خبرگان در AHP استخراج و سپس گزینه‌ها با TOPSIS رتبه‌بندی می‌شوند.'):method==='BWM'?(en?'BWM is a criterion-weighting method; it does not rank alternatives by itself.':'BWM روش وزن‌دهی معیارهاست و به‌تنهایی رتبه گزینه‌ها را محاسبه نمی‌کند.'): (en?'AHP derives criterion weights; use TOPSIS to rank alternatives.':'AHP وزن معیارها را محاسبه می‌کند؛ برای رتبه‌بندی گزینه‌ها از TOPSIS استفاده کنید.')}</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><b>{en?'Criteria':'معیارها'}:</b>{criteria.map((c,i)=><span key={i} className="tag" style={{display:'inline-flex',alignItems:'center',gap:6}}>{c}<button type="button" className="secondary-button" aria-label={en?`Remove criterion ${c}`:`حذف معیار ${c}`} title={en?'Remove criterion':'حذف معیار'} onClick={()=>removeCriterion(i)} style={{padding:'2px 6px',minWidth:0}}>×</button></span>)}<button className="secondary-button" onClick={addCriterion} disabled={criteria.length>=8}>{en?'Add criterion':'افزودن معیار'}</button></div>
  {usesExperts&&experts.map((e,ei)=><div key={ei} style={{border:'1px solid var(--line)',borderRadius:10,padding:12,marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>{e.name}</b><button className="secondary-button" onClick={()=>setExperts(es=>es.filter((_,i)=>i!==ei))} disabled={experts.length===1}>{en?'Remove':'حذف'}</button></div>
   {method==='BWM'?<><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}><label>{en?'Best criterion':'معیار بهترین'}<select aria-label={en?`${e.name} best criterion`:`${e.name} معیار بهترین`} value={e.bestIndex} onChange={ev=>{const v=Number(ev.target.value);updateExpert(ei,x=>({...x,bestIndex:v,bestToOthers:x.bestToOthers.map((n,i)=>i===v?1:n)}))}}>{criteria.map((c,i)=><option value={i} key={i}>{c}</option>)}</select></label><label>{en?'Worst criterion':'معیار بدترین'}<select aria-label={en?`${e.name} worst criterion`:`${e.name} معیار بدترین`} value={e.worstIndex} onChange={ev=>{const v=Number(ev.target.value);updateExpert(ei,x=>({...x,worstIndex:v,othersToWorst:x.othersToWorst.map((n,i)=>i===v?1:n)}))}}>{criteria.map((c,i)=><option value={i} key={i}>{c}</option>)}</select></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:10}}>{criteria.map((c,i)=><label key={i} style={{display:'grid',gap:4}}>{en?'Best over':'برتری بهترین بر'} {c}<select aria-label={en?`Best over ${c}`:`برتری بهترین بر ${c}`} value={e.bestToOthers[i]} disabled={i===e.bestIndex} onChange={ev=>updateExpert(ei,x=>({...x,bestToOthers:x.bestToOthers.map((v,k)=>k===i?Number(ev.target.value):v)}))}>{scale.map(v=><option key={v}>{v}</option>)}</select><small>{en?'Other over worst':'برتری '+c+' بر بدترین'}</small><select aria-label={en?`Other over worst ${c}`:`برتری ${c} بر بدترین`} value={e.othersToWorst[i]} disabled={i===e.worstIndex} onChange={ev=>updateExpert(ei,x=>({...x,othersToWorst:x.othersToWorst.map((v,k)=>k===i?Number(ev.target.value):v)}))}>{scale.map(v=><option key={v}>{v}</option>)}</select></label>)}</div></>:<div style={{overflowX:'auto',marginTop:10}}><table style={{borderCollapse:'collapse',width:'100%'}}><tbody>{criteria.map((c,i)=><tr key={i}><th>{c}</th>{criteria.map((_,j)=><td key={j} style={{padding:4}}>{i===j?'1':i<j?<select aria-label={en?`${e.name} ${c} vs ${criteria[j]}`:`${e.name}: ${c} در برابر ${criteria[j]}`} value={e.matrix[i][j]} onChange={ev=>{const v=Number(ev.target.value);updateExpert(ei,x=>{const m=x.matrix.map(r=>[...r]);m[i][j]=v;m[j][i]=1/v;return {...x,matrix:m}})}}>{scale.map(v=><option key={v} value={v}>{v}</option>)}</select>:<span>{e.matrix[i][j].toFixed(3)}</span>}</td>)}</tr>)}</tbody></table><small className="muted">{en?'Saaty 1–9 scale; reciprocal entries are automatic.':'مقیاس ۱ تا ۹ ساعتی؛ مقادیر معکوس خودکار ثبت می‌شوند.'}</small></div>}
  </div>)}
  {usesExperts&&<button className="secondary-button" style={{marginTop:10}} onClick={addExpert} disabled={criteria.length<2}>{en?'Add expert':'افزودن خبره'}</button>}
  <div style={{marginTop:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><b>{en?'Alternative performance matrix':'ماتریس عملکرد گزینه‌ها'}</b><button className="secondary-button" onClick={addAlternative} disabled={alternatives.length>=12}>{en?'Add alternative':'افزودن گزینه'}</button></div><p className="muted">{en?'Enter comparable numeric values. Set each criterion as benefit (higher is better) or cost (lower is better).':'مقادیر عددی و قابل مقایسه وارد کنید. برای هر معیار مشخص کنید سود (بیشتر بهتر) است یا هزینه (کمتر بهتر).'}</p>
   <div className="ranking-performance-matrix" style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th>{en?'Alternative':'گزینه'}</th>{criteria.map((c,j)=><th key={j}>{c}<select aria-label={en?`${c} direction`:`جهت ${c}`} value={directions[j]} onChange={e=>setDirections(ds=>ds.map((d,k)=>k===j?e.target.value as CriterionDirection:d))}><option value="benefit">{en?'Benefit':'سود'}</option><option value="cost">{en?'Cost':'هزینه'}</option></select></th>)}<th>{en?'Actions':'عملیات'}</th></tr></thead><tbody>{alternatives.map((a,i)=><tr key={i}><th><input aria-label={en?'Alternative name':'نام گزینه'} value={a} onChange={e=>setAlternatives(as=>as.map((v,k)=>k===i?e.target.value:v))}/></th>{criteria.map((_,j)=><td key={j}><input type="number" min="0" step="any" aria-label={en?`${a}, ${criteria[j]} score`:`امتیاز ${criteria[j]} برای ${a}`} value={Number.isFinite(scores[i]?.[j])?scores[i][j]:''} onChange={e=>setScores(ms=>ms.map((row,k)=>k===i?row.map((v,l)=>l===j?(e.target.value===''?Number.NaN:Number(e.target.value)):v):row))} style={{width:90}}/></td>)}<td><button type="button" className="secondary-button" aria-label={en?`Remove alternative ${a}`:`حذف گزینه ${a}`} onClick={()=>removeAlternative(i)}>{en?'Remove':'حذف'}</button></td></tr>)}</tbody></table></div>
  </div>
  {method==='TOPSIS'&&<div style={{marginTop:12}}><b>{en?'Manual criterion weights':'وزن‌های دستی معیارها'}</b><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{criteria.map((c,i)=><label key={i}>{c}<input aria-label={en?c+' manual weight':'وزن دستی '+c} type="number" min="0" step="any" value={manualWeights[i]??0} onChange={e=>setManualWeights(ws=>ws.map((v,k)=>k===i?Number(e.target.value):v))} style={{width:90}}/></label>)}</div><small className="muted">{en?'Weights are normalized automatically.':'وزن‌ها هنگام محاسبه به‌صورت خودکار نرمال می‌شوند.'}</small></div>}
  <div style={{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap',marginTop:14}}>
   <label>{en?'Sensitivity shock (%)':'دامنه تغییر حساسیت (%)'}<input aria-label={en?'Sensitivity shock percentage':'درصد تغییر حساسیت'} type="number" min="0" max="90" step="5" value={shock} onChange={e=>setShock(Math.max(0,Math.min(90,Number(e.target.value)||0)))}/></label>
   <button className="primary" onClick={()=>void run()} disabled={!scoresReady||criteria.length<2||alternatives.length<2||(method==='BWM'&&experts.some(e=>e.bestIndex===e.worstIndex))}>{en?'Calculate and save version':'محاسبه و ثبت نسخه'}</button>
   <button className="secondary-button" onClick={runSensitivity} disabled={!scoresReady||criteria.length<2||alternatives.length<2||(method==='BWM'&&experts.some(e=>e.bestIndex===e.worstIndex))}>{en?'Run rank sensitivity':'اجرای تحلیل حساسیت رتبه‌ها'}</button>
  </div>
  {sensitivity&&<div data-testid="ranking-sensitivity-results" style={{marginTop:14,padding:12,border:'1px solid var(--line)',borderRadius:10}}>
   <b>{en?'Rank sensitivity summary':'خلاصه تحلیل حساسیت رتبه‌ها'}</b>
   <p className="muted">{en?'Baseline ranking is compared with criterion-weight shifts, expert-judgment perturbations and optimistic/pessimistic performance scenarios.':'رتبه پایه با تغییر وزن معیارها، تغییر قضاوت خبرگان و سناریوهای خوش‌بینانه و بدبینانه مقایسه شده است.'} · {en?'Scenarios':'سناریوها'}: {sensitivity.scenarios.length}</p>
   <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th>{en?'Alternative':'گزینه'}</th><th>{en?'Scenario avg. rank':'میانگین رتبه سناریو'}</th><th>{en?'Rank range':'دامنه رتبه'}</th><th>{en?'Scenario top frequency':'فراوانی رتبه اول'}</th><th>{en?'Monte Carlo top probability':'احتمال رتبه اول در شبیه‌سازی'}</th><th>{en?'Score P05–P95':'بازه امتیاز ۵–۹۵٪'}</th></tr></thead><tbody>{sensitivity.summary.map((r:any)=><tr key={r.alternativeIndex}><th>{alternatives[r.alternativeIndex]}</th><td>{r.averageRank.toFixed(2)}</td><td>{r.bestRank}–{r.worstRank}</td><td>{(r.topFrequency*100).toFixed(1)}%</td><td>{(sensitivity.robustness.topFrequency[r.alternativeIndex]*100).toFixed(1)}%</td><td>{sensitivity.robustness.scoreP05[r.alternativeIndex].toFixed(3)}–{sensitivity.robustness.scoreP95[r.alternativeIndex].toFixed(3)}</td></tr>)}</tbody></table></div>
   <p className="muted">{en?`Deterministic Monte Carlo: ${sensitivity.robustness.trials} trials · seed ${sensitivity.robustness.seed}. Top-rank probability and score percentile range measure robustness under simultaneous weight and performance uncertainty.`:`شبیه‌سازی مونت‌کارلو با ${sensitivity.robustness.trials} تکرار و بذر ${sensitivity.robustness.seed}؛ احتمال رتبه اول و بازه صدکی امتیاز، پایداری تصمیم را تحت عدم‌قطعیت هم‌زمان وزن‌ها و عملکرد گزینه‌ها نشان می‌دهد.`}</p>
   <details style={{marginTop:8}}><summary>{en?'Rank acceptability by position':'فراوانی پذیرش هر رتبه'}</summary><div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th>{en?'Alternative':'گزینه'}</th><th>{en?'Rank':'رتبه'}</th><th>{en?'Frequency':'فراوانی'}</th></tr></thead><tbody>{sensitivity.robustness.rankAcceptability.filter((r:any)=>r.frequency>0).map((r:any)=><tr key={r.alternativeIndex+'-'+r.rank}><th>{alternatives[r.alternativeIndex]}</th><td>{r.rank}</td><td>{(r.frequency*100).toFixed(1)}%</td></tr>)}</tbody></table></div></details>
   {sensitivity.expertAgreement&&<div style={{marginTop:8}}><b>{en?'Expert agreement & disagreement':'توافق و اختلاف خبرگان'}</b><p>{en?'Mean pairwise Spearman rank agreement':'میانگین همبستگی رتبه‌ای اسپیرمن بین خبرگان'}: {sensitivity.expertAgreement.meanPairwiseSpearman===null?'—':sensitivity.expertAgreement.meanPairwiseSpearman.toFixed(3)} · {en?'Experts':'تعداد خبرگان'}: {sensitivity.expertAgreement.expertCount}</p><div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th>{en?'Criterion':'معیار'}</th><th>{en?'Mean weight':'میانگین وزن'}</th><th>{en?'Std. dev.':'انحراف معیار'}</th><th>{en?'CV':'ضریب تغییرات'}</th></tr></thead><tbody>{sensitivity.expertAgreement.criterionDispersion.map((r:any)=><tr key={r.criterionIndex}><th>{criteria[r.criterionIndex]}</th><td>{(r.meanWeight*100).toFixed(2)}%</td><td>{(r.standardDeviation*100).toFixed(2)}%</td><td>{(r.coefficientOfVariation*100).toFixed(1)}%</td></tr>)}</tbody></table></div></div>}
   <details style={{marginTop:8}}><summary>{en?'Scenario comparison':'مقایسه سناریوها'}</summary>{sensitivity.scenarios.map((s:any,i:number)=><div key={i} style={{padding:6,borderBottom:'1px solid var(--line)'}}>{s.kind} · {s.label} · {s.ranking.results.map((r:any)=>`${alternatives[r.alternativeIndex]}: #${r.rank}`).join(' / ')}</div>)}</details>
  </div>}
  {notice&&<p className="muted" role="status">{notice}</p>}
  {active&&<div style={{marginTop:14,padding:12,border:'1px solid var(--line)',borderRadius:10}}><b>{en?'Calculation result':'نتیجه محاسبه'} · {active.method}</b>{active.ranking?<ol>{active.ranking.results.map((r:any)=><li key={r.alternativeIndex}>{active.judgments.alternatives[r.alternativeIndex]}: {(r.score*100).toFixed(2)}% · {en?'Rank':'رتبه'} {r.rank}</li>)}</ol>:<ol>{active.criteria.map((c:string,i:number)=><li key={c}>{c}: {(active.weights[i]*100).toFixed(2)}%</li>)}</ol>}<small className="muted">{en?'Version':'نسخه'}: {active.createdAt} · {JSON.stringify(active.diagnostics)}</small></div>}
  <div style={{marginTop:14}}><b>{en?'Calculation history':'تاریخچه نسخه‌های محاسبه'} ({history.length})</b>{history.slice(0,5).map((s:any,i:number)=><div key={s.createdAt+i} style={{padding:8,borderBottom:'1px solid var(--line)'}}>{s.method} · {s.createdAt} · {s.expertCount} {en?'experts':'خبره'} · {s.weights.map((w:number)=>`${(w*100).toFixed(1)}%`).join(' / ')}</div>)}</div>
  <div style={{marginTop:14}}><b>{en?'Sensitivity history':'تاریخچه تحلیل حساسیت'} ({sensitivityHistory.length})</b>{sensitivityHistory.slice(0,5).map((s:any,i:number)=><details className="ranking-sensitivity-history-entry" key={s.createdAt+i} style={{padding:8,borderBottom:'1px solid var(--line)'}}><summary>{s.method} · {s.createdAt} · {en?'Shock':'دامنه تغییر'} {(s.shock*100).toFixed(0)}% · {s.trials} {en?'trials':'تکرار'} · {en?'seed':'بذر'} {s.seed}</summary><p className="muted">{en?'Persisted Monte Carlo robustness and rank acceptability':'پایداری مونت‌کارلو و فراوانی پذیرش رتبه ذخیره‌شده'}</p><div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr><th>{en?'Alternative':'گزینه'}</th><th>{en?'Average rank':'میانگین رتبه'}</th><th>{en?'Top probability':'احتمال رتبه اول'}</th><th>{en?'Score P05–P95':'بازه امتیاز ۵–۹۵٪'}</th></tr></thead><tbody>{s.result.robustness.topFrequency.map((v:number,j:number)=><tr key={j}><th>{s.alternatives[j]}</th><td>{s.result.robustness.averageRank[j].toFixed(2)}</td><td>{(v*100).toFixed(1)}%</td><td>{s.result.robustness.scoreP05[j].toFixed(3)}–{s.result.robustness.scoreP95[j].toFixed(3)}</td></tr>)}</tbody></table></div><small className="muted">{en?'Rank scenarios':'سناریوهای رتبه'}: {s.result.scenarios.length} · {en?'Expert count':'تعداد خبرگان'}: {s.expertWeightVectors.length}</small></details>)}</div>
 </section>
}
