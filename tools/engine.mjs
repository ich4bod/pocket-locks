import assert from 'node:assert/strict';
import {create,act} from '../site/engine.mjs';
const mode=process.argv[2]||'base';
const spec={reaches:[0,1],water:[0],start:0,target:2,budget:null};
let s=create(spec);assert.deepEqual(s,{reaches:[0,1],chambers:[{water:0,low:false,high:false}],boat:0,start:0,target:2,moves:0,fills:0,budget:null,won:false});
function run(a){const before=structuredClone(s),r=act(s,a);assert.deepEqual(s,before,'input mutated');assert.equal(r.error,null);s=r.state;}
function bad(a,message){const before=structuredClone(s),r=act(s,a);assert.equal(r.error,message);assert.deepEqual(r.state,before);assert.deepEqual(s,before);}
const g=(lock,side)=>({type:'gate',lock,side}),w=(lock,side)=>({type:'water',lock,side}),sail=direction=>({type:'sail',direction});
bad(g(0,'high'),'Match water levels before opening this gate.');bad(sail(1),'Open the gate ahead of the boat.');run(g(0,'low'));bad(w(0,'high'),'Close both gates before changing the water.');run(sail(1));run(g(0,'low'));run(w(0,'high'));assert.equal(s.chambers[0].water,1);assert.equal(s.fills,1);run(g(0,'high'));run(sail(1));assert.equal(s.won,true);assert.equal(s.moves,6);bad(sail(-1),'This trip is finished.');
if(mode==='levels'||mode==='budget'){
 s=create({reaches:[0,1],water:[1],start:2,target:0,budget:null});for(const a of [g(0,'high'),sail(-1),g(0,'high'),w(0,'low'),g(0,'low'),sail(-1)])run(a);assert.equal(s.won,true);assert.equal(s.fills,0);assert.equal(s.moves,6);
 s=create({reaches:[0,1,2],water:[0,1],start:0,target:4,budget:mode==='budget'?2:null});for(let i=0;i<2;i++)for(const a of [g(i,'low'),sail(1),g(i,'low'),w(i,'high'),g(i,'high'),sail(1)])run(a);assert.equal(s.won,true);assert.equal(s.moves,12);assert.equal(s.fills,2);
}
if(mode==='budget'){
 s=create({reaches:[0,1,2],water:[0,1],start:0,target:4,budget:2});run(w(0,'high'));run(w(0,'low'));run(w(0,'high'));assert.equal(s.fills,2);run(w(0,'low'));bad(w(0,'high'),'No water tokens left. Undo or restart.');assert.equal(s.chambers[0].water,0);
}
console.log(mode==='base'?'lock engine preserves gate safety and a six-move uphill trip':mode==='levels'?'uphill downhill and two-lock trips obey the same rules':'two water tokens finish the hill and wasted fills cannot mutate it');
