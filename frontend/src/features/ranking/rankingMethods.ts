export type PairwiseMatrix = number[][];
export type RankingSnapshot = {
  schema: 'pishran-ranking-snapshot/v1';
  method: 'TOPSIS' | 'AHP+TOPSIS' | 'BWM+TOPSIS' | 'TOPSIS+(AHP+BWM)';
  createdAt: string;
  criteria: string[];
  expertCount: number;
  weights: number[];
  diagnostics: Record<string, number | string | boolean>;
  judgments: unknown;
};
const RI: Record<number, number> = {1:0,2:0,3:0.58,4:0.90,5:1.12,6:1.24,7:1.32,8:1.41,9:1.45,10:1.49,11:1.51,12:1.48,13:1.56,14:1.57,15:1.59};
const assert = (condition: boolean, message: string): void => { if (!condition) throw new Error(message); };
const normalize = (values: number[]) => { const sum=values.reduce((a,b)=>a+b,0); assert(Number.isFinite(sum)&&sum>0,'Weights must have a positive finite sum'); return values.map(v=>v/sum); };
const geometricMean = (values:number[]) => Math.exp(values.reduce((s,v)=>s+Math.log(v),0)/values.length);
export function validatePairwiseMatrix(matrix: PairwiseMatrix): void {
 const n=matrix.length; assert(n>=2,'AHP requires at least two criteria');
 assert(matrix.every(row=>Array.isArray(row)&&row.length===n),'Pairwise matrix must be square');
 for(let i=0;i<n;i++) for(let j=0;j<n;j++) {
  const v=matrix[i][j]; assert(Number.isFinite(v)&&v>0,'Judgments must be positive finite numbers');
  assert(Math.abs(matrix[i][j]*matrix[j][i]-1)<1e-8,'Matrix must be reciprocal');
  if(i===j) assert(Math.abs(v-1)<1e-8,'Diagonal judgments must equal 1');
  if(i<j) assert(v>=1/9-1e-8&&v<=9+1e-8,'Saaty judgments must be between 1/9 and 9');
 }
}
export function ahp(matrix:PairwiseMatrix) {
 validatePairwiseMatrix(matrix); const n=matrix.length;
 const weights=normalize(matrix.map(row=>geometricMean(row)));
 const aw=matrix.map(row=>row.reduce((s,v,j)=>s+v*weights[j],0));
 const lambdaMax=aw.reduce((s,v,i)=>s+v/weights[i],0)/n;
 const ci=n<=2?0:(lambdaMax-n)/(n-1); const ri=RI[n]??1.59; const cr=ri===0?0:ci/ri;
 return {weights,lambdaMax,ci,cr,consistent:cr<=0.1+1e-12};
}
export function aggregatePairwiseMatrices(matrices:PairwiseMatrix[]):PairwiseMatrix {
 assert(matrices.length>0,'At least one expert matrix is required');
 matrices.forEach(validatePairwiseMatrix); const n=matrices[0].length;
 assert(matrices.every(m=>m.length===n),'All experts must assess the same criteria');
 return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>geometricMean(matrices.map(m=>m[i][j]))));
}
export function aggregateBwmJudgments(experts:Array<{bestToOthers:number[];othersToWorst:number[]}>){
 assert(experts.length>0,'At least one expert is required');
 const n=experts[0].bestToOthers.length; assert(n>=2,'BWM requires at least two criteria');
 experts.forEach(e=>{assert(e.bestToOthers.length===n&&e.othersToWorst.length===n,'Experts must assess the same criteria');[...e.bestToOthers,...e.othersToWorst].forEach(v=>assert(Number.isFinite(v)&&v>=1&&v<=9,'BWM judgments must be on the 1–9 scale'));});
 return {bestToOthers:Array.from({length:n},(_,i)=>geometricMean(experts.map(e=>e.bestToOthers[i]))),othersToWorst:Array.from({length:n},(_,i)=>geometricMean(experts.map(e=>e.othersToWorst[i])))};
}
// Two-phase simplex solver for the BWM minimax linear program.
// Maximizes c·x subject to A·x <= b and x >= 0.
class LinearProgram {
 private readonly m:number; private readonly n:number;
 private readonly basis:number[]; private readonly nonBasis:number[];
 private readonly tableau:number[][];
 constructor(A:number[][],b:number[],c:number[]){
  this.m=b.length;this.n=c.length;
  this.basis=Array(this.m);this.nonBasis=Array(this.n+1);
  this.tableau=Array.from({length:this.m+2},()=>Array(this.n+2).fill(0));
  for(let i=0;i<this.m;i++)for(let j=0;j<this.n;j++)this.tableau[i][j]=A[i][j];
  for(let i=0;i<this.m;i++){this.basis[i]=this.n+i;this.tableau[i][this.n]=-1;this.tableau[i][this.n+1]=b[i];}
  for(let j=0;j<this.n;j++){this.nonBasis[j]=j;this.tableau[this.m][j]=-c[j];}
  this.nonBasis[this.n]=-1;this.tableau[this.m+1][this.n]=1;
 }
 private pivot(row:number,column:number){
  const inverse=1/this.tableau[row][column];
  for(let i=0;i<this.m+2;i++)if(i!==row)for(let j=0;j<this.n+2;j++)if(j!==column)this.tableau[i][j]-=this.tableau[row][j]*this.tableau[i][column]*inverse;
  for(let j=0;j<this.n+2;j++)if(j!==column)this.tableau[row][j]*=inverse;
  for(let i=0;i<this.m+2;i++)if(i!==row)this.tableau[i][column]*=-inverse;
  this.tableau[row][column]=inverse;
  const swap=this.basis[row];this.basis[row]=this.nonBasis[column];this.nonBasis[column]=swap;
 }
 private simplex(phase:1|2):boolean{
  const objective=phase===1?this.m+1:this.m;
  const eps=1e-10;
  for(let iteration=0;iteration<100000;iteration++){
   let column=-1;
   for(let j=0;j<=this.n;j++){
    if(phase===2&&this.nonBasis[j]===-1)continue;
    if(column===-1||this.tableau[objective][j]<this.tableau[objective][column]-eps||
      (Math.abs(this.tableau[objective][j]-this.tableau[objective][column])<=eps&&this.nonBasis[j]<this.nonBasis[column]))column=j;
   }
   if(column===-1||this.tableau[objective][column]>=-eps)return true;
   let row=-1;
   for(let i=0;i<this.m;i++){
    if(this.tableau[i][column]<=eps)continue;
    if(row===-1)row=i;
    else{
     const left=this.tableau[i][this.n+1]/this.tableau[i][column];
     const right=this.tableau[row][this.n+1]/this.tableau[row][column];
     if(left<right-eps||(Math.abs(left-right)<=eps&&this.basis[i]<this.basis[row]))row=i;
    }
   }
   if(row===-1)return false;
   this.pivot(row,column);
  }
  throw new Error('BWM linear-program solver exceeded its pivot limit');
 }
 solve():{solution:number[];objective:number}{
  const eps=1e-9;
  let row=0;
  for(let i=1;i<this.m;i++)if(this.tableau[i][this.n+1]<this.tableau[row][this.n+1])row=i;
  if(this.tableau[row][this.n+1]<-eps){
   this.pivot(row,this.n);
   if(!this.simplex(1)||this.tableau[this.m+1][this.n+1]<-eps)throw new Error('BWM minimax problem is infeasible');
   if(Math.abs(this.tableau[this.m+1][this.n+1])>eps)throw new Error('BWM minimax problem is infeasible');
   const artificialRow=this.basis.indexOf(-1);
   if(artificialRow!==-1){
    let column=0;
    for(let j=1;j<=this.n;j++)if(this.tableau[artificialRow][j]<this.tableau[artificialRow][column]-eps||
      (Math.abs(this.tableau[artificialRow][j]-this.tableau[artificialRow][column])<=eps&&this.nonBasis[j]<this.nonBasis[column]))column=j;
    this.pivot(artificialRow,column);
   }
  }
  if(!this.simplex(2))throw new Error('BWM minimax problem is unexpectedly unbounded');
  const solution=Array(this.n).fill(0);
  for(let i=0;i<this.m;i++)if(this.basis[i]<this.n)solution[this.basis[i]]=this.tableau[i][this.n+1];
  return{solution,objective:this.tableau[this.m][this.n+1]};
 }
}

