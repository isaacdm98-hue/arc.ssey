
import {
    AdditiveBlending,
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Scene,
    Vector3,
    Color
} from 'three';

interface Particle {
    position: Vector3;
    velocity: Vector3;
    life: number;
    initialLife: number;
}

export interface ParticleConfig {
    particlesPerSecond: number;
    particleLifetime: number;
    color: number;
    size: number;
    gravity?: number;
    spread?: number;
}

interface Emitter {
    position: Vector3;
    accumulator: number;
}

export class ParticleTrail {
    private scene: Scene;
    private particles: Particle[] = [];
    private points: Points;
    public emitters: Emitter[] = [];
    private readonly maxParticles = 1000; // Increased capacity for cinematic effect
    public config: ParticleConfig;

    constructor(scene: Scene, config: Partial<ParticleConfig> = {}) {
        this.scene = scene;

        this.config = {
            particlesPerSecond: config.particlesPerSecond ?? 100,
            particleLifetime: config.particleLifetime ?? 1.5,
            color: config.color ?? 0xffffff,
            size: config.size ?? 2.0,
            gravity: config.gravity ?? 0,
            spread: config.spread ?? 2.0,
        };

        const geo = new BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const colors = new Float32Array(this.maxParticles * 3);
        const sizes = new Float32Array(this.maxParticles);
        geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
        geo.setAttribute('size', new Float32BufferAttribute(sizes, 1));


        const mat = new PointsMaterial({
            vertexColors: true,
            blending: AdditiveBlending,
            depthWrite: false,
            transparent: true,
            size: this.config.size, // This is now a base size
        });

        this.points = new Points(geo, mat);
        this.scene.add(this.points);

        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                position: new Vector3(0, -1000, 0), // Start hidden
                velocity: new Vector3(),
                life: 0,
                initialLife: 1
            });
        }
        
        this.addEmitter(new Vector3());
    }
    
    public addEmitter(position: Vector3): Emitter {
        const emitter = {
            position: position,
            accumulator: 0,
        };
        this.emitters.push(emitter);
        return emitter;
    }

    private emitParticle(emitter: Emitter) {
        const p = this.particles.find(p => p.life <= 0);
        if (!p) return;

        p.position.copy(emitter.position);
        const spread = this.config.spread ?? 2.0;
        const gravity = this.config.gravity ?? 0;

        p.velocity.set(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread - (gravity * 0.2), // Add slight upward bias if there's gravity
            (Math.random() - 0.5) * spread
        );
        p.life = this.config.particleLifetime * (Math.random() * 0.4 + 0.8); // Randomize lifetime slightly
        p.initialLife = p.life;
    }

    public update(delta: number) {
        for (const emitter of this.emitters) {
            if (this.config.particlesPerSecond > 0) {
                const rate = 1.0 / this.config.particlesPerSecond;
                emitter.accumulator += delta;
                while (emitter.accumulator > rate) {
                    this.emitParticle(emitter);
                    emitter.accumulator -= rate;
                }
            }
        }
        
        const positions = this.points.geometry.attributes.position.array as Float32Array;
        const colors = this.points.geometry.attributes.color.array as Float32Array;
        const sizes = this.points.geometry.attributes.size.array as Float32Array;

        const baseColor = new Color(this.config.color);

        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (p.life > 0) {
                p.life -= delta;

                const gravity = this.config.gravity ?? 0;
                if (gravity !== 0) {
                    p.velocity.y -= gravity * delta;
                }
                p.position.addScaledVector(p.velocity, delta);
                
                positions[i * 3] = p.position.x;
                positions[i * 3 + 1] = p.position.y;
                positions[i * 3 + 2] = p.position.z;
                
                const alpha = p.life / p.initialLife;
                
                colors[i * 3] = baseColor.r * alpha;
                colors[i * 3 + 1] = baseColor.g * alpha;
                colors[i * 3 + 2] = baseColor.b * alpha;

                sizes[i] = this.config.size * alpha;
                
            } else {
                 positions[i * 3 + 1] = -1000; // Hide dead particles
            }
        }
        
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        this.points.geometry.attributes.size.needsUpdate = true;
    }
}
