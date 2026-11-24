import {SaxesParser} from 'saxes';
export type Point={x:number;y:number;z?:number};
export type Segment={kind:'line'|'arc';start:Point;end:Point;center?:Point;radius?:number;rot?:'cw'|'ccw';length:number;sourceLength?:number};
export type Route={id:string;name:string;staStart:number;length:number;segments:Segment[];fileName:string;sourceId?:string;sourceHash?:string;unsupported:string[];zone?:number;datum?:string;unit?:string};
export type Intersection={point:Point;distance:number;state:'candidate'|'overlap'};
type XmlNode={name:string;attrs:Record<string,string>;children:XmlNode[];text:string};
const TAU=2*Math.PI;
const distance=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.y-a.y);
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const child=(n:XmlNode,name:string)=>n.children.find(c=>c.name===name);
function all(n:XmlNode,name:string):XmlNode[]{return [...(n.name===name?[n]:[]),...n.children.flatMap(c=>all(c,name))];}
function finite(value:string|undefined,label:string,fallback?:number){if(value===undefined&&fallback!==undefined)return fallback;const x=Number(value);if(value===undefined||!value.trim()||!Number.isFinite(x))throw Error(`${label}が不正です`);return x;}
function readPoint(node:XmlNode|undefined):Point{if(!node)throw Error('水平線形の座標がありません');const v=node.text.trim().split(/\s+/).map(Number);if(v.length<2||v.length>3||!v.every(Number.isFinite)||!node.text.trim())throw Error('座標値を解釈できません');return{x:v[1],y:v[0],...(v.length===3?{z:v[2]}:{})};}
function spiralSegments(node:XmlNode):Segment[]{
 const start=readPoint(child(node,'Start')),end=readPoint(child(node,'End')),piNode=child(node,'PI'),pi=piNode?readPoint(piNode):{x:(start.x+end.x)/2,y:(start.y+end.y)/2};
 const count=24, out:Segment[]=[]; let prev=start; const sourceLength=Number(node.attrs.length); 
 for(let i=1;i<=count;i++){const t=i/count,u=1-t;const p={x:u*u*start.x+2*u*t*pi.x+t*t*end.x,y:u*u*start.y+2*u*t*pi.y+t*t*end.y};const length=distance(prev,p);if(length>1e-9)out.push({kind:'line',start:prev,end:p,length,sourceLength:i===count&&Number.isFinite(sourceLength)?sourceLength:undefined});prev=p;}
 if(!out.length)throw Error('クロソイドの長さまたは座標が不正です'); return out;
}
function directedAngle(s:Segment,p:Point){const c=s.center!,a=Math.atan2(s.start.y-c.y,s.start.x-c.x),b=Math.atan2(p.y-c.y,p.x-c.x);let q=b-a;if(s.rot==='cw'&&q>0)q-=TAU;if(s.rot==='ccw'&&q<0)q+=TAU;return q;}
function sweep(s:Segment){return directedAngle(s,s.end);}
/** Parse only horizontal CoordGeom. Vertical Profile and cross sections are never treated as route geometry. */
export function parseLandXML(text:string,fileName='入力.xml'):Route[]{
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('DOCTYPE/外部実体は無効です');
 const stack:XmlNode[]=[],roots:XmlNode[]=[];let nodes=0;
 const parser=new SaxesParser({xmlns:true});
 parser.on('opentag',tag=>{if(++nodes>500000||stack.length>100)throw Error('XMLの構造が大きすぎます');const attrs:Record<string,string>={};for(const a of Object.values(tag.attributes))attrs[a.local]=a.value;const n:XmlNode={name:tag.local,attrs,children:[],text:''};if(stack.length)stack[stack.length-1].children.push(n);else roots.push(n);stack.push(n);});
 parser.on('text',t=>{if(stack.length)stack[stack.length-1].text+=t;});parser.on('cdata',t=>{if(stack.length)stack[stack.length-1].text+=t;});parser.on('closetag',()=>{stack.pop();});
 try{parser.write(text).close();}catch(e){throw Error(`XMLを解析できません: ${e instanceof Error?e.message:String(e)}`);}
 const root=roots[0];if(!root||root.name!=='LandXML'||roots.length!==1)throw Error('路線の入ったLand.XMLを入力してください');
 const alignments=all(root,'Alignments').flatMap(n=>n.children.filter(c=>c.name==='Alignment'));
 if(!alignments.length){if(all(root,'Surfaces').length)throw Error('路線データを入力してください（サーフェスLand.XMLは対象外です）');throw Error('路線の入ったLand.XMLを入力してください');}
 const units=child(root,'Units'),metric=units&&child(units,'Metric');
 if(!metric||metric.attrs.linearUnit!=='meter')throw Error('長さ単位がmeterのLandXMLを入力してください');
 const crs=child(root,'CoordinateSystem');const crsName=crs?.attrs.horizontalCoordinateSystemName;
 const zoneMatch=crsName?.match(/^(?:第)?\s*(\d{1,2})\s*(?:系|\()/);const zone=zoneMatch?Number(zoneMatch[1]):undefined;
 if(crsName&&!zoneMatch)throw Error(`平面直角座標系を解釈できません: ${crsName}`);
 if(zone!==undefined&&(zone<1||zone>19))throw Error('平面直角座標系の系番号が範囲外です');
 const datum=crs?.attrs.horizontalDatum;
 if(datum&&!['JGD2000','JGD2011','JGD2024'].includes(datum))throw Error(`未対応の測地系です: ${datum}`);
 return alignments.map((a,index)=>{
  const name=a.attrs.name||`路線${index+1}`,cg=child(a,'CoordGeom');
  if(!cg||!cg.children.length)throw Error('路線の入ったLand.XMLを入力してください');
  if(all(a,'StaEquation').length||all(a,'StaEquations').length)throw Error(`${name}: 測点方程式（StaEquation）は未対応です`);
  const segments:Segment[]=cg.children.flatMap(n=>{
   if(n.name==='Spiral')return spiralSegments(n);
   if(!['Line','Curve'].includes(n.name))throw Error(`${name}: 未対応の水平線形 ${n.name} が含まれています`);
   const start=readPoint(child(n,'Start')),end=readPoint(child(n,'End'));
   const s:Segment={kind:n.name==='Line'?'line':'arc',start,end,length:0};
   if(s.kind==='line')s.length=distance(start,end);
   else{const radius=finite(n.attrs.radius,'円曲線の半径'),center=readPoint(child(n,'Center')),rot=n.attrs.rot;
    if(radius<=0||!['cw','ccw'].includes(rot))throw Error(`${name}: 円曲線の半径または回転方向が不正です`);
    if(Math.abs(distance(start,center)-radius)>0.01||Math.abs(distance(end,center)-radius)>0.01)throw Error(`${name}: 円曲線の中心・半径・端点が一致しません`);
    s.radius=radius;s.center=center;s.rot=rot as 'cw'|'ccw';s.length=Math.abs(sweep(s))*radius;
   }
   if(!Number.isFinite(s.length)||s.length<=1e-9)throw Error(`${name}: 0長または不正な線形があります`);
   if(n.attrs.length!==undefined)s.sourceLength=finite(n.attrs.length,'線形長');return [s];
  });
  for(let i=1;i<segments.length;i++)if(distance(segments[i-1].end,segments[i].start)>0.01)throw Error(`${name}: 線形が連続していません`);
  return{id:`${fileName}:${index}`,name,staStart:finite(a.attrs.staStart,'起点測点',0),length:segments.reduce((n,s)=>n+s.length,0),segments,fileName,unsupported:[],zone,datum,unit:'meter'};
 });
}
export function evaluate(route:Route,distanceAlong:number){
 if(!route.segments.length||!Number.isFinite(distanceAlong))throw Error('測点距離が不正です');
 let rem=Math.max(0,Math.min(route.length,distanceAlong));
 for(let i=0;i<route.segments.length;i++){const s=route.segments[i];if(rem<=s.length+1e-9||i===route.segments.length-1){rem=Math.min(rem,s.length);if(s.kind==='line'){const t=rem/s.length;return{point:{x:s.start.x+(s.end.x-s.start.x)*t,y:s.start.y+(s.end.y-s.start.y)*t},tangent:{x:(s.end.x-s.start.x)/s.length,y:(s.end.y-s.start.y)/s.length},segment:s};}const c=s.center!,r=s.radius!,angle=Math.atan2(s.start.y-c.y,s.start.x-c.x)+(s.rot==='ccw'?1:-1)*rem/r;return{point:{x:c.x+r*Math.cos(angle),y:c.y+r*Math.sin(angle)},tangent:s.rot==='ccw'?{x:-Math.sin(angle),y:Math.cos(angle)}:{x:Math.sin(angle),y:-Math.cos(angle)},segment:s};}rem-=s.length;}
 throw Error('測点を評価できません');
}
export function intersections(route:Route,p:Point,tangent:Point):Intersection[]{
 const norm=Math.hypot(tangent.x,tangent.y);if(norm<1e-12||!Number.isFinite(norm))throw Error('接線が不正です');const t={x:tangent.x/norm,y:tangent.y/norm},n={x:-t.y,y:t.x},out:Intersection[]=[];let off=0;
 for(const s of route.segments){if(s.kind==='line'){const q=s.start,v={x:s.end.x-q.x,y:s.end.y-q.y},den=cross(v,n);
  if(Math.abs(den)>s.length*1e-12){const u=cross({x:p.x-q.x,y:p.y-q.y},n)/den;if(u>=-1e-10&&u<=1+1e-10){const f=Math.max(0,Math.min(1,u));out.push({point:{x:q.x+f*v.x,y:q.y+f*v.y},distance:off+f*s.length,state:'candidate'});}}
  else if(Math.abs((q.x-p.x)*t.x+(q.y-p.y)*t.y)<1e-7){const f=Math.max(0,Math.min(1,((p.x-q.x)*v.x+(p.y-q.y)*v.y)/(s.length*s.length)));out.push({point:{x:q.x+f*v.x,y:q.y+f*v.y},distance:off+f*s.length,state:'overlap'});}
 }else{const c=s.center!,h=(c.x-p.x)*t.x+(c.y-p.y)*t.y,foot={x:c.x-h*t.x,y:c.y-h*t.y},disc=s.radius!*s.radius!-h*h;
  if(disc>=-1e-8){const k=Math.sqrt(Math.max(0,disc));for(const sign of[-1,1]){const q={x:foot.x+sign*k*t.y,y:foot.y-sign*k*t.x};let a=Math.abs(directedAngle(s,q));if(distance(q,s.start)<1e-7)a=0;if(a<=Math.abs(sweep(s))+1e-10)out.push({point:q,distance:off+Math.min(a*s.radius!,s.length),state:'candidate'});}}
 }off+=s.length;}
 return out.filter((x,i,a)=>a.findIndex(y=>y.state===x.state&&Math.abs(y.distance-x.distance)<1e-7)===i).sort((a,b)=>a.distance-b.distance);
}
