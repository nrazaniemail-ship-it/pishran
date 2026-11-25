export type PairwiseMatrix = number[][];
export type RankingSnapshot = {
  schema: 'pishran-ranking-snapshot/v1';
  method: 'AHP' | 'BWM' | 'TOPSIS' | 'AHP+TOPSIS';
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
function projectSimplex(values:number[]) {
 const sorted=[...values].sort((a,b)=>b-a); let sum=0,theta=0;
 for(let i=0;i<sorted.length;i++){sum+=sorted[i];const t=(sum-1)/(i+1);if(i===sorted.length-1||t>=sorted[i+1]){theta=t;break;}}
 return values.map(v=>Math.max(0,v-theta));
}
export function bwm(bestIndex:number,worstIndex:number,bestToOthers:number[],othersToWorst:number[]) {
 const n=bestToOthers.length; assert(n>=2&&othersToWorst.length===n,'BWM vectors must have equal length ≥ 2');
 assert(Number.isInteger(bestIndex)&&bestIndex>=0&&bestIndex<n&&Number.isInteger(worstIndex)&&worstIndex>=0&&worstIndex<n&&bestIndex!==worstIndex,'Best and worst criteria must be distinct valid indices');
 [...bestToOthers,...othersToWorst].forEach(v=>assert(Number.isFinite(v)&&v>=1&&v<=9,'BWM judgments must be on the 1–9 scale'));
 assert(Math.abs(bestToOthers[bestIndex]-1)<1e-9&&Math.abs(othersToWorst[worstIndex]-1)<1e-9,'Best-to-best and worst-to-worst judgments must equal 1');
 let w=normalize(Array.from({length:n},(_,i)=>1/(bestToOthers[i]*othersToWorst[i])**0.5));
 // Minimize the BWM minimax deviation with a projected subgradient
 // of the currently active absolute residual.
 for(let k=0;k<50000;k++){
  let worstResidual=0; let grad=Array(n).fill(0);
  const consider=(d:number,terms:Array<[number,number]>)=>{
   if(Math.abs(d)>worstResidual){worstResidual=Math.abs(d);grad=Array(n).fill(0);for(const [idx,coef] of terms)grad[idx]=Math.sign(d)*coef;}
  };
  for(let j=0;j<n;j++) if(j!==bestIndex) consider(w[bestIndex]-bestToOthers[j]*w[j],[[bestIndex,1],[j,-bestToOthers[j]]]);
  for(let j=0;j<n;j++) if(j!==worstIndex) consider(w[j]-othersToWorst[j]*w[worstIndex],[[j,1],[worstIndex,-othersToWorst[j]]]);
  const step=0.01/Math.sqrt(k+1); w=projectSimplex(w.map((v,i)=>v-step*grad[i]));
 }
 const xi=Math.max(...bestToOthers.map((a,j)=>Math.abs(w[bestIndex]-a*w[j])),...othersToWorst.map((a,j)=>Math.abs(w[j]-a*w[worstIndex])));
 return {weights:normalize(w),xi,bestIndex,worstIndex};
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
