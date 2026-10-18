import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, PointLight, Points, PointsMaterial, SphereGeometry, Vector3 } from 'three';
import { Rng, rng } from '../rng';

/**
 * Points spread uniformly over a sphere's surface, for a distant star backdrop (point size 5 with
 * size attenuation, 0.9 opacity). The same `seed` always gives the same stars; without one,
 * positions come from the shared {@link rng}.
 *
 * @param radius sphere radius in world units
 * @param count number of stars
 * @param color 0xRRGGBB
 * @param seed seeds a private {@link Rng} for a reproducible starfield
 * @category Geometry & Meshes
 */
export function CreateStarfield(
    radius = 1000,
    count = 5000,
    color = 0xffffff,
    seed?: number,
): Points {
    const random = seed === undefined ? rng : new Rng(seed);
    const geometry = new BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const theta = random.nextFloat() * Math.PI * 2;
        const phi = Math.acos((random.nextFloat() * 2) - 1);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        positions.set([x, y, z], i * 3);
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    const material = new PointsMaterial({
        color,
        size: 5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
    });

    const stars = new Points(geometry, material);
    stars.name = 'Starfield';

    return stars;
}

/**
 * A sun: a bright unlit sphere (radius 50, color 0xffddaa) plus a white `PointLight` (intensity
 * 10, no distance falloff) at the same spot.
 *
 * @param position where to put both, in the group's space; default the origin
 * @category Geometry & Meshes
 */
export function CreateSystemStar(position?: Vector3): Group {
    const star = new Group();

    // Star position (far away)
    const starPos = position ?? new Vector3();

    // Bright emissive sphere
    const starGeo = new SphereGeometry(50, 32, 32);
    const starMat = new MeshBasicMaterial({ color: 0xffddaa });
    const starMesh = new Mesh(starGeo, starMat);
    starMesh.position.copy(starPos);
    star.add(starMesh);

    // Strong point light
    const starLight = new PointLight(0xffffff, 10, 0, 0);
    starLight.position.copy(starPos);
    star.add(starLight);

    return star;
}
