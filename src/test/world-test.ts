import { Color, Mesh, Vector3 } from 'three';
import { assert, type TestSuite } from './assert';
import { AddThreeComponent, CreateThreeEntity } from '../three/ecs';
import { ComponentRegistry, component, componentType, defineComponent, field } from '../three/schema';
import { World, type SceneDoc } from '../three/world';
import { decorators } from '../vite';

const registry = new ComponentRegistry();

@component('RigidBody', registry)
class RigidBody {
    @field({ options: ['dynamic', 'fixed', 'kinematic'] }) kind = 'dynamic';
    @field({ min: 0, step: 0.1 }) mass = 1;
    @field() velocity = new Vector3();
    @field() tint = new Color('#ff0000');
    @field({ transient: true }) sleeping = false;
    notAField = 'ignored';
}

@component('Sensor', registry)
class Sensor extends RigidBody {
    @field() radius = 2;
}

const Follow = defineComponent('Follow', {
    target: { type: 'entity', default: null },
    speed: { type: 'number', default: 3, min: 0 },
}, registry);

const Health = defineComponent('Health', { value: { type: 'number', default: 100 } }, registry);

const newWorld = () => new World({ registry });

export const worldTests: TestSuite = {
    'schema: @field infers types and defaults; undecorated fields are left out'() {
        const { schema } = componentType(RigidBody);
        assert.equal(schema.name, 'RigidBody');
        assert.deepEqual(Object.keys(schema.fields), ['kind', 'mass', 'velocity', 'tint', 'sleeping']);
        assert.equal(schema.fields.kind.type, 'enum');
        assert.equal(schema.fields.mass.type, 'number');
        assert.equal(schema.fields.mass.min, 0);
        assert.equal(schema.fields.velocity.type, 'vec3');
        assert.deepEqual(schema.fields.velocity.default, [0, 0, 0]);
        assert.equal(schema.fields.tint.type, 'color');
        assert.equal(schema.fields.tint.default, '#ff0000');
    },

    'schema: subclasses inherit fields without changing the parent'() {
        assert.deepEqual(Object.keys(componentType(Sensor).schema.fields), ['kind', 'mass', 'velocity', 'tint', 'sleeping', 'radius']);
        assert.ok(!('radius' in componentType(RigidBody).schema.fields));
    },

    'schema: create applies JSON into live three.js values in place'() {
        const body = registry.get('RigidBody')!.create({ mass: 5, velocity: [1, 2, 3], tint: '#00ff00' }) as RigidBody;
        assert.ok(body instanceof RigidBody);
        assert.ok(body.velocity instanceof Vector3);
        assert.deepEqual(body.velocity.toArray(), [1, 2, 3]);
        assert.equal(body.tint.getHexString(), '00ff00');
        assert.equal(body.mass, 5);
    },

    'schema: defineComponent makes plain objects with fresh defaults'() {
        const a = Follow.create();
        const b = Follow.create({ speed: 9 });
        assert.deepEqual(a, { target: null, speed: 3 });
        assert.equal(b.speed, 9);
        assert.ok(registry.resolve('Follow') === Follow);
        assert.ok(registry.resolve(RigidBody)?.schema.name === 'RigidBody');
    },

    'world: entities are keyed by Object3D.uuid'() {
        const world = newWorld();
        const e = world.create('ship');
        assert.equal(e.userData.entityId, e.uuid);
        assert.ok(world.get(e.uuid) === e);
        assert.equal(world.size, 1);
    },

    'world: add() tracks entities in an existing subtree; clone() fixes the copied id'() {
        const world = newWorld();
        const parent = CreateThreeEntity();
        const child = CreateThreeEntity();
        parent.add(new Mesh()); // not an entity: ignored
        parent.add(child);
        world.add(parent);
        assert.equal(world.size, 2);
        assert.ok(world.parentOf(child) === parent);

        const copy = child.clone() as typeof child; // three copies userData, makes a new uuid
        world.add(copy);
        assert.equal(copy.userData.entityId, copy.uuid);
        assert.equal(world.size, 3);
    },

    'world: query uses the component index'() {
        const world = newWorld();
        const a = world.create('a');
        const b = world.create('b');
        world.addComponent(a, RigidBody);
        world.addComponent(b, RigidBody);
        world.addComponent(b, Health);
        assert.deepEqual(world.query(RigidBody).map((e) => e.name), ['a', 'b']);
        assert.deepEqual(world.query('RigidBody', Health).map((e) => e.name), ['b']);
        world.removeComponent(b, 'RigidBody');
        assert.deepEqual(world.query(RigidBody).map((e) => e.name), ['a']);
        world.remove(a);
        assert.equal(world.query(RigidBody).length, 0);
    },

    'world: components added with the raw ecs helpers are indexed when tracked'() {
        const world = newWorld();
        const e = CreateThreeEntity();
        AddThreeComponent(e, 'Health', { value: 1 });
        world.add(e);
        assert.equal(world.query('Health').length, 1);
    },

    'world: events'() {
        const world = newWorld();
        const log: string[] = [];
        world.on('entityAdded', (e) => log.push(`+${e.name}`));
        world.on('entityRemoved', (e) => log.push(`-${e.name}`));
        world.on('componentAdded', (_, name) => log.push(`+${name}`));
        const stop = world.on('changed', (e, c, f) => log.push(`~${e.name}.${c}.${f}`));
        const e = world.create('x');
        world.addComponent(e, Health);
        world.changed(e, Health, 'value');
        stop();
        world.changed(e, Health, 'value');
        world.remove(e);
        assert.deepEqual(log, ['+x', '+Health', '~x.Health.value', '-x']);
    },

    'world: systems run on their query'() {
        const world = newWorld();
        world.addComponent(world.create('a'), RigidBody, { velocity: [1, 0, 0] });
        world.create('b');
        world.addSystem((entities, dt, w) => {
            for (const e of entities) e.position.addScaledVector(w.getComponent<RigidBody>(e, RigidBody)!.velocity, dt);
        }, [RigidBody]);
        world.update(0.5);
        assert.equal(world.findByName('a')[0].position.x, 0.5);
        assert.equal(world.findByName('b')[0].position.x, 0);
    },

    'world: reparent keeps the world transform and refuses cycles'() {
        const world = newWorld();
        const a = world.create('a');
        a.position.set(10, 0, 0);
        const b = world.create('b');
        b.position.set(3, 0, 0);
        world.reparent(b, a);
        assert.equal(b.position.x, -7);
        let threw = false;
        try { world.reparent(a, b); } catch { threw = true; }
        assert.ok(threw);
    },

    'world: serialize → load round-trips uuids, hierarchy, transforms and components'() {
        const world = newWorld();
        const ship = world.create('ship');
        ship.position.set(1, 2, 3);
        ship.rotation.set(0, Math.PI / 2, 0);
        world.addComponent(ship, RigidBody, { mass: 4, velocity: [0, 1, 0], sleeping: true });
        const gun = world.create('gun', ship);
        world.addComponent(gun, Follow, { target: ship.uuid });
        AddThreeComponent(gun, 'FromAPlugin', { anything: [1, 2] }); // unknown type: kept as-is

        const doc: SceneDoc = JSON.parse(JSON.stringify(world.serialize({ camera: 'ortho' })));
        assert.equal(doc.entities.length, 2);
        assert.equal(doc.entities[1].parent, ship.uuid);
        assert.ok(!('sleeping' in doc.entities[0].components.RigidBody)); // transient

        const loaded = newWorld();
        loaded.load(doc);
        const ship2 = loaded.get(ship.uuid)!;
        const gun2 = loaded.get(gun.uuid)!;
        assert.ok(gun2.parent === ship2);
        assert.deepEqual(ship2.position.toArray(), [1, 2, 3]);
        assert.ok(Math.abs(ship2.rotation.y - Math.PI / 2) < 1e-9);
        const body = loaded.getComponent<RigidBody>(ship2, RigidBody)!;
        assert.ok(body instanceof RigidBody && body.velocity instanceof Vector3);
        assert.equal(body.mass, 4);
        assert.equal(body.sleeping, false);
        assert.equal(loaded.getComponent<any>(gun2, Follow).target, ship.uuid);
        assert.deepEqual(gun2.userData.components.FromAPlugin, { anything: [1, 2] });
        assert.deepEqual(loaded.serialize({ camera: 'ortho' }), doc);
    },

    'world: clone gives new uuids and remaps entity references inside the copy'() {
        const world = newWorld();
        const ship = world.create('ship');
        const gun = world.create('gun', ship);
        world.addComponent(gun, Follow, { target: ship.uuid });
        const outside = world.create('outside');
        world.addComponent(ship, Follow, { target: outside.uuid });

        const copy = world.clone(ship);
        assert.ok(copy.uuid !== ship.uuid);
        assert.equal(world.size, 5);
        const gunCopy = world.childrenOf(copy)[0];
        assert.equal(world.getComponent<any>(gunCopy, Follow).target, copy.uuid); // remapped
        assert.equal(world.getComponent<any>(copy, Follow).target, outside.uuid); // left alone
    },

    async 'vite: decorators() skips files without decorators and lowers ones with them'() {
        const plugin = decorators();
        assert.equal(await plugin.transform('const a = 1;', '/src/a.ts'), null);
        assert.equal(await plugin.transform('@field() x = 1', '/node_modules/x/a.ts'), null);
        const out = await plugin.transform('class A { @field() x = 1 }\nfunction field() { return () => {} }', '/src/a.ts?t=1');
        assert.ok(out && !/@field/.test(out.code));
    },
};
