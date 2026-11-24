import {describe,it,expect} from 'vitest';
import {parseLandXML,type Route} from './core';
import {prepareImportedRoutes,importedFileCount} from './importFiles';

const xml=(n:number)=>`<LandXML><Units><Metric linearUnit="meter"/></Units><Alignments><Alignment name="路線${n}" staStart="0"><CoordGeom><Line><Start>${n} 0</Start><End>${n} 100</End></Line></CoordGeom></Alignment></Alignments></LandXML>`;
const add=(existing:Route[],n:number,name='Land.xml')=>prepareImportedRoutes(existing,parseLandXML(xml(n),name),xml(n));

describe('multiple LandXML imports',()=>{
 it('accepts one file followed by nine same-name files without replacing the original',async()=>{
  let routes=await add([],0);const first=routes[0];
  for(let i=1;i<10;i++)routes=[...routes,...await add(routes,i)];
  expect(importedFileCount(routes)).toBe(10);
  expect(routes).toHaveLength(10);expect(routes[0]).toBe(first);
  expect(new Set(routes.map(r=>r.id)).size).toBe(10);
  expect(new Set(routes.map(r=>r.sourceId)).size).toBe(10);
  expect(routes.map(r=>r.segments[0].start.y)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  await expect(add(routes,10)).rejects.toThrow('合計10個');
  expect(routes).toHaveLength(10);
  const restored:Route[]=JSON.parse(JSON.stringify(routes));
  expect(importedFileCount(restored)).toBe(10);
  await expect(add(restored,10)).rejects.toThrow('合計10個');
  const removed=restored.filter(r=>r.sourceId!==restored[5].sourceId);
  expect(importedFileCount([...removed,...await add(removed,10)])).toBe(10);
 });
 it('rejects identical content even with a different filename',async()=>{
  const routes=await add([],0);
  await expect(add(routes,0,'別名.xml')).rejects.toThrow('同じ内容');
  expect(routes).toHaveLength(1);
 });
 it('counts multiple routes in one XML as one file and supports older saved projects',async()=>{
  const old=parseLandXML(xml(0),'Land.xml');
  const text=xml(1).replace('</Alignments>',xml(2).match(/<Alignment .*?<\/Alignment>/)![0]+'</Alignments>');
  const added=await prepareImportedRoutes(old,parseLandXML(text,'Land.xml'),text);
  expect(added).toHaveLength(2);expect(added[0].sourceId).toBe(added[1].sourceId);
  expect(importedFileCount([...old,...added])).toBe(2);
 });
 it('does not allocate a file slot to a failed parse',async()=>{
  const existing=await add([],0);
  expect(()=>parseLandXML('<LandXML/>')).toThrow('路線の入ったLand.XML');
  expect(importedFileCount([...existing,...await add(existing,1)])).toBe(2);
 });
});