export function bwm(bestIndex:number,worstIndex:number,bestToOthers:number[],othersToWorst:number[]) {
 const n=bestToOthers.length;
 assert(n>=2&&othersToWorst.length===n,'BWM vectors must have equal length ≥ 2');
 assert(Number.isInteger(bestIndex)&&bestIndex>=0&&bestIndex<n&&Number.isInteger(worstIndex)&&worstIndex>=0&&worstIndex<n&&bestIndex!==worstIndex,'Best and worst criteria must be distinct valid indices');
 [...bestToOthers,...othersToWorst].forEach(v=>assert(Number.isFinite(v)&&v>=1&&v<=9,'BWM judgments must be on the 1–9 scale'));
 assert(Math.abs(bestToOthers[bestIndex]-1)<1e-9&&Math.abs(othersToWorst[worstIndex]-1)<1e-9,'Best-to-best and worst-to-worst judgments must equal 1');
 // Exact BWM minimax model: minimize xi subject to both absolute
 // best-to-others and others-to-worst deviations being <= xi, sum(w)=1.
 const variableCount=n+1, xiIndex=n;
 const A:number[][]=[], b:number[]=[];
 const addAbs=(left:number[])=>{
  const upper=Array(variableCount).fill(0);
  left.forEach((v,i)=>upper[i]+=v);upper[xiIndex]=-1;A.push(upper);b.push(0);
  const lower=Array(variableCount).fill(0);
  left.forEach((v,i)=>lower[i]-=v);lower[xiIndex]=-1;A.push(lower);b.push(0);
 };
 for(let j=0;j<n;j++)if(j!==bestIndex){const terms=Array(n).fill(0);terms[bestIndex]=1;terms[j]-=bestToOthers[j];addAbs(terms);}
 for(let j=0;j<n;j++)if(j!==worstIndex){const terms=Array(n).fill(0);terms[j]=1;terms[worstIndex]-=othersToWorst[j];addAbs(terms,[]);}
 A.push([...Array(n).fill(1),0]);b.push(1);
 A.push([...Array(n).fill(-1),0]);b.push(-1);
 const objective=Array(variableCount).fill(0);objective[xiIndex]=-1;
 const solved=new LinearProgram(A,b,objective).solve();
 const weights=normalize(solved.solution.slice(0,n).map(v=>Math.max(0,v)));
 const xi=Math.max(
  ...bestToOthers.map((a,j)=>Math.abs(weights[bestIndex]-a*weights[j])),
  ...othersToWorst.map((a,j)=>Math.abs(weights[j]-a*weights[worstIndex]))
 );
 return{weights,xi,bestIndex,worstIndex};
}

