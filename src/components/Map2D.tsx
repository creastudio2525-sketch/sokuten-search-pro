import { useEffect, useRef, useState } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import TileLayer from "ol/layer/Tile";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";

import Zoom from "ol/control/Zoom";
import Attribution from "ol/control/Attribution";
import { transform } from "ol/proj";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Text from "ol/style/Text";
import type { ViewerCommonProps, ENH } from "./viewerTypes";
import "ol/ol.css";
import "./viewers.css";

function projectionCode(definition?: string, zone?: number) {
  if (!definition) return "EPSG:3857";
  const epsg = definition.match(/EPSG:?\s*(\d+)/i)?.[1];
  const code = epsg ? `EPSG:${epsg}` : `USER:LANDXML-${zone ?? "custom"}`;
  try { proj4.defs(code, definition); register(proj4); } catch { return "EPSG:3857"; }
  return code;
}
const mapPoint = (p: ENH, code: string) => code === "EPSG:3857" ? [p[0], p[1]] : transform([p[0], p[1]], code, "EPSG:3857");
const enPoint = (p: number[], code: string) => code === "EPSG:3857" ? [p[0], p[1]] as [number, number] : transform(p, "EPSG:3857", code) as [number, number];

export function Map2D(props: ViewerCommonProps) {
  const { routes, pins = [], crossLines = [], projectionDefinition, zone, mode = "select", fitRevision = 0 } = props;
  const host = useRef<HTMLDivElement>(null), mapRef = useRef<OlMap | null>(null), vectorRef = useRef<VectorSource | null>(null), baseRef = useRef<TileLayer<any> | null>(null), codeRef = useRef("EPSG:3857");
  const latest = useRef(props); latest.current = props; const pinFeatures = useRef(new Map<string, Feature<Point>>()); const [error, setError] = useState("");
  useEffect(() => {
    if (!host.current) return;
    const base = new TileLayer({ source: new OSM() });
    const vector = new VectorSource(); const map = new OlMap({ target: host.current, layers: [base, new VectorLayer({ source: vector })], view: new View({ center: [15400000,4400000], zoom: 5 }), controls:[new Zoom({duration:0}),new Attribution({collapsible:false})], interactions: [] });
    mapRef.current = map; vectorRef.current = vector; baseRef.current = base;
    const el = map.getViewport();
    if (!el) return;
    let rotating = false, rotationAnchor: number[] | null = null; let middle = false, last: [number, number] | null = null, movingPin: string | null = null, dragStarted=false, sx = 0, sy = 0;
    const down = (e: PointerEvent) => { sx=e.clientX;sy=e.clientY;dragStarted=false;if ((e.target as HTMLElement).closest(".ol-control")) return; if (e.button === 2) { rotating=true; rotationAnchor=map.getCoordinateFromPixel(map.getEventPixel(e)); last=[e.clientX,e.clientY]; el.setPointerCapture(e.pointerId); e.preventDefault(); } else if (e.button === 1) { middle = true; last = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); e.preventDefault(); } else if (e.button === 0) { const f = map.forEachFeatureAtPixel(map.getEventPixel(e), x => {const id=x.get('pinId');return id&&!String(id).startsWith('result:')?x:undefined;},{hitTolerance:6}); const id = f?.get("pinId"); if (id && latest.current.mode === "select") { movingPin = id; el.setPointerCapture(e.pointerId); } } };
    const move = (e: PointerEvent) => { if (rotating && last && rotationAnchor) { map.getView().adjustRotation((e.clientX-last[0])*0.005, rotationAnchor); last=[e.clientX,e.clientY]; } else if (middle && last) { const pixel=map.getEventPixel(e), before=map.getCoordinateFromPixel([pixel[0]-(e.clientX-last[0]),pixel[1]-(e.clientY-last[1])]), after=map.getCoordinateFromPixel(pixel), view=map.getView(), center=view.getCenter()!; view.setCenter([center[0]+before[0]-after[0],center[1]+before[1]-after[1]]); last=[e.clientX,e.clientY]; } else if (movingPin && Math.hypot(e.clientX-sx,e.clientY-sy)>3) { if(!dragStarted){dragStarted=true;latest.current.onPinMoveStart?.();} const f=pinFeatures.current.get(movingPin); if(f){ const c=map.getCoordinateFromPixel(map.getEventPixel(e)); f.getGeometry()?.setCoordinates(c); latest.current.onMovePinEN?.(movingPin,enPoint(c,codeRef.current)); } } };
    const up = (e: PointerEvent) => { middle=false; rotating=false; rotationAnchor=null; last=null; movingPin=null; if(el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
    const cancel = () => { middle=false; rotating=false; rotationAnchor=null; last=null; movingPin=null; };
    const click = (e: MouseEvent) => { if(e.button!==0||Math.hypot(e.clientX-sx,e.clientY-sy)>4||(e.target as HTMLElement).closest('.ol-control'))return;const p=map.getEventPixel(e); if(latest.current.mode === "add"){ latest.current.onAddPinEN?.(enPoint(map.getCoordinateFromPixel(p),codeRef.current)); return; } const f=map.forEachFeatureAtPixel(p,x=>x,{hitTolerance:6}); if(f?.get("pinId"))latest.current.onSelectPin?.(f.get("pinId")); else if(f?.get("routeId"))latest.current.onSelectRoute?.(f.get("routeId")); };
    const wheel=(e:WheelEvent)=>{e.preventDefault();const v=map.getView(),z=v.getZoom()??2;v.setZoom(Math.max(1,Math.min(24,z+(e.deltaY<0?.7:-.7)*(e.ctrlKey?.2:1))));};
    el.addEventListener("pointerdown",down);el.addEventListener("pointermove",move);el.addEventListener("pointerup",up);el.addEventListener("pointercancel",cancel);el.addEventListener("lostpointercapture",cancel);el.addEventListener("click",click);el.addEventListener("wheel",wheel,{passive:false});el.addEventListener("contextmenu",e=>e.preventDefault());
    return()=>{el.removeEventListener("pointerdown",down);el.removeEventListener("pointermove",move);el.removeEventListener("pointerup",up);el.removeEventListener("pointercancel",cancel);el.removeEventListener("lostpointercapture",cancel);el.removeEventListener("click",click);el.removeEventListener("wheel",wheel);map.setTarget(undefined);mapRef.current=null;};
  }, []);
  useEffect(() => { const vector=vectorRef.current;if(!vector)return; codeRef.current=projectionCode(projectionDefinition,zone);vector.clear();pinFeatures.current.clear();const add=(f:Feature)=>vector.addFeature(f); for(const r of routes){const f=new Feature({geometry:new LineString(r.points.map(p=>mapPoint(p,codeRef.current))),routeId:r.id});f.setStyle(new Style({stroke:new Stroke({color:r.color||"#2D3082",width:r.active?5:3})}));add(f);} for(const l of crossLines){const f=new Feature({geometry:new LineString(l.map(p=>mapPoint(p,codeRef.current)))});f.setStyle(new Style({stroke:new Stroke({color:"#269DD8",width:2,lineDash:[7,5]})}));add(f);} for(const p of pins){const f=new Feature({geometry:new Point(mapPoint(p.position,codeRef.current)),pinId:p.id});f.setStyle(new Style({image:new CircleStyle({radius:p.selected?8:6,fill:new Fill({color:p.id.startsWith("result:")?"#269DD8":"#2D3082"}),stroke:new Stroke({color:"#fff",width:2})}),text:p.label?new Text({text:p.label,font:"15px Meiryo",offsetY:p.id.startsWith("result:")?25:-24,fill:new Fill({color:"#2D3082"}),stroke:new Stroke({color:"#fff",width:3})}):undefined}));add(f);pinFeatures.current.set(p.id,f);} },[routes,pins,crossLines,projectionDefinition,zone]);
  useEffect(()=>{const map=mapRef.current;if(!map||!routes.some(r=>r.points.length))return;const all=routes.flatMap(r=>r.points.map(p=>mapPoint(p,codeRef.current)));map.getView().fit(new LineString(all).getExtent(),{padding:[35,35,35,35],maxZoom:19,duration:0});},[fitRevision]);
  return <div className="viewer-shell"><div className="map-canvas" ref={host}/>{error&&<div className="viewer-message error" role="status">{error}</div>}<div className="viewer-label">2D 平面図・通常地図</div></div>;
}



