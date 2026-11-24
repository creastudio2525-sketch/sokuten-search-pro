import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {ViewerCommonProps,ENH} from './viewerTypes';
import {orbit,rotationSpeed,setPivotWithoutMovingCamera} from './cameraMath';
import './viewers.css';
type Engine={data:(p:ViewerCommonProps)=>void;fit:()=>void};
export function Route3D(props:ViewerCommonProps){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),engine=useRef<Engine|null>(null);latest.current=props;
 const [error,setError]=useState('');
 useEffect(()=>{
  const root=host.current;if(!root)return;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('3D表示を開始できません。ブラウザーのハードウェアアクセラレーションを確認してください');return;}
  const el=renderer.domElement;el.setAttribute('aria-label','3D路線ビュー');renderer.setPixelRatio(Math.min(2,devicePixelRatio));root.appendChild(el);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f7f9fc');const content=new THREE.Group();scene.add(content);
  const camera=new THREE.PerspectiveCamera(45,1,.01,1e7);camera.up.set(0,0,1);const pivot=new THREE.Vector3(),origin=new THREE.Vector3(),ray=new THREE.Raycaster();
  const marker=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:'#269DD8',depthTest:false}));marker.visible=false;marker.renderOrder=20;scene.add(marker);
  let width=1,height=1,span=10,bounds=new THREE.Box3(new THREE.Vector3(-5,-5,0),new THREE.Vector3(5,5,0));let objects:THREE.Object3D[]=[],pinMeshes:THREE.Mesh[]=[],lineMaterials:LineMaterial[]=[];let previousOrigin:THREE.Vector3|null=null;
  const units=()=>2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(1,camera.position.distanceTo(pivot))/height/camera.zoom;
  const render=()=>{camera.updateMatrixWorld();const u=units();marker.scale.setScalar(u*6);marker.position.copy(pivot);for(const pin of pinMeshes)pin.scale.setScalar(u*(pin.userData.selected?7:5));ray.params.Line!.threshold=u*7;renderer.render(scene,camera);};
  const resize=()=>{width=Math.max(1,root.clientWidth);height=Math.max(1,root.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();lineMaterials.forEach(m=>m.resolution.set(width,height));render();};const ro=new ResizeObserver(resize);ro.observe(root);
  const dispose=(group:THREE.Object3D)=>{group.traverse(o=>{if(o instanceof THREE.Line||o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});};
  const data=(p:ViewerCommonProps)=>{
   dispose(content);content.clear();objects=[];pinMeshes=[];lineMaterials=[];
   const first=p.routes[0]?.points[0];origin.set(first?.[0]??0,first?.[1]??0,0);
   if(previousOrigin){const delta=previousOrigin.clone().sub(origin);camera.position.add(delta);pivot.add(delta);}previousOrigin=origin.clone();
   const point=(v:ENH)=>new THREE.Vector3(v[0]-origin.x,v[1]-origin.y,v[2]??0);const all:THREE.Vector3[]=[];
   for(const route of p.routes){const pts=route.points.map(point);all.push(...pts);if(pts.length<2)continue;const material=new LineMaterial({color:route.color,linewidth:route.active?3:2});material.resolution.set(width,height);lineMaterials.push(material);const geometry=new LineGeometry();geometry.setPositions(pts.flatMap(v=>[v.x,v.y,v.z]));const line=new Line2(geometry,material);line.userData.routeId=route.id;content.add(line);objects.push(line);}
   for(const cross of p.crossLines??[]){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cross.map(point)),new THREE.LineDashedMaterial({color:'#269DD8',dashSize:5,gapSize:3}));line.computeLineDistances();content.add(line);}
   for(const pin of p.pins??[]){const pos=point(pin.position),mesh=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshBasicMaterial({color:pin.selected?'#2D3082':pin.id.startsWith('result:')?'#269DD8':'#d97337'}));mesh.position.copy(pos);mesh.userData={pinId:pin.id,selected:pin.selected};pinMeshes.push(mesh);objects.push(mesh);content.add(mesh);all.push(pos);if(pos.z!==0){const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pos.x,pos.y,0),pos]),new THREE.LineBasicMaterial({color:'#a3aec8'}));content.add(stem);}}
   bounds=all.length?new THREE.Box3().setFromPoints(all):new THREE.Box3(new THREE.Vector3(-5,-5,0),new THREE.Vector3(5,5,0));span=Math.max(10,bounds.getSize(new THREE.Vector3()).length());
   const grid=new THREE.GridHelper(Math.ceil(span/100)*100,10,0xc7cfde,0xe3e8f1);grid.rotation.x=Math.PI/2;grid.renderOrder=-1;for(const m of Array.isArray(grid.material)?grid.material:[grid.material])m.depthWrite=false;const center=bounds.getCenter(new THREE.Vector3());grid.position.set(center.x,center.y,-.01);content.add(grid);render();
  };
  const fit=()=>{const center=bounds.getCenter(new THREE.Vector3());pivot.copy(center);camera.position.copy(center).add(new THREE.Vector3(.4,-1.2,1).normalize().multiplyScalar(span*1.15));camera.zoom=1;camera.lookAt(center);camera.updateProjectionMatrix();marker.visible=false;render();};
  const rayAt=(e:PointerEvent)=>{camera.updateMatrixWorld();const rect=el.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);};
  const ground=()=>ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),new THREE.Vector3());
  let button=-1,lx=0,ly=0,sx=0,sy=0,movingPin:string|null=null,dragStarted=false;
  const down=(e:PointerEvent)=>{if(e.button>2)return;e.preventDefault();button=e.button;dragStarted=false;sx=lx=e.clientX;sy=ly=e.clientY;el.setPointerCapture(e.pointerId);rayAt(e);const hit=ray.intersectObjects(objects,false)[0];if(e.button===2){const target=hit?.point??ground();if(target){setPivotWithoutMovingCamera(pivot,target);marker.visible=true;render();}}else if(e.button===0&&latest.current.mode==='select'){const id=hit?.object.userData.pinId;if(id&&!String(id).startsWith('result:'))movingPin=id;}};
  const move=(e:PointerEvent)=>{if(button<0)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;if(button===1){const delta=new THREE.Vector3(-dx*units(),dy*units(),0).applyQuaternion(camera.quaternion);camera.position.add(delta);pivot.add(delta);}else if(button===2){orbit(camera,pivot,dx,dy,width,height,rotationSpeed(e.altKey,e.shiftKey));}else if(button===0&&movingPin&&Math.hypot(e.clientX-sx,e.clientY-sy)>3){if(!dragStarted){dragStarted=true;latest.current.onPinMoveStart?.();}rayAt(e);const pos=ground();if(pos)latest.current.onMovePinEN?.(movingPin,[pos.x+origin.x,pos.y+origin.y]);}render();};
  const up=(e:PointerEvent)=>{if(button===0&&Math.hypot(e.clientX-sx,e.clientY-sy)<4){rayAt(e);if(latest.current.mode==='add'){const pos=ground();if(pos)latest.current.onAddPinEN?.([pos.x+origin.x,pos.y+origin.y]);}else{const hit=ray.intersectObjects(objects,false)[0];if(hit?.object.userData.pinId)latest.current.onSelectPin?.(hit.object.userData.pinId);else if(hit?.object.userData.routeId)latest.current.onSelectRoute?.(hit.object.userData.routeId);}}button=-1;movingPin=null;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);};
  const cancel=()=>{button=-1;movingPin=null;};const wheel=(e:WheelEvent)=>{e.preventDefault();camera.zoom=Math.max(.05,Math.min(100,camera.zoom*Math.exp(-e.deltaY*(e.ctrlKey?.0002:.001))));camera.updateProjectionMatrix();render();};const menu=(e:Event)=>e.preventDefault();
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',cancel);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('contextmenu',menu);
  engine.current={data,fit};data(latest.current);resize();fit();
  return()=>{engine.current=null;ro.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',cancel);el.removeEventListener('wheel',wheel);el.removeEventListener('contextmenu',menu);dispose(scene);renderer.dispose();renderer.forceContextLoss();el.remove();};
 },[]);
 useEffect(()=>{engine.current?.data(props);},[props.routes,props.pins,props.crossLines]);
 useEffect(()=>{engine.current?.fit();},[props.fitRevision]);
 return <div className="viewer-shell"><div className="route3d-canvas" ref={host}/><div className="route3d-status">右クリックした位置に回転中心を設定</div><div className="viewer-label">路線はH=0の基準面表示・手入力のピン高さを反映</div>{error&&<div className="route3d-error">{error}</div>}</div>;
}

