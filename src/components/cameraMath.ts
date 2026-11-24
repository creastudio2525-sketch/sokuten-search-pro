import {PerspectiveCamera,Quaternion,Vector3} from 'three';
export const rotationSpeed=(alt:boolean,shift:boolean)=>shift?1:alt?.5:.2;
export function orbit(camera:PerspectiveCamera,pivot:Vector3,dx:number,dy:number,width:number,height:number,speed:number){
 const yaw=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-dx/width*Math.PI*2*speed);
 camera.position.sub(pivot).applyQuaternion(yaw).add(pivot);camera.quaternion.premultiply(yaw);
 const right=new Vector3(1,0,0).applyQuaternion(camera.quaternion),pitch=new Quaternion().setFromAxisAngle(right,-dy/height*Math.PI*speed);
 camera.position.sub(pivot).applyQuaternion(pitch).add(pivot);camera.quaternion.premultiply(pitch);
}
export function setPivotWithoutMovingCamera(pivot:Vector3,point:Vector3){pivot.copy(point);}
