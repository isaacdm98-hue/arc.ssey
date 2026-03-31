







import {
  Scene, Object3D, Mesh, Color, Vector3, BufferGeometry, Float32BufferAttribute,
  Points, PointsMaterial, AdditiveBlending, ShaderMaterial, Quaternion, MathUtils, MeshBasicMaterial
} from 'three';

// --- TYPE DEFINITIONS ---
interface ActiveCreature {
  mesh: Object3D;
  state: string;
  life: number;
  velocity: Vector3;
  [key: string]: any; // For extra state data
}
type CompanionType = 'none' | 'dolphin' | 'gull';


// --- PARTICLE SYSTEM UTILITY ---
class SplashParticles {
    private points: Points;
    private particles: { position: Vector3; velocity: Vector3; life: number }[] = [];
    private readonly particleCount = 100;

    constructor(scene: Scene, color: number, size: number) {
        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(this.particleCount * 3), 3));
        const mat = new PointsMaterial({ color, size, transparent: true, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true });
        this.points = new Points(geo, mat);
        this.points.visible = false;
        scene.add(this.points);

        for(let i=0; i < this.particleCount; i++) {
            this.particles.push({ position: new Vector3(), velocity: new Vector3(), life: 0 });
        }
    }

    trigger(position: Vector3, speed: number, count: number) {
      this.points.position.copy(position);
      this.points.visible = true;
      let triggeredCount = 0;
      for (const p of this.particles) {
          if (p.life <= 0 && triggeredCount < count) {
            p.life = 1.2 + Math.random() * 0.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            p.velocity.set(
                Math.sin(phi) * Math.cos(theta),
                Math.abs(Math.sin(phi) * Math.sin(theta)), // Upward splash
                Math.cos(phi)
            ).multiplyScalar(Math.random() * speed + (speed / 2));
            triggeredCount++;
          }
      }
    }

    update(dt: number) {
      if (!this.points.visible) return;
      const positions = this.points.geometry.attributes.position.array as Float32Array;
      let aliveCount = 0;
      for (let i = 0; i < this.particleCount; i++) {
          const p = this.particles[i];
          if (p.life > 0) {
              p.life -= dt * 1.5;
              p.velocity.y -= 25 * dt; // Gravity
              
              const particlePosIndex = i * 3;
              positions[particlePosIndex] += p.velocity.x * dt;
              positions[particlePosIndex+1] += p.velocity.y * dt;
              positions[particlePosIndex+2] += p.velocity.z * dt;

              if (positions[particlePosIndex+1] < -this.points.position.y) { // Hit water level
                  p.life = 0;
              }
              aliveCount++;
          } else {
              positions[i*3+1] = -10000; // Hide dead particles effectively
          }
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      if (aliveCount === 0) {
          this.points.visible = false;
          for (let i=0; i < this.particleCount * 3; i++) { positions[i] = 0; }
      }
    }
}

// --- SEA LIFE MANAGER ---
export class SeaLifeManager {
  private scene: Scene;
  private skiff: Object3D;
  private onGullRequest: () => void;
  
  private dolphinPool: Mesh[] = [];
  private activeDolphin: ActiveCreature | null = null;
  private gullPool: Object3D[] = [];
  private activeGull: ActiveCreature | null = null;
  
  private splashes: SplashParticles;
  private companionCooldown = 0;

  constructor(scene: Scene, skiff: Object3D, onGullRequest: () => void) {
    this.scene = scene;
    this.skiff = skiff;
    this.onGullRequest = onGullRequest;
    this.splashes = new SplashParticles(scene, 0xaaffff, 2.5);
    this.initPools();
  }
  
  public getActiveGull = (): Object3D | null => this.activeGull?.mesh || null;
  
  public toggleVisibility(visible: boolean) {
      if (!visible) {
          if (this.activeDolphin) {
              this.activeDolphin.mesh.visible = false;
              this.activeDolphin = null;
          }
          if (this.activeGull) {
              this.activeGull.mesh.visible = false;
              this.activeGull = null;
          }
      }
  }

