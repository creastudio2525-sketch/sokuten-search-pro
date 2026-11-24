import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {orbit,rotationSpeed,setPivotWithoutMovingCamera} from './cameraMath';
describe('CAD camera without damping',()=>{
 it('does not change camera when assigning an off-centre pivot',()=>{const camera=new PerspectiveCamera(45,1,.01,1e6);camera.position.set(4,-20,14);camera.up.set(0,0,1);camera.lookAt(0,0,0);const pos=camera.position.clone(),rotation=camera.quaternion.clone(),pivot=new Vector3();setPivotWithoutMovingCamera(pivot,new Vector3(7,3,0));expect(camera.position.equals(pos)).toBe(true);expect(camera.quaternion.equals(rotation)).toBe(true);});
 it('preserves pivot screen position and orbit radius',()=>{const camera=new PerspectiveCamera(45,1,.01,1e6);camera.position.set(4,-20,14);camera.up.set(0,0,1);camera.lookAt(0,0,0);const pivot=new Vector3(7,3,0);camera.updateMatrixWorld();const before=pivot.clone().project(camera),radius=camera.position.distanceTo(pivot);orbit(camera,pivot,130,-72,900,600,.2);camera.updateMatrixWorld();const after=pivot.clone().project(camera);expect(before.distanceTo(after)).toBeLessThan(1e-12);expect(camera.position.distanceTo(pivot)).toBeCloseTo(radius,12);});
 it('switches sensitivity with Shift priority',()=>{expect(rotationSpeed(false,false)).toBe(.2);expect(rotationSpeed(true,false)).toBe(.5);expect(rotationSpeed(false,true)).toBe(1);expect(rotationSpeed(true,true)).toBe(1);});
});
