import test from 'node:test';
import assert from 'node:assert/strict';
import {ahp,bwm,aggregatePairwiseMatrices,aggregateBwmJudgments,aggregateBwmExpertWeights,combineAHPBWMWeights,makeRankingSnapshot,validatePairwiseMatrix,topsis} from '../src/features/ranking/rankingMethods.ts';
test('AHP recovers a consistent priority vector and reports consistency',()=>{
 const m=[[1,3,5],[1/3,1,2],[1/5,1/2,1]];
 const r=ahp(m); assert.ok(Math.abs(r.weights.reduce((s,v)=>s+v,0)-1)<1e-12); assert.ok(r.weights[0]>r.weights[1]&&r.weights[1]>r.weights[2]); assert.ok(r.cr<0.1);
});
test('AHP rejects non-reciprocal and invalid matrices',()=>{
 assert.throws(()=>validatePairwiseMatrix([[1,3],[0.2,1]]),/reciprocal/);
 assert.throws(()=>validatePairwiseMatrix([[1,0],[0,1]]),/positive/);
});
test('AHP detects inconsistent judgments',()=>{
 const r=ahp([[1,9,1/9],[1/9,1,9],[9,1/9,1]]); assert.ok(r.cr>0.1); assert.equal(r.consistent,false);
});
test('group AHP uses geometric aggregation and preserves reciprocity',()=>{
 const m=aggregatePairwiseMatrices([[[1,3],[1/3,1]],[[1,5],[1/5,1]]]); assert.ok(Math.abs(m[0][1]-Math.sqrt(15))<1e-10); assert.ok(Math.abs(m[0][1]*m[1][0]-1)<1e-10);
});
test('BWM validates anchor judgments and produces normalized priorities',()=>{
 const r=bwm(0,2,[1,3,5],[5,2,1]); assert.ok(Math.abs(r.weights.reduce((s,v)=>s+v,0)-1)<1e-12); assert.ok(r.weights[0]>r.weights[1]&&r.weights[1]>r.weights[2]); assert.ok(Number.isFinite(r.xi));
 assert.throws(()=>bwm(0,2,[2,3,5],[5,2,1]),/must equal 1/);
});
test('BWM solves the exact minimax LP instead of returning a subgradient approximation',()=>{
 const balanced=bwm(0,2,[1,3,5],[5,2,1]);
 const expectedWeights=[0.65,0.225,0.125];
 balanced.weights.forEach((value,index)=>assert.ok(Math.abs(value-expectedWeights[index])<1e-8));
 assert.ok(Math.abs(balanced.xi-0.025)<1e-8);
 const highConflict=bwm(0,2,[1,9,9],[9,9,1]);
 const exactWeights=[0.8181818181818182,0.1291866028708134,0.05263157894736842];
 highConflict.weights.forEach((value,index)=>assert.ok(Math.abs(value-exactWeights[index])<1e-7));
 assert.ok(Math.abs(highConflict.xi-0.3444976076555024)<1e-7,
  'BWM xi must match the independently solved minimax linear program');
});
test('expert BWM aggregation uses geometric means',()=>{
 const r=aggregateBwmJudgments([{bestToOthers:[1,3,5],othersToWorst:[5,2,1]},{bestToOthers:[1,5,7],othersToWorst:[7,3,1]}]); assert.ok(Math.abs(r.bestToOthers[1]-Math.sqrt(15))<1e-10);
});
test('group BWM solves each expert with independent best/worst anchors before geometric weight aggregation',()=>{
 const experts=[
  {bestIndex:0,worstIndex:2,bestToOthers:[1,3,5],othersToWorst:[5,2,1]},
  {bestIndex:1,worstIndex:0,bestToOthers:[2,1,4],othersToWorst:[1,3,5]}
 ];
 const actual=aggregateBwmExpertWeights(experts);
 const individual=experts.map(e=>bwm(e.bestIndex,e.worstIndex,e.bestToOthers,e.othersToWorst));
 const raw=individual[0].weights.map((v,i)=>Math.sqrt(v*individual[1].weights[i]));
 const total=raw.reduce((a,b)=>a+b,0);
 const expected=raw.map(v=>v/total);
 assert.equal(actual.individual.length,2);
 assert.equal(actual.individual[0].bestIndex,0);
 assert.equal(actual.individual[1].bestIndex,1);
 assert.equal(actual.individual[1].worstIndex,0);
 actual.weights.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10));
 assert.ok(Math.abs(actual.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
});
test('calculation snapshots are versioned and reproducible',()=>{
 const s=makeRankingSnapshot({method:'AHP',criteria:['Cost','Risk'],expertCount:2,weights:[0.6,0.4],diagnostics:{cr:0.02,consistent:true},judgments:[[1,3],[1/3,1]]},'2026-11-25T00:00:00.000Z');
 assert.equal(s.schema,'pishran-ranking-snapshot/v1'); assert.equal(s.createdAt,'2026-11-25T00:00:00.000Z'); assert.equal(s.expertCount,2);
});

