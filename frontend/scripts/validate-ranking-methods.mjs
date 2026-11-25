import test from 'node:test';
import assert from 'node:assert/strict';
import {ahp,bwm,aggregatePairwiseMatrices,aggregateBwmJudgments,makeRankingSnapshot,validatePairwiseMatrix,topsis} from '../src/features/ranking/rankingMethods.ts';
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
 assert.throws(()=>topsis([[0,2],[0,3]],[1,1],['benefit','cost']),/non-zero/);\n assert.throws(()=>topsis([[1,2],[2,3]],[1,1],['up','cost']),/valid benefit\/cost direction/);
});
test('AHP + TOPSIS can use AHP priorities as normalized TOPSIS weights',()=>{
 const priorities=ahp([[1,3],[1/3,1]]).weights;
 const ranked=topsis([[8,2],[5,7],[6,4]],priorities,['benefit','cost']);
 assert.equal(ranked.results.length,3);
 assert.equal(ranked.results[0].rank,1);
});
