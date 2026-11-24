import {describe,it,expect} from 'vitest';
import {parseLandXML,evaluate,intersections} from './core';
const xml=(geometry:string,more='')=>`<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2"><Units><Metric linearUnit="meter"/></Units><CoordinateSystem horizontalDatum="JGD2011" horizontalCoordinateSystemName="12(X,Y)"/><Alignments><Alignment name="A" staStart="100"><CoordGeom>${geometry}</CoordGeom>${more}</Alignment></Alignments></LandXML>`;
const line='<Line><Start>0 0</Start><End>0 100</End></Line>';
describe('LandXML route calculation',()=>{
 it('reads N E, CRS and exact counterclockwise circular geometry',()=>{const r=parseLandXML(xml(line+'<Curve rot="ccw" radius="50"><Start>0 100</Start><Center>50 100</Center><End>50 150</End></Curve>'))[0];expect(r.length).toBeCloseTo(100+Math.PI*25,8);expect(evaluate(r,20).point).toEqual({x:20,y:0});expect(r.zone).toBe(12);expect(r.datum).toBe('JGD2011');expect(evaluate(r,r.length).point.x).toBeCloseTo(150);});
 it('returns the exact no-route message',()=>expect(()=>parseLandXML('<LandXML/>')).toThrow('路線の入ったLand.XMLを入力してください'));
 it('rejects unsupported geometry and station equations',()=>{expect(()=>parseLandXML(xml(line+'<Spiral/>'))).toThrow('Spiral');expect(()=>parseLandXML(xml(line,'<StaEquation staAhead="1"/>'))).toThrow('StaEquation');});
 it('rejects entities, malformed XML, wrong units and nonfinite geometry',()=>{expect(()=>parseLandXML('<!DOCTYPE x><LandXML/>')).toThrow('DOCTYPE');expect(()=>parseLandXML('<LandXML>')).toThrow('XMLを解析');expect(()=>parseLandXML(xml(line).replace('meter','foot'))).toThrow('meter');expect(()=>parseLandXML(xml(line.replace('0 100','NaN 1')))).toThrow('座標');});
 it('ignores vertical profile curves when reading horizontal alignment',()=>{expect(parseLandXML(xml(line,'<Profile><ProfAlign><ParaCurve length="40">50 12</ParaCurve></ProfAlign></Profile>'))[0].segments).toHaveLength(1);});
 it('finds exact crossline intersection and reports overlapping line',()=>{const r=parseLandXML(xml(line))[0];expect(intersections(r,{x:30,y:20},{x:1,y:0})[0]).toMatchObject({distance:30,point:{x:30,y:0},state:'candidate'});expect(intersections(r,{x:30,y:0},{x:0,y:1})[0].state).toBe('overlap');});
 it('deduplicates a tangent circular intersection',()=>{const r=parseLandXML(xml('<Curve rot="ccw" radius="10"><Start>0 10</Start><Center>0 0</Center><End>0 -10</End></Curve>'))[0];const candidates=intersections(r,{x:0,y:10},{x:0,y:1});expect(candidates).toHaveLength(1);expect(candidates[0].distance).toBeCloseTo(5*Math.PI);});
});
