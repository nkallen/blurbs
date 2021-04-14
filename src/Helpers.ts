import * as THREE from 'three';
import { EditorSignals } from './Editor';

// Helpers are little visualization tools like gizmos that should
// be rendered as a separate pass from the main scene.

export interface Helper extends THREE.Object3D {
    update(camera: THREE.Camera): void;
}

export class Helpers {
    readonly scene = new THREE.Scene();

    constructor(signals: EditorSignals) {
        signals.renderPrepared.add(([camera]) => this.update(camera));
    }

    add(...object: Helper[]) {
        this.scene.add(...object);
    }

    remove(...object: Helper[]) {
        this.scene.remove(...object);
    }

    update(camera: THREE.Camera) {
        for (const child of this.scene.children) {
            const helper = child as Helper;
            helper.update(camera);
        }
    }
}