import {describe,expect,it} from 'vitest';
import {nearestDistance,sampleRoute} from './geometryView';
import type {Route,Segment} from './core';
const route=(segments:Segment[]):Route=>({id:'r',name:'r',staStart:0,length:segments.reduce((n,s)=>n+s.length,0),segments,fileName:'',unsupported:[]});
describe('route rendering and snapping',()=>{
 it('preserves line endpoints and snaps orthogonally',()=>{const r=route([{kind:'line',start:{x:0,y:0,z:1},end:{x:10,y:0,z:3},length:10}]);expect(sampleRoute(r)).toEqual([[0,0,1],[10,0,3]]);expect(nearestDistance(r,{x:3,y:2})).toBeCloseTo(3);});
 it.each(['ccw','cw'] as const)('samples a 270 degree %s arc without using a chord for stationing',rot=>{const sign=rot==='ccw'?1:-1;const s:Segment={kind:'arc',start:{x:10,y:0},end:{x:0,y:-sign*10},center:{x:0,y:0},radius:10,rot,length:15*Math.PI};const r=route([s]),pts=sampleRoute(r,.01),last=pts[pts.length-1];expect(last[0]).toBeCloseTo(0);expect(last[1]).toBeCloseTo(-sign*10);for(let i=1;i<pts.length;i++){const midpoint=Math.hypot((pts[i][0]+pts[i-1][0])/2,(pts[i][1]+pts[i-1][1])/2);expect(10-midpoint).toBeLessThanOrEqual(.010000001);}expect(nearestDistance(r,{x:7.0710678,y:sign*7.0710678})).toBeCloseTo(5*Math.PI/2,5);});
});