  private initPools() {
      // --- Dolphin Pool ---
      const dolphinGeo = this.createDolphinGeometry();
      const dolphinMat = new ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new Color(0x88ddff) },
                uGlowColor: { value: new Color(0xaaffff) },
                uSkiffPos: { value: new Vector3() },
            },
            vertexShader: `
                uniform float uTime;
                varying vec3 vNormal; 
                varying vec3 vViewPosition;
                varying vec3 vWorldPosition;
                void main() {
                    vec3 pos = position;
                    float bodyWave = sin(pos.z * 0.5 - uTime * 10.0) * pow(max(0.0, (pos.z + 2.0) * 0.1), 2.0);
                    pos.y += bodyWave * 0.8;

                    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                    vWorldPosition = worldPos.xyz;

                    vec4 mvPosition = viewMatrix * worldPos;
                    vViewPosition = -mvPosition.xyz;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor; uniform vec3 uGlowColor; uniform float uTime; uniform vec3 uSkiffPos;
                varying vec3 vNormal; varying vec3 vViewPosition; varying vec3 vWorldPosition;

                vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
                vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
                vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
                float snoise(vec2 v){
                    const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
                    vec2 i=floor(v+dot(v,C.yy));
                    vec2 x0=v-i+dot(i,C.xx);
                    vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
                    vec2 x1=x0.xy+C.xx-i1;
                    vec2 x2=x0.xy+C.zz;
                    i=mod289(i);
                    vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
                    vec3 m=max(.5-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.);
                    m=m*m;m=m*m;
                    vec3 x=2.*fract(p*C.www)-1.;
                    vec3 h=abs(x)-.5;
                    vec3 ox=floor(x+.5);
                    vec3 a0=x-ox;
                    m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
                    vec3 g;
                    g.x=a0.x*x0.x+h.x*x0.y;
                    g.yz=a0.yz*vec2(x1.x,x2.x)+h.yz*vec2(x1.y,x2.y);
                    return 130.*dot(m,g);
                }

                void main() {
                    float fresnel=pow(1.-abs(dot(normalize(vViewPosition),vNormal)),3.);
                    float noise=snoise(vWorldPosition.xz*.05+uTime*.5)*.5+.5;
                    noise=pow(noise,2.);
                    float distToSkiff=distance(vWorldPosition,uSkiffPos);
                    float skiffLight=smoothstep(80.,10.,distToSkiff)*.5;
                    vec3 base=mix(uColor,uGlowColor,fresnel+skiffLight);
                    vec3 finalColor=base+(uGlowColor*noise*.3);
                    gl_FragColor=vec4(finalColor,.6+fresnel*.4);
                }
            `,
            transparent: true, blending: AdditiveBlending, depthWrite: false,
       });

      for (let i = 0; i < 2; i++) {
          const dolphin = new Mesh(dolphinGeo, dolphinMat.clone());
          dolphin.visible = false;
          this.dolphinPool.push(dolphin);
          this.scene.add(dolphin);
      }
      
      // --- Gull Pool ---
      for (let i = 0; i < 2; i++) {
          const gull = this.createGullObject();
          gull.visible = false;
          this.gullPool.push(gull);
          this.scene.add(gull);
      }
  }

  private spawnCompanion(type: CompanionType) {
      if (type === 'dolphin') {
          const dolphinMesh = this.dolphinPool.find(d => !d.visible);
          if (!dolphinMesh) return;
          
          const side = Math.random() > 0.5 ? 1 : -1;
          const spawnOffset = new Vector3(side * 80, -20, 60).applyQuaternion(this.skiff.quaternion);
          dolphinMesh.position.copy(this.skiff.position).add(spawnOffset);
          dolphinMesh.rotation.copy(this.skiff.rotation);
          dolphinMesh.visible = true;

          this.activeDolphin = {
              mesh: dolphinMesh, state: 'breaching',
              life: 60 + Math.random() * 30, // Stay longer
              velocity: new Vector3(0, 40, -30),
              flybyTimer: 70 + Math.random() * 30, // Longer close fly-by
          };
      } else if (type === 'gull') {
          const gullMesh = this.gullPool.find(g => !g.visible);
          if (!gullMesh) return;
          
          this.onGullRequest();
          const side = Math.random() > 0.5 ? 1 : -1;
          const spawnOffset = new Vector3(side * 300, 100, -400).applyQuaternion(this.skiff.quaternion);
          gullMesh.position.copy(this.skiff.position).add(spawnOffset);
          gullMesh.visible = true;
          
          this.activeGull = {
              mesh: gullMesh, state: 'close_flyby',
              life: 50 + Math.random() * 20, // Stay longer
              velocity: new Vector3(),
              flapCycle: Math.random() * Math.PI * 2,
              flybyTimer: 60 + Math.random() * 20, // Longer close fly-by
          };
      }
  }

  public update(delta: number, time: number, skiffSpeed: number) {
      this.splashes.update(delta);
      this.companionCooldown = Math.max(0, this.companionCooldown - delta);

      // --- Spawning Logic ---
      if (skiffSpeed > 100 && this.companionCooldown <= 0 && !this.activeDolphin && !this.activeGull) {
          const companionType: CompanionType = Math.random() > 0.4 ? 'dolphin' : 'gull';
          this.spawnCompanion(companionType);
          this.companionCooldown = 45 + Math.random() * 30; // Cooldown before next companion can spawn
      }

      // --- Update Active Companion ---
      if (this.activeDolphin) {
          this.activeDolphin.life -= delta;
          if (this.activeDolphin.life <= 0) {
              this.activeDolphin.mesh.visible = false;
              this.activeDolphin = null;
          } else {
              this.updateDolphinState(this.activeDolphin, delta, time, skiffSpeed);
          }
      }
      
      if (this.activeGull) {
          this.activeGull.life -= delta;
          if (this.activeGull.life <= 0) {
              this.activeGull.mesh.visible = false;
              this.activeGull = null;
          } else {
              this.updateGullState(this.activeGull, delta, time);
          }
      }
  }
  
  private updateDolphinState(dolphin: ActiveCreature, dt: number, time: number, skiffSpeed: number) {
      const skiffVel = new Vector3(0, 0, -skiffSpeed).applyQuaternion(this.skiff.quaternion);
      const material = (dolphin.mesh as Mesh).material as ShaderMaterial;
      material.uniforms.uTime.value = time;
      material.uniforms.uSkiffPos.value.copy(this.skiff.position);
      
      dolphin.flybyTimer -= dt;
      const isCloseFlyby = dolphin.flybyTimer > 0;

      switch(dolphin.state) {
          case 'breaching':
              dolphin.mesh.position.add(dolphin.velocity.clone().multiplyScalar(dt));
              dolphin.velocity.y += 40 * dt; // Accelerate upwards
              if (dolphin.mesh.position.y >= -10) {
                  // this.splashes.trigger(dolphin.mesh.position, 40, 100);
                  dolphin.state = 'following';
                  dolphin.velocity.copy(skiffVel);
              }
              break;
          case 'following':
              const side = dolphin.mesh.id % 2 === 0 ? -1 : 1;
              
              const targetOffset = isCloseFlyby 
                ? new Vector3(side * 8, 0, 5).applyQuaternion(this.skiff.quaternion) // Closer and alongside
                : new Vector3(side * 45, -3, Math.sin(time + dolphin.mesh.id) * 25 - 10).applyQuaternion(this.skiff.quaternion);

              const desiredPos = this.skiff.position.clone().add(targetOffset);

              const steer = desiredPos.sub(dolphin.mesh.position);
              dolphin.velocity.lerp(steer, 1.5 * dt);

              const maxSpeed = skiffVel.length() * 1.2 + 20;
              dolphin.velocity.clampLength(0, maxSpeed);
              
              dolphin.mesh.position.add(dolphin.velocity.clone().multiplyScalar(dt));
              dolphin.mesh.quaternion.slerp(new Quaternion().setFromUnitVectors(new Vector3(0,0,-1), dolphin.velocity.clone().normalize()), 0.1);
              
              if (dolphin.mesh.position.y > 0) dolphin.velocity.y -= 50 * dt; // Gravity
              
              if (dolphin.mesh.position.y < -2 && Math.random() < (isCloseFlyby ? 0.02 : 0.01)) { // Jump more often when close
                  dolphin.velocity.y = 70 + Math.random() * 20; // JUMP!
                  dolphin.velocity.multiplyScalar(1.1); // Speed boost
              }
              
              if (dolphin.velocity.y < 0 && Math.abs(dolphin.mesh.position.y) < 2) {
                  // this.splashes.trigger(dolphin.mesh.position, 30, 80);
                  dolphin.velocity.y *= 0.1;
              }
              break;
      }
  }
  
  private updateGullState(gull: ActiveCreature, dt: number, time: number) {
      gull.flybyTimer -= dt;
      const state = gull.flybyTimer > 0 ? 'close_flyby' : 'following';
      
      const side = gull.mesh.id % 2 === 0 ? -1 : 1;
      
      const targetOffset = (state === 'close_flyby')
        ? new Vector3(side * 12, 10, 15).applyQuaternion(this.skiff.quaternion) // Closer, alongside, and above
        : new Vector3(side * 30, 35, -40).applyQuaternion(this.skiff.quaternion);
      
      const desiredPos = this.skiff.position.clone().add(targetOffset);
      
      const steer = desiredPos.sub(gull.mesh.position);
      gull.velocity.lerp(steer, 1.5 * dt);
      gull.velocity.clampLength(0, 400);

      gull.mesh.position.add(gull.velocity.clone().multiplyScalar(dt));
      gull.mesh.quaternion.slerp(new Quaternion().setFromUnitVectors(new Vector3(0,0,-1), gull.velocity.clone().normalize()), 0.1);
      
      // Wing flap animation
      gull.flapCycle += dt * 15;
      const flapAngle = Math.sin(gull.flapCycle) * 0.8;
      (gull.mesh.children[1] as Mesh).rotation.z = flapAngle;
      (gull.mesh.children[2] as Mesh).rotation.z = -flapAngle;
  }

  private createDolphinGeometry(): BufferGeometry {
      const geo = new BufferGeometry();
      const vertices = new Float32Array([
        // Snout (0-3)
        0, 0.5, -6, -1, 0, -4, 1, 0, -4, 0, -0.8, -4,
        // Head (4-7)
        -2, 2, -2, 2, 2, -2, -2, -1, -2, 2, -1, -2,
        // Body (8-11)
        -2.5, 2.5, 3, 2.5, 2.5, 3, -2.5, -1.5, 3, 2.5, -1.5, 3,
        // Tail stem (12)
        0, 0.5, 8,
        // Dorsal Fin (13)
        0, 4.5, 1,
        // Pectoral Fins (14-15)
        -4, -0.5, 0, 4, -0.5, 0,
        // Tail Flukes (16-18)
        -4.5, 0.2, 10, 4.5, 0.2, 10, 0, 0.2, 9,
      ]);
      const indices = [
        0,2,1, 0,1,3, 0,3,2, 1,2,5, 1,5,4, 1,4,6, 1,6,3, 2,3,7, 2,7,5,
        4,5,9, 4,9,8, 5,7,11, 5,11,9, 6,4,8, 6,8,10, 7,6,10, 7,10,11,
        8,9,12, 8,12,10, 9,11,12, 10,12,11,
        4,13,5, 8,13,4, 9,5,13,
        6,14,10, 7,11,15,
        12,17,18, 12,18,16
      ];
      geo.setIndex(indices);
      geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      geo.scale(3, 3, 3); // Make them slightly larger
      return geo;
  }
  
  private createGullObject(): Object3D {
      const gull = new Object3D();
      const bodyMat = new MeshBasicMaterial({ color: 0xffffff });
      const wingMat = new MeshBasicMaterial({ color: 0xcccccc });

      const bodyGeo = new BufferGeometry();
      const bodyVertices = new Float32Array([ 0,0.5,0, -0.8,-0.5,0, 0.8,-0.5,0, 0,0,-5, 0,-1,0 ]);
      const bodyIndices = [ 0,2,3, 0,3,1, 1,3,4, 2,4,3, 1,2,4, 0,1,2 ];
      bodyGeo.setIndex(bodyIndices);
      bodyGeo.setAttribute('position', new Float32BufferAttribute(bodyVertices, 3));
      bodyGeo.computeVertexNormals();
      const body = new Mesh(bodyGeo, bodyMat);
      gull.add(body);

      const wingGeo = new BufferGeometry();
      const wingVertices = new Float32Array([ 0,0,0, 0,0,3, 8,0,-1, 7,0,-2 ]);
      const wingIndices = [ 0,1,2, 1,3,2, 0,2,1, 1,2,3 ];
      wingGeo.setIndex(wingIndices);
      wingGeo.setAttribute('position', new Float32BufferAttribute(wingVertices, 3));
      wingGeo.computeVertexNormals();
      
      const leftWing = new Mesh(wingGeo, wingMat);
      leftWing.position.set(-0.5, 0, -1);
      gull.add(leftWing);
      
      const rightWing = leftWing.clone();
      rightWing.scale.x = -1;
      rightWing.position.x = 0.5;
      gull.add(rightWing);
      
      gull.scale.set(1.5, 1.5, 1.5);
      return gull;
  }
}