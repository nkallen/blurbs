import * as THREE from 'three';
import { ThreePointBoxFactory } from '../../src/commands/box/BoxFactory';
import FilletFactory from '../../src/commands/fillet/FilletFactory';
import { SymmetryFactory } from '../../src/commands/mirror/MirrorFactory';
import { MoveFactory } from '../../src/commands/translate/TranslateFactory';
import { EditorSignals } from '../../src/editor/EditorSignals';
import { GeometryDatabase } from '../../src/editor/GeometryDatabase';
import MaterialDatabase from '../../src/editor/MaterialDatabase';
import ModifierManager, { ModifierStack } from "../../src/editor/ModifierManager";
import * as visual from '../../src/editor/VisualModel';
import { SelectionManager } from "../../src/selection/SelectionManager";
import { FakeMaterials } from "../../__mocks__/FakeMaterials";
import '../matchers';

let db: GeometryDatabase;
let materials: MaterialDatabase;
let signals: EditorSignals;
let selection: SelectionManager;
let modifiers: ModifierManager;

beforeEach(async () => {
    materials = new FakeMaterials();
    signals = new EditorSignals();
    db = new GeometryDatabase(materials, signals);
    selection = new SelectionManager(db, materials, signals);
});

beforeEach(() => {
    modifiers = new ModifierManager(db, selection, materials, signals);
})