export type BwmExpertJudgment = {
 bestIndex:number;
 worstIndex:number;
 bestToOthers:number[];
 othersToWorst:number[];
};
export function aggregateBwmExpertWeights(experts:BwmExpertJudgment[]) {
 assert(experts.length>0,'At least one BWM expert is required');
 const individual=experts.map(e=>bwm(e.bestIndex,e.worstIndex,e.bestToOthers,e.othersToWorst));
 const criteriaCount=individual[0].weights.length;
 assert(individual.every(r=>r.weights.length===criteriaCount),'All BWM experts must assess the same criteria');
 const weights=normalize(Array.from({length:criteriaCount},(_,i)=>geometricMean(individual.map(r=>r.weights[i]))));
 return {weights,individual};
}


export function combineAHPBWMWeights(ahpWeights:number[],bwmWeights:number[],ahpShare=0.5){
 assert(ahpWeights.length>=2&&ahpWeights.length===bwmWeights.length,'AHP and BWM weights must have the same criteria count');
 assert(Number.isFinite(ahpShare)&&ahpShare>=0&&ahpShare<=1,'AHP share must be between 0 and 1');
 [...ahpWeights,...bwmWeights].forEach(v=>assert(Number.isFinite(v)&&v>0,'AHP and BWM weights must be positive finite values'));
 return normalize(ahpWeights.map((v,i)=>v**ahpShare*bwmWeights[i]**(1-ahpShare)));
}
export type CriterionDirection = 'benefit' | 'cost';
export function topsis(matrix:number[][], weights:number[], directions:CriterionDirection[]) {
 const rows=matrix.length, cols=weights.length;
 assert(rows>=2,'TOPSIS requires at least two alternatives');
 assert(cols>=2&&matrix.every(row=>row.length===cols),'Performance matrix must have at least two criteria and be rectangular');
 assert(directions.length===cols&&directions.every(d=>d==='benefit'||d==='cost'),'A valid benefit/cost direction is required for every criterion');
 matrix.forEach(row=>row.forEach(v=>assert(Number.isFinite(v)&&v>=0,'TOPSIS performance values must be finite and non-negative')));
 assert(weights.length===cols&&weights.every(v=>Number.isFinite(v)&&v>=0),'TOPSIS weights must be finite, non-negative and match criteria');
 const normalizedWeights=normalize(weights);
 const norms=Array.from({length:cols},(_,j)=>Math.sqrt(matrix.reduce((sum,row)=>sum+row[j]**2,0)));
 assert(norms.every(v=>v>0&&Number.isFinite(v)),'Each TOPSIS criterion must contain at least one non-zero value');
 const weighted=matrix.map(row=>row.map((v,j)=>v/norms[j]*normalizedWeights[j]));
 const idealBest=Array.from({length:cols},(_,j)=>directions[j]==='benefit'?Math.max(...weighted.map(r=>r[j])):Math.min(...weighted.map(r=>r[j])));
 const idealWorst=Array.from({length:cols},(_,j)=>directions[j]==='benefit'?Math.min(...weighted.map(r=>r[j])):Math.max(...weighted.map(r=>r[j])));
 const results=weighted.map((row,index)=>{
  const positiveDistance=Math.sqrt(row.reduce((sum,v,j)=>sum+(v-idealBest[j])**2,0));
  const negativeDistance=Math.sqrt(row.reduce((sum,v,j)=>sum+(v-idealWorst[j])**2,0));
  const score=positiveDistance+negativeDistance===0?0.5:negativeDistance/(positiveDistance+negativeDistance);
  return {alternativeIndex:index,score,positiveDistance,negativeDistance};
 });
 const ranked=[...results].sort((a,b)=>b.score-a.score).map((r,index)=>({...r,rank:index+1}));
 return {weights:normalizedWeights,normalizedMatrix:weighted,idealBest,idealWorst,results:ranked};
}

