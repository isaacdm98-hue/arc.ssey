/**
 * NebulaSkybox.ts — Procedural swirling nebula skybox with data rain
 * Wind Waker at night meets cosmic ocean. Dynamic, beautiful, alive.
 */
import {
    Scene, Mesh, ShaderMaterial, BackSide, IcosahedronGeometry,
    AdditiveBlending, Color, Vector3, PointsMaterial, BufferGeometry,
    Float32BufferAttribute, Points, LineBasicMaterial, Line,
    MeshBasicMaterial, SphereGeometry
} from 'three';

// --- DATA RAIN ---
// Thin silver lines falling from sky to ocean — the "falling internet remnants"
interface DataRainDrop {
    active: boolean;
    x: number;
    z: number;
    y: number;
    speed: number;
    length: number;
    life: number;
}

class DataRainSystem {
    private drops: DataRainDrop[] = [];
    private positions: Float32Array;
    private points: Points;
    private readonly maxDrops = 12;
    private spawnTimer = 0;

    // Small splash particles for when drops hit water
    private splashPositions: Float32Array;
    private splashPoints: Points;
    private splashes: { x: number; z: number; life: number; scale: number }[] = [];

    constructor(scene: Scene) {
        // Rain streaks rendered as points with large size
        this.positions = new Float32Array(this.maxDrops * 2 * 3); // top + bottom of each streak
        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
        const mat = new PointsMaterial({
            color: 0xaaccff,
            size: 1.5,
            transparent: true,
            opacity: 0.6,
            blending: AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });
        this.points = new Points(geo, mat);
        scene.add(this.points);

        // Splash particles
        this.splashPositions = new Float32Array(20 * 3);
        const splashGeo = new BufferGeometry();
        splashGeo.setAttribute('position', new Float32BufferAttribute(this.splashPositions, 3));
        const splashMat = new PointsMaterial({
            color: 0x88ddff,
            size: 3,
            transparent: true,
            opacity: 0.4,
            blending: AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });
        this.splashPoints = new Points(splashGeo, splashMat);
        scene.add(this.splashPoints);

        for (let i = 0; i < this.maxDrops; i++) {
            this.drops.push({ active: false, x: 0, z: 0, y: 0, speed: 0, length: 0, life: 0 });
        }
    }

    update(delta: number, skiffPosition: Vector3) {
        this.spawnTimer -= delta;

        // Spawn new drops
        if (this.spawnTimer <= 0) {
            const drop = this.drops.find(d => !d.active);
            if (drop) {
                drop.active = true;
                drop.x = skiffPosition.x + (Math.random() - 0.5) * 3000;
                drop.z = skiffPosition.z + (Math.random() - 0.5) * 3000;
                drop.y = 2000 + Math.random() * 1000;
                drop.speed = 400 + Math.random() * 300;
                drop.length = 40 + Math.random() * 60;
                drop.life = 1;
            }
            this.spawnTimer = 0.3 + Math.random() * 0.8; // Spawn every 0.3-1.1s
        }

        // Update drops
        for (let i = 0; i < this.maxDrops; i++) {
            const drop = this.drops[i];
            const idx = i * 6; // 2 points * 3 components
            if (drop.active) {
                drop.y -= drop.speed * delta;

                // Hit water surface
                if (drop.y <= 0) {
                    drop.active = false;
                    // Trigger splash
                    this.triggerSplash(drop.x, drop.z);
                }

                // Top of streak
                this.positions[idx] = drop.x;
                this.positions[idx + 1] = drop.y + drop.length;
                this.positions[idx + 2] = drop.z;
                // Bottom of streak
                this.positions[idx + 3] = drop.x;
                this.positions[idx + 4] = drop.y;
                this.positions[idx + 5] = drop.z;
            } else {
                // Hide inactive
                for (let j = 0; j < 6; j++) this.positions[idx + j] = -99999;
            }
        }
        this.points.geometry.attributes.position.needsUpdate = true;

        // Update splashes
        let splashIdx = 0;
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            s.life -= delta * 2;
            if (s.life <= 0) {
                this.splashes.splice(i, 1);
                continue;
            }
            s.scale += delta * 30;
            if (splashIdx < 20) {
                this.splashPositions[splashIdx * 3] = s.x + Math.cos(splashIdx * 1.2) * s.scale;
                this.splashPositions[splashIdx * 3 + 1] = s.life * 3;
                this.splashPositions[splashIdx * 3 + 2] = s.z + Math.sin(splashIdx * 1.2) * s.scale;
                splashIdx++;
            }
        }
        // Hide unused splash slots
        for (let i = splashIdx; i < 20; i++) {
            this.splashPositions[i * 3 + 1] = -99999;
        }
        this.splashPoints.geometry.attributes.position.needsUpdate = true;
    }

    private triggerSplash(x: number, z: number) {
        for (let i = 0; i < 4; i++) {
            this.splashes.push({ x, z, life: 1, scale: 0 });
        }
    }

    dispose(scene: Scene) {
        this.points.geometry.dispose();
        (this.points.material as PointsMaterial).dispose();
        this.splashPoints.geometry.dispose();
        (this.splashPoints.material as PointsMaterial).dispose();
        scene.remove(this.points);
        scene.remove(this.splashPoints);
    }
}