describe(ModifierManager, () => {
    let box: visual.Solid;
    let stack: ModifierStack;

    beforeEach(async () => {
        const makeBox = new ThreePointBoxFactory(modifiers, materials, signals); // NOTE: passing in modifier rather than raw db as in most other tests
        makeBox.p1 = new THREE.Vector3();
        makeBox.p2 = new THREE.Vector3(1, 0, 0);
        makeBox.p3 = new THREE.Vector3(1, 1, 0);
        makeBox.p4 = new THREE.Vector3(1, 1, 1);
        box = await makeBox.commit() as visual.Solid;
    });

    const unselectable = new THREE.Layers();
    beforeEach(() => {
        unselectable.set(visual.Layers.Unselectable);
    });

    test('selecting & adding & removing a symmetry modifier', async () => {
        modifiers.selected.addSolid(box); // 1. SELECT

        expect(selection.selected.solids.size).toBe(1);
        expect(modifiers.selected.solids.size).toBe(1);
        expect(modifiers.selected.unmodifiedSolids.size).toBe(1);
        expect(modifiers.selected.modifiedSolids.size).toBe(1);

        stack = modifiers.add(box); // 2. ADD MODIFIER STACK

        expect(stack).not.toBeUndefined();
        expect(stack.modified).toBe(stack.premodified);
        expect(db.visibleObjects.length).toBe(1);
        expect(modifiers.getByModified(stack.modified)).toBeUndefined();
        expect(modifiers.getByPremodified(stack.premodified)).toBe(stack);
        expect(modifiers.stateOf(stack.premodified)).toBe('premodified');
        expect(modifiers.stateOf(stack.modified)).toBe('premodified');

        stack.addModifier(SymmetryFactory); // 3. ADD SYMMETRY MODIFIER
        await modifiers.rebuild(stack);

        expect(db.visibleObjects.length).toBe(2);
        expect(selection.selected.solids.size).toBe(1);
        expect(modifiers.selected.solids.size).toBe(1);
        expect(modifiers.selected.unmodifiedSolids.size).toBe(1);
        expect(modifiers.selected.modifiedSolids.size).toBe(0);
        expect(modifiers.getByModified(stack.modified)).toBe(stack);
        expect(modifiers.getByPremodified(stack.premodified)).toBe(stack);
        expect(modifiers.stateOf(stack.premodified)).toBe('premodified');
        expect(modifiers.stateOf(stack.modified)).toBe('modified');

        const bbox = new THREE.Box3();
        bbox.setFromObject(stack.modified);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        expect(center).toApproximatelyEqual(new THREE.Vector3(0, 0.5, 0.5));
        expect(bbox.min).toApproximatelyEqual(new THREE.Vector3(-1, 0, 0));
        expect(bbox.max).toApproximatelyEqual(new THREE.Vector3(1, 1, 1));

        modifiers.selected.addSolid(stack.modified); // 5. SELECT MODIFIED

        expect(selection.selected.solids.size).toBe(2);
        expect(modifiers.selected.solids.size).toBe(1);
        expect(modifiers.selected.unmodifiedSolids.size).toBe(1);
        expect(modifiers.selected.modifiedSolids.size).toBe(1);

        await modifiers.remove(box); // 6. REMOVE

        expect(modifiers.getByPremodified(box)).toBeUndefined();
        expect(modifiers.getByModified(stack.modified)).toBeUndefined();
        expect(db.visibleObjects.length).toBe(1);

        expect(selection.selected.solids.size).toBe(1);
        expect(modifiers.selected.solids.size).toBe(1);
        expect(modifiers.selected.unmodifiedSolids.size).toBe(1);
        expect(modifiers.selected.modifiedSolids.size).toBe(1);
    });


    test('when removing the last modifier and rebuilding', async () => {
        stack = modifiers.add(box);
        stack.addModifier(SymmetryFactory);
        await modifiers.rebuild(stack);
        stack.removeModifier(0);
        expect(stack.modifiers.length).toBe(0);
        await modifiers.rebuild(stack);
        expect(modifiers.getByPremodified(box)).toBeUndefined();
        expect(modifiers.getByModified(stack.modified)).toBeUndefined();
        expect(db.visibleObjects.length).toBe(1);
    })

    describe('modified objects', () => {
        beforeEach(async () => {
            stack = modifiers.add(box);
            stack.addModifier(SymmetryFactory);
            await modifiers.rebuild(stack);
        })

        test('replacing an item with a new one updates the modifier', async () => {
            const oldModified = stack.modified;

            expect(db.visibleObjects.length).toBe(2);

            const makeFillet = new FilletFactory(modifiers, materials, signals);
            makeFillet.solid = box;
            const edge = box.edges.get(0);
            makeFillet.edges = [edge];
            makeFillet.distance = 0.1;
            const filleted = await makeFillet.commit() as visual.Solid;

            expect(db.visibleObjects.length).toBe(2);

            expect(modifiers.getByPremodified(box)).toBeUndefined();
            const newModification = modifiers.getByPremodified(filleted) as ModifierStack;
            expect(newModification).not.toBeUndefined();
            expect(stack.modified).not.toBe(1);
            expect(newModification.modified).not.toBe(oldModified)

            const bbox = new THREE.Box3();
            bbox.setFromObject(newModification.modified);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            expect(center).toApproximatelyEqual(new THREE.Vector3(0, 0.5, 0.5));
            expect(bbox.min).toApproximatelyEqual(new THREE.Vector3(-1, 0, 0));
            expect(bbox.max).toApproximatelyEqual(new THREE.Vector3(1, 1, 1));
        });

        test('creating a temporary object updates the modifier', async () => {
            expect(db.temporaryObjects.children.length).toBe(0);
            expect(db.visibleObjects.length).toBe(2);

            expect(stack.modified.visible).toBe(true);
            expect(stack.premodified.visible).toBe(false);

            const makeFillet = new FilletFactory(modifiers, materials, signals);
            makeFillet.solid = box;
            const edge = box.edges.get(0);
            makeFillet.edges = [edge];
            makeFillet.distance = 0.1;
            await makeFillet.update();

            expect(stack.modified.visible).toBe(false);
            expect(stack.premodified.visible).toBe(false);
            expect(db.visibleObjects.length).toBe(2);
            expect(db.temporaryObjects.children.length).toBe(1);
            expect(modifiers.getByPremodified(box)).toBe(stack);

            const temp = db.temporaryObjects.children[0];
            const bbox = new THREE.Box3();
            bbox.setFromObject(temp);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            expect(center).toApproximatelyEqual(new THREE.Vector3(0, 0.5, 0.5));
            expect(bbox.min).toApproximatelyEqual(new THREE.Vector3(-1, 0, 0));
            expect(bbox.max).toApproximatelyEqual(new THREE.Vector3(1, 1, 1));

            await makeFillet.commit();
            expect(stack.modified.visible).toBe(true);
            expect(stack.premodified.visible).toBe(false);
        });

        test('creating a temporary object then cancelling makes the right objects visible', async () => {
            expect(db.temporaryObjects.children.length).toBe(0);
            expect(db.visibleObjects.length).toBe(2);

            expect(stack.modified.visible).toBe(true);
            expect(stack.premodified.visible).toBe(false);

            const makeFillet = new FilletFactory(modifiers, materials, signals);
            makeFillet.solid = box;
            const edge = box.edges.get(0);
            makeFillet.edges = [edge];
            makeFillet.distance = 0.1;
            await makeFillet.update();

            expect(stack.modified.visible).toBe(false);
            expect(stack.premodified.visible).toBe(false);

            expect(db.visibleObjects.length).toBe(2);
            expect(db.temporaryObjects.children.length).toBe(1);
            expect(modifiers.getByPremodified(box)).toBe(stack);

            makeFillet.cancel();
            expect(stack.modified.visible).toBe(true);
            expect(stack.premodified.visible).toBe(false);
        });

        describe("when modifying a specially optimized factory like move/rotate/scale", () => {
            test('creating a temporary object updates the modifier because the non-optimized code is run', async () => {
                expect(db.temporaryObjects.children.length).toBe(0);
                expect(db.visibleObjects.length).toBe(2);

                expect(stack.modified.visible).toBe(true);
                expect(stack.premodified.visible).toBe(false);

                const move = new MoveFactory(modifiers, materials, signals);
                move.items = [box];
                move.move = new THREE.Vector3(-0.5, 0, 0);
                await move.update();

                expect(stack.modified.visible).toBe(false);
                expect(stack.premodified.visible).toBe(false);
                expect(db.visibleObjects.length).toBe(2);
                expect(db.temporaryObjects.children.length).toBe(1);
                expect(modifiers.getByPremodified(box)).toBe(stack);

                const temp = db.temporaryObjects.children[0];
                const bbox = new THREE.Box3();
                bbox.setFromObject(temp);
                const center = new THREE.Vector3();
                bbox.getCenter(center);
                expect(center).toApproximatelyEqual(new THREE.Vector3(0, 0.5, 0.5));
                expect(bbox.min).toApproximatelyEqual(new THREE.Vector3(-0.5, 0, 0));
                expect(bbox.max).toApproximatelyEqual(new THREE.Vector3(0.5, 1, 1));

                await move.commit();
                expect(stack.modified.visible).toBe(true);
                expect(stack.premodified.visible).toBe(false);
            });

            test("if there's no modifier, the optimized code is run, and it cancels the correct optimized way", async () => {
                modifiers.remove(box);

                const move = new MoveFactory(modifiers, materials, signals);
                move.items = [box];
                move.move = new THREE.Vector3(-0.5, 0, 0);
                await move.update();

                expect(box.position).toApproximatelyEqual(new THREE.Vector3(-0.5, 0, 0));

                move.cancel();

                expect(box.position).toApproximatelyEqual(new THREE.Vector3(0, 0, 0));
            });
        })

        test('removing an item removes the modifier db', async () => {
            expect(modifiers.getByPremodified(box)).not.toBeUndefined();
            await modifiers.removeItem(box);
            expect(modifiers.getByPremodified(box)).toBeUndefined();
        })

        test('duplicating an object...', () => {

        })

        test('when a modified item is selected & then deselect ALL', () => {
            const { modified, premodified } = stack;
            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(false);

            modifiers.selected.addSolid(modified);

            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(true);
            for (const edge of modified.allEdges) {
                expect(edge.visible).toBe(false);
            }
            modified.traverse(child => {
                expect(child.layers.mask).toBe(unselectable.mask);
            });

            modifiers.selected.removeAll();
            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(false);
            for (const edge of modified.allEdges) {
                expect(edge.visible).toBe(true);
            }
            modified.traverse(child => {
                expect(child.layers.mask).not.toBe(unselectable.mask);
            });
        });

        test('when a modified item is selected & then a topology item is selected & then deselect ALL', () => {
            const { modified, premodified } = stack;
            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(false);

            modifiers.selected.addSolid(modified);
            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(true);

            const edge = premodified.edges.get(0)
            modifiers.selected.addEdge(edge, premodified);
            modifiers.selected.removeSolid(premodified);
            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(true);

            modifiers.selected.removeAll();

            expect(modified.visible).toBe(true);
            expect(premodified.visible).toBe(false);
            modified.traverse(child => {
                expect(child.layers.mask).not.toBe(unselectable.mask);
            });
        });

        describe('outlinable', () => {
            test('a regular object is outlinable when selected', async () => {
                const makeBox = new ThreePointBoxFactory(modifiers, materials, signals); // NOTE: passing in modifier rather than raw db as in most other tests
                makeBox.p1 = new THREE.Vector3();
                makeBox.p2 = new THREE.Vector3(1, 0, 0);
                makeBox.p3 = new THREE.Vector3(1, 1, 0);
                makeBox.p4 = new THREE.Vector3(1, 1, 1);
                const box = await makeBox.commit() as visual.Solid;

                modifiers.selected.addSolid(box);
                expect([...modifiers.selected.outlinable]).toEqual([box]);
            })

            test('a modified object is outlinable when selected, but the unmodified ancestor is not', () => {
                const { modified } = stack;
                modifiers.selected.addSolid(modified);
                expect([...modifiers.selected.outlinable]).toEqual([modified]);
            })

        })
    })
});