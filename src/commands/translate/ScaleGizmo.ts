import * as THREE from "three";
import { CancellablePromise } from "../../util/Cancellable";
import { mode } from "../AbstractGizmo";
import { CircleMagnitudeGizmo, CompositeGizmo, ScaleAxisGizmo } from "../MiniGizmos";
import { ScaleParams } from "./TranslateFactory";

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class ScaleGizmo extends CompositeGizmo<ScaleParams> {
    private readonly materials = this.editor.gizmos;
    private readonly red = { tip: this.materials.red, shaft: this.materials.lineRed };
    private readonly green = { tip: this.materials.green, shaft: this.materials.lineGreen };
    private readonly blue = { tip: this.materials.blue, shaft: this.materials.lineBlue };
    private readonly x = new ScaleAxisGizmo("scale:x", this.editor, this.red);
    private readonly y = new ScaleAxisGizmo("scale:y", this.editor, this.green);
    private readonly z = new ScaleAxisGizmo("scale:z", this.editor, this.blue);
    private readonly xyz = new CircleMagnitudeGizmo("scale:xyz", this.editor);

    execute(cb: (params: ScaleParams) => void, finishFast: mode = mode.Persistent): CancellablePromise<void> {
        const { x, y, z, xyz, params } = this;

        x.quaternion.setFromUnitVectors(Y, X);
        y.quaternion.setFromUnitVectors(Y, Y);
        z.quaternion.setFromUnitVectors(Y, Z);

        this.add(x, y, z, xyz);

        this.addGizmo(x, scale => {
            params.scale.set(x.magnitude, y.magnitude, z.magnitude).multiplyScalar(xyz.magnitude);
        });

        this.addGizmo(y, scale => {
            params.scale.set(x.magnitude, y.magnitude, z.magnitude).multiplyScalar(xyz.magnitude);
        });

        this.addGizmo(z, scale => {
            params.scale.set(x.magnitude, y.magnitude, z.magnitude).multiplyScalar(xyz.magnitude);
        });

        this.addGizmo(xyz, scale => {
            params.scale.set(x.magnitude, y.magnitude, z.magnitude).multiplyScalar(xyz.magnitude);
        });

        return super.execute(cb, finishFast);
    }
}