export class NebulaSkybox {
    private skyMesh: Mesh;
    private material: ShaderMaterial;
    private starField: Points;
    private dataRain: DataRainSystem;
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;

        // --- Procedural Nebula Shader ---
        this.material = new ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uNebulaColor1: { value: new Color(0x0a0520) },
                uNebulaColor2: { value: new Color(0x1a0a3e) },
                uNebulaColor3: { value: new Color(0x0d2847) },
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uNebulaColor1;
                uniform vec3 uNebulaColor2;
                uniform vec3 uNebulaColor3;
                varying vec3 vWorldPosition;

                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod289(i);
                    vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    float n_ = 0.142857142857;
                    vec3 ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);
                    vec4 x = x_ * ns.x + ns.yyyy;
                    vec4 y = y_ * ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
                    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
                }

                float fbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 1.0;
                    for (int i = 0; i < 5; i++) {
                        value += amplitude * snoise(p * frequency);
                        amplitude *= 0.5;
                        frequency *= 2.0;
                    }
                    return value;
                }

                float hash(vec3 p) {
                    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
                    p += dot(p, p.yxz + 19.19);
                    return fract((p.x + p.y) * p.z);
                }

                void main() {
                    vec3 dir = normalize(vWorldPosition);
                    float time = uTime * 0.02;

                    // Swirling nebula layers
                    float n1 = fbm(dir * 2.0 + time * 0.3);
                    float n2 = fbm(dir * 4.0 - time * 0.2 + 10.0);
                    float swirl = snoise(dir * 3.0 + vec3(time * 0.1, time * 0.15, time * 0.05));

                    vec3 nebula = mix(uNebulaColor1, uNebulaColor2, smoothstep(-0.3, 0.5, n1 + swirl * 0.3));
                    nebula = mix(nebula, uNebulaColor3, smoothstep(0.0, 0.8, n2));

                    // Bright nebula wisps
                    float wisps = pow(max(0.0, n1 * n2 + 0.2), 3.0);
                    nebula += vec3(0.15, 0.05, 0.25) * wisps;

                    // Aurora near horizon
                    float horizon = 1.0 - abs(dir.y);
                    float aurora = smoothstep(0.7, 1.0, horizon) * (snoise(vec3(dir.x * 5.0, time, dir.z * 5.0)) * 0.5 + 0.5);
                    nebula += vec3(0.0, 0.15, 0.2) * aurora * 0.5;

                    // Embedded stars
                    vec3 starDir = dir * 300.0;
                    vec3 starCell = floor(starDir);
                    float starHash = hash(starCell);
                    vec3 starOffset = fract(starDir) - 0.5;
                    float starDist = length(starOffset);
                    float starBrightness = step(0.97, starHash) * smoothstep(0.03, 0.0, starDist);
                    starBrightness *= 0.5 + 0.5 * sin(uTime * (3.0 + starHash * 10.0) + starHash * 100.0);
                    vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.8, 0.6), starHash);
                    nebula += starColor * starBrightness * 2.0;

                    // Milky Way band
                    float milkyWay = smoothstep(0.3, 0.0, abs(dir.y - 0.1 + sin(dir.x * 2.0) * 0.1));
                    float milkyNoise = fbm(dir * 8.0 + time * 0.05) * 0.5 + 0.5;
                    nebula += vec3(0.08, 0.06, 0.12) * milkyWay * milkyNoise;

                    gl_FragColor = vec4(nebula, 1.0);
                }
            `,
            side: BackSide,
            depthWrite: false,
        });

        const skyGeo = new IcosahedronGeometry(20000, 4);
        this.skyMesh = new Mesh(skyGeo, this.material);
        scene.add(this.skyMesh);

        // Particle star field for extra sparkle
        this.starField = this.createStarField();
        scene.add(this.starField);

        // Data rain — falling internet remnants
        this.dataRain = new DataRainSystem(scene);
    }

    private createStarField(): Points {
        const count = 3000;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 15000 + Math.random() * 3000;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(positions, 3));

        const mat = new PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.8,
            blending: AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        return new Points(geo, mat);
    }

    update(time: number, skiffPosition: Vector3, delta?: number) {
        this.material.uniforms.uTime.value = time;
        this.skyMesh.position.copy(skiffPosition);
        this.starField.position.copy(skiffPosition);
        this.skyMesh.rotation.y = time * 0.001;
        this.starField.rotation.y = time * 0.0005;
        this.starField.rotation.x = Math.sin(time * 0.0003) * 0.01;

        // Update data rain
        if (delta) {
            this.dataRain.update(delta, skiffPosition);
        }
    }

    dispose() {
        this.skyMesh.geometry.dispose();
        this.material.dispose();
        this.starField.geometry.dispose();
        (this.starField.material as PointsMaterial).dispose();
        this.scene.remove(this.skyMesh);
        this.scene.remove(this.starField);
        this.dataRain.dispose(this.scene);
    }
}
