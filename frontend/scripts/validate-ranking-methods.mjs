import test from 'node:test';
import assert from 'node:assert/strict';
import {ahp,bwm,aggregatePairwiseMatrices,aggregateBwmJudgments,makeRankingSnapshot,validatePairwiseMatrix} from '../src/features/ranking/rankingMethods.ts';
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
test('expert BWM aggregation uses geometric means',()=>{
 const r=aggregateBwmJudgments([{bestToOthers:[1,3,5],othersToWorst:[5,2,1]},{bestToOthers:[1,5,7],othersToWorst:[7,3,1]}]); assert.ok(Math.abs(r.bestToOthers[1]-Math.sqrt(15))<1e-10);
});
test('calculation snapshots are versioned and reproducible',()=>{
 const s=makeRankingSnapshot({method:'AHP',criteria:['Cost','Risk'],expertCount:2,weights:[0.6,0.4],diagnostics:{cr:0.02,consistent:true},judgments:[[1,3],[1/3,1]]},'2026-11-25T00:00:00.000Z');
 assert.equal(s.schema,'pishran-ranking-snapshot/v1'); assert.equal(s.createdAt,'2026-11-25T00:00:00.000Z'); assert.equal(s.expertCount,2);
});
