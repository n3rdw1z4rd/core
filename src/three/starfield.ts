import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, PointLight, Points, PointsMaterial, SphereGeometry, Vector3 } from 'three';
import { rng } from '../rng';

export function CreateStarfield(
    radius = 1000,
    count = 5000,
    color = 0xffffff,
): Points {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const theta = rng.nextf * Math.PI * 2;
        const phi = Math.acos((rng.nextf * 2) - 1);
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