test('TOPSIS ranks benefit and cost criteria in the expected order',()=>{
 const r=topsis([[9,2],[7,4],[5,8]],[0.5,0.5],['benefit','cost']);
 assert.equal(r.results[0].alternativeIndex,0);
 assert.equal(r.results[0].rank,1);
 assert.equal(r.results.at(-1).alternativeIndex,2);
 assert.ok(r.results.every(x=>x.score>=0&&x.score<=1));
 assert.ok(Math.abs(r.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
});
test('TOPSIS validates dimensions, weights and zero-variance columns',()=>{
 assert.throws(()=>topsis([[1,2],[2,3]],[1],['benefit']),/rectangular|criteria/);
 assert.throws(()=>topsis([[1,2],[2,3]],[0,0],['benefit','cost']),/positive finite sum/);
 assert.throws(()=>topsis([[0,2],[0,3]],[1,1],['benefit','cost']),/non-zero/);
 assert.throws(()=>topsis([[1,2],[2,3]],[1,1],['up','cost']),/valid benefit\/cost direction/);
});
test('AHP + BWM hybrid supports adjustable contribution shares before TOPSIS',()=>{
 const a=[0.6,0.3,0.1],b=[0.2,0.3,0.5];
 for (const share of [0,0.25,0.5,0.7,1]) {
  const combined=combineAHPBWMWeights(a,b,share);
  const raw=a.map((v,i)=>v**share*b[i]**(1-share)),sum=raw.reduce((x,y)=>x+y,0);
  combined.forEach((v,i)=>assert.ok(Math.abs(v-raw[i]/sum)<1e-12));
  assert.ok(Math.abs(combined.reduce((x,y)=>x+y,0)-1)<1e-12);
  const ranked=topsis([[9,2,6],[7,4,8],[5,8,4]],combined,['benefit','cost','benefit']);
  assert.equal(ranked.results.length,3);
 }
 assert.throws(()=>combineAHPBWMWeights([0.5,0.5],[0.5]),/same criteria count/);
 assert.throws(()=>combineAHPBWMWeights([0.5,0.5],[0.5,0.5],1.2),/between 0 and 1/);
});
test('BWM priorities can feed TOPSIS directly for the BWM + TOPSIS method',()=>{
 const weights=bwm(0,2,[1,3,5],[5,2,1]).weights;
 const ranked=topsis([[9,2,6],[7,4,8],[5,8,4]],weights,['benefit','cost','benefit']);
 assert.equal(ranked.results.length,3);
 assert.equal(ranked.results[0].rank,1);
});
test('AHP + TOPSIS can use AHP priorities as normalized TOPSIS weights',()=>{
 const priorities=ahp([[1,3],[1/3,1]]).weights;
 const ranked=topsis([[8,2],[5,7],[6,4]],priorities,['benefit','cost']);
 assert.equal(ranked.results.length,3);
 assert.equal(ranked.results[0].rank,1);
});

import {analyzeRankingSensitivity} from '../src/features/ranking/rankingMethods.ts';
test('ranking sensitivity compares weight perturbations and optimistic/pessimistic scenarios',()=>{
 const scores=[[90,3],[70,6],[80,5]], weights=[0.6,0.4], directions=['benefit','cost'];
 const result=analyzeRankingSensitivity(scores,weights,directions,[{label:'expert judgment shift',weights:[0.4,0.6]}],0.2);
 assert.equal(result.baseline.results.length,3);
 assert.ok(result.scenarios.some(s=>s.kind==='weight'));
 assert.ok(result.scenarios.some(s=>s.kind==='expert'));
 assert.ok(result.scenarios.some(s=>s.kind==='optimistic'));
 assert.ok(result.scenarios.some(s=>s.kind==='pessimistic'));
 assert.equal(result.summary.length,3);
 assert.ok(result.summary.every(s=>s.averageRank>=1&&s.worstRank>=s.bestRank&&s.topFrequency>=0&&s.topFrequency<=1));
 assert.ok(result.summary.reduce((sum,s)=>sum+s.topFrequency,0)>0);
});

test('rank robustness simulation is deterministic, normalized and exposes rank acceptability',()=>{
 const input={scores:[[90,3],[70,6],[80,5]],weights:[0.6,0.4],directions:['benefit','cost'],cases:[{label:'expert shift',weights:[0.4,0.6]}]};
 const a=analyzeRankingSensitivity(input.scores,input.weights,input.directions,input.cases,0.2,{trials:250,seed:77});
 const b=analyzeRankingSensitivity(input.scores,input.weights,input.directions,input.cases,0.2,{trials:250,seed:77});
 assert.deepEqual(a.robustness,b.robustness);
 assert.equal(a.robustness.trials,250);
 assert.equal(a.robustness.rankAcceptability.length,9);
 for(let alternative=0;alternative<3;alternative++){
  const total=a.robustness.rankAcceptability.filter(x=>x.alternativeIndex===alternative).reduce((s,x)=>s+x.frequency,0);
  assert.ok(Math.abs(total-1)<1e-12);
 }
 assert.ok(a.robustness.topFrequency.every(v=>v>=0&&v<=1));
});
test('expert agreement diagnostics quantify rank consensus and criterion dispersion',()=>{
 const result=analyzeRankingSensitivity([[9,2],[7,4],[5,8]],[0.6,0.4],['benefit','cost'],[],0.1,{trials:100,seed:9,expertWeightVectors:[[0.8,0.2],[0.7,0.3],[0.2,0.8]]});
 assert.equal(result.expertAgreement.expertCount,3);
 assert.ok(result.expertAgreement.meanPairwiseSpearman>=-1&&result.expertAgreement.meanPairwiseSpearman<=1);
 assert.equal(result.expertAgreement.criterionDispersion.length,2);
 assert.ok(result.expertAgreement.criterionDispersion[0].standardDeviation>0);
});
test('sensitivity simulation validates deterministic trial bounds and expert vector dimensions',()=>{
 assert.throws(()=>analyzeRankingSensitivity([[1,2],[2,1]],[0.5,0.5],['benefit','cost'],[],0.1,{trials:100,expertWeightVectors:[[1,0],[1,2,3]]}),/matching finite/);
});

test('optimistic and pessimistic envelopes change alternative performance rather than shifting every row uniformly',()=>{
 const scores=[[100,1],[60,8],[80,4]],weights=[0.5,0.5],directions=['benefit','cost'];
 const result=analyzeRankingSensitivity(scores,weights,directions,[],0.25,{trials:100,seed:12});
 const optimistic=result.scenarios.find(s=>s.kind==='optimistic').ranking;
 const pessimistic=result.scenarios.find(s=>s.kind==='pessimistic').ranking;
 assert.notDeepEqual(optimistic.results.map(x=>x.score),result.baseline.results.map(x=>x.score));
 assert.notDeepEqual(pessimistic.results.map(x=>x.score),result.baseline.results.map(x=>x.score));
});