export function makeRankingSnapshot(input:Omit<RankingSnapshot,'schema'|'createdAt'>,createdAt=new Date().toISOString()):RankingSnapshot {
 assert(input.criteria.length===input.weights.length,'Snapshot criteria and weights do not match');
 assert(input.weights.every(v=>Number.isFinite(v)&&v>=0),'Snapshot weights must be finite and non-negative');
 return {schema:'pishran-ranking-snapshot/v1',createdAt,...input};
}


export type RankingSensitivityCase = { label:string; weights:number[] };
export type RankingSensitivityResult = {
 baseline:ReturnType<typeof topsis>;
 scenarios:Array<{label:string;kind:'weight'|'expert'|'optimistic'|'pessimistic';ranking:ReturnType<typeof topsis>}>;
 summary:Array<{alternativeIndex:number;averageRank:number;bestRank:number;worstRank:number;topCount:number;topFrequency:number}>;
 robustness:{trials:number;seed:number;topFrequency:number[];averageRank:number[];rankStdDev:number[];scoreP05:number[];scoreP95:number[];rankAcceptability:Array<{alternativeIndex:number;rank:number;frequency:number}>};
 expertAgreement?:{expertCount:number;meanPairwiseSpearman:number|null;criterionDispersion:Array<{criterionIndex:number;meanWeight:number;standardDeviation:number;coefficientOfVariation:number}>};
 shock:number;
};
export type RankingSensitivityOptions={trials?:number;seed?:number;expertWeightVectors?:number[][]};
function seededRandom(seed:number){let state=seed>>>0;return()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function percentile(values:number[],p:number){const sorted=[...values].sort((a,b)=>a-b);const index=(sorted.length-1)*p;const lo=Math.floor(index),hi=Math.ceil(index);return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);}
function rankVector(result:ReturnType<typeof topsis>,count:number){const ranks=Array(count).fill(0);result.results.forEach(r=>ranks[r.alternativeIndex]=r.rank);return ranks;}
function averageRanks(values:number[]){const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const ranks=Array(values.length).fill(0);for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].value===order[i].value)j++;const average=(i+1+j)/2;for(let k=i;k<j;k++)ranks[order[k].index]=average;i=j;}return ranks;}
function spearman(a:number[],b:number[]){const n=a.length;if(n<2)return 1;const ra=averageRanks(a),rb=averageRanks(b);const ma=ra.reduce((x,y)=>x+y,0)/n,mb=rb.reduce((x,y)=>x+y,0)/n;let numerator=0,da=0,db=0;for(let i=0;i<n;i++){const x=ra[i]-ma,y=rb[i]-mb;numerator+=x*y;da+=x*x;db+=y*y;}return da===0||db===0?1:numerator/Math.sqrt(da*db);}
function summarizeExpertAgreement(vectors:number[][]):RankingSensitivityResult['expertAgreement']{
 if(vectors.length===0)return undefined;
 const n=vectors[0].length;
 assert(vectors.every(v=>v.length===n&&v.every(x=>Number.isFinite(x)&&x>=0)),'Expert weight vectors must have matching finite non-negative values');
 const ranks=vectors.map(v=>{const order=v.map((x,i)=>({x,i})).sort((a,b)=>b.x-a.x);const r=Array(n).fill(0);order.forEach((x,i)=>r[x.i]=i+1);return r;});
 const correlations:number[]=[];for(let i=0;i<ranks.length;i++)for(let j=i+1;j<ranks.length;j++)correlations.push(spearman(ranks[i],ranks[j]));
 const dispersion=Array.from({length:n},(_,j)=>{const values=vectors.map(v=>v[j]);const mean=values.reduce((a,b)=>a+b,0)/values.length;const sd=Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length);return{criterionIndex:j,meanWeight:mean,standardDeviation:sd,coefficientOfVariation:mean===0?0:sd/mean};});
 return{expertCount:vectors.length,meanPairwiseSpearman:correlations.length?correlations.reduce((a,b)=>a+b,0)/correlations.length:null,criterionDispersion:dispersion};
}
export function analyzeRankingSensitivity(
 scores:number[][],
 weights:number[],
 directions:CriterionDirection[],
 expertCases:RankingSensitivityCase[]=[],
 shock=0.2,
 options:RankingSensitivityOptions={}
):RankingSensitivityResult {
 assert(Number.isFinite(shock)&&shock>=0&&shock<=0.9,'Sensitivity shock must be between 0 and 0.9');
 const baseline=topsis(scores,weights,directions);
 const scenarios:RankingSensitivityResult['scenarios']=[];
 const run=(label:string,kind:'weight'|'expert'|'optimistic'|'pessimistic',matrix:number[][],candidateWeights:number[])=>{
  scenarios.push({label,kind,ranking:topsis(matrix,candidateWeights,directions)});
 };
 for(let j=0;j<weights.length;j++){
  for(const sign of [-1,1]){
   const adjusted=weights.map((v,i)=>i===j?v*(1+sign*shock):v);
   run(`${j}:${sign<0?'−':'+'}${Math.round(shock*100)}%`,'weight',scores,adjusted);
  }
 }
 expertCases.forEach(c=>run(c.label,'expert',scores,c.weights));
 const minima=scores[0].map((_,j)=>Math.min(...scores.map(row=>row[j])));
 const maxima=scores[0].map((_,j)=>Math.max(...scores.map(row=>row[j])));
 // Stress-test each alternative asymmetrically: stronger alternatives receive
 // a favorable upside and an unfavorable downside proportional to their
 // distance from the relevant column boundary.
 const optimistic=scores.map(row=>row.map((v,j)=>{const range=maxima[j]-minima[j];if(range===0)return v;const position=(v-minima[j])/range;return Math.max(0,directions[j]==='benefit'?v+shock*range*position:v-shock*range*(1-position));}));
 const pessimistic=scores.map(row=>row.map((v,j)=>{const range=maxima[j]-minima[j];if(range===0)return v;const position=(v-minima[j])/range;return Math.max(0,directions[j]==='benefit'?v-shock*range*position:v+shock*range*(1-position));}));
 run('optimistic performance envelope','optimistic',optimistic,weights);
 run('pessimistic performance envelope','pessimistic',pessimistic,weights);
 const requestedTrials=options.trials??500;const requestedSeed=options.seed??20261125;
 assert(Number.isFinite(requestedTrials)&&requestedTrials>=1,'Monte Carlo trial count must be a finite positive number');
 assert(Number.isFinite(requestedSeed),'Monte Carlo seed must be finite');
 const trials=Math.max(50,Math.min(5000,Math.floor(requestedTrials)));
 const seed=Math.floor(requestedSeed);
 const random=seededRandom(seed);
 const ranksByAlternative=Array.from({length:scores.length},()=>[] as number[]);
 const scoresByAlternative=Array.from({length:scores.length},()=>[] as number[]);
 const topCounts=Array(scores.length).fill(0);
 const rankCounts=Array.from({length:scores.length},()=>Array(scores.length).fill(0));
 for(let trial=0;trial<trials;trial++){
  const perturbedWeights=weights.map(w=>w*(1+(random()*2-1)*shock));
  const matrix=scores.map(row=>row.map((v,j)=>{const range=maxima[j]-minima[j];const scale=range===0?Math.max(Math.abs(v),1):range;return Math.max(0,v+(random()*2-1)*shock*scale);}));
  const ranked=topsis(matrix,perturbedWeights,directions);
  const rankByIndex=rankVector(ranked,scores.length);
  ranked.results.forEach(r=>scoresByAlternative[r.alternativeIndex].push(r.score));
  rankByIndex.forEach((rank,index)=>{ranksByAlternative[index].push(rank);rankCounts[index][rank-1]++;if(rank===1)topCounts[index]++;});
 }
 const robustness={trials,seed,topFrequency:topCounts.map(v=>v/trials),averageRank:ranksByAlternative.map(v=>v.reduce((a,b)=>a+b,0)/trials),rankStdDev:ranksByAlternative.map(v=>{const mean=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/v.length);}),scoreP05:scoresByAlternative.map(v=>percentile(v,0.05)),scoreP95:scoresByAlternative.map(v=>percentile(v,0.95)),rankAcceptability:rankCounts.flatMap((counts,alternativeIndex)=>counts.map((count,index)=>({alternativeIndex,rank:index+1,frequency:count/trials})))};
 const expertAgreement=summarizeExpertAgreement(options.expertWeightVectors??[]);
 const all=[baseline,...scenarios.map(s=>s.ranking)];
 const summary=scores.map((_,alternativeIndex)=>{
  const ranks=all.map(result=>result.results.find(r=>r.alternativeIndex===alternativeIndex)!.rank);
  const topCount=ranks.filter(rank=>rank===1).length;
  return {alternativeIndex,averageRank:ranks.reduce((a,b)=>a+b,0)/ranks.length,bestRank:Math.min(...ranks),worstRank:Math.max(...ranks),topCount,topFrequency:topCount/ranks.length};
 });
 return {baseline,scenarios,summary,robustness,...(expertAgreement?{expertAgreement}:{}),shock};
}
