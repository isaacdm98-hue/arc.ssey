import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, Float32BufferAttribute, FogExp2, Group, HemisphereLight, MathUtils, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Raycaster, RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, TextureLoader, TorusGeometry, Vector2, Vector3, WebGLRenderer, Clock as ThreeClock, Object3D, LineSegments, LineBasicMaterial, ShaderMaterial, BackSide, IcosahedronGeometry, ShadowMaterial, Quaternion, Euler, SpotLight, LoopOnce, TubeGeometry,
  CatmullRomCurve3, CanvasTexture, SpriteMaterial, Sprite, Line,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { createNoise3D } from 'simplex-noise';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
// FIX: Import GLTF type for the loader callback and instantiate loader separately to resolve type error.
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { RoundedBoxGeometry } from './geometries/RoundedBoxGeometry';
import type { IslandContent, WaybackResult, VideoResult, FestivalData, FishData, FishingMinigameState } from '../types';
import { ParticleTrail } from './ParticleTrail';
import { SeaLifeManager } from './SeaLifeManager';
import { NebulaSkybox } from './NebulaSkybox';
import type { AudioBus } from './AudioBus';

interface GhostFrame {
  time: number;
  position: number[];
  quaternion: number[];
}

interface BestRaceData {
  time: number;
  recording: GhostFrame[];
}

interface RadarTarget { position: Vector3; type: string; }

export interface ThreeSceneProps {
  onIslandCollision: (content: IslandContent, position: Vector3) => void;
  onProximityChange: (text: string | null) => void;
  onTarotReadingStart: () => void;
  onSystemMessage: (message: string) => void;
  onFestivalProximity: (seed: number | null) => void;
  onGullRequest: () => void;
  onClearGullMessage: () => void;
  onRadarUpdate: (targets: RadarTarget[]) => void;
  onPlayerStateUpdate: (position: Vector3, quaternion: Quaternion) => void;
  onGullUpdate: (position: { x: number, y: number } | null) => void;
  gullMessage: string | null;
  autoStart?: boolean;
  lowPower?: boolean;
  sites: WaybackResult[];
  videos: VideoResult[];
  festivals: FestivalData[];
  isFishing: boolean;
  onFishCaught: () => void;
  onFishingEnd: () => void;
  onFishingStateChange: (state: FishingMinigameState, tension: number) => void;
  audioBus: AudioBus | null;
}

export interface ThreeSceneHandle {
  init: () => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
  startFishing: () => void;
  triggerReelAction: () => void;
  repelFrom: (position: Vector3) => void;
}

// --- PRELOADING UTILITY ---
const preloadedUrls = new Set<string>();
function preloadContent(content: IslandContent) {
    let url: string | undefined;
    if (content.type === 'web') url = content.data.url;
    if (content.type === 'video') url = `https://archive.org/embed/${content.data.identifier}`;
    if (content.type === 'festival' && content.data.videos.length > 0) url = `https://archive.org/embed/${content.data.videos[0].identifier}`;

    if (url && !preloadedUrls.has(url)) {
        preloadedUrls.add(url);
        
        // 'prefetch' is a low-priority hint to the browser to fetch a resource
        // that might be needed for a future navigation. It's perfect for this use case.
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    }
}

function createTextSprite(text: string, fontSize = 64, fontFace = 'Orbitron') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    const font = `${fontSize}px ${fontFace}`;
    context.font = font;
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const padding = 20;

    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize * 1.5;
    
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#aaffff';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new SpriteMaterial({
        map: texture,
        blending: AdditiveBlending,
        depthTest: false,
        transparent: true,
        toneMapped: false,
    });
    
    const sprite = new Sprite(spriteMaterial);
    sprite.scale.set(canvas.width * 0.2, canvas.height * 0.2, 1.0);
    
    return sprite;
}

class IslandManager {
  private scene: Scene;
  private onCollision: (content: IslandContent, position: Vector3) => void;
  private onProximityChange: (text: string | null) => void;
  private onProximityLevelChange: (level: number, type: 'default' | 'festival') => void;
  private onSystemMessage: (message: string) => void;
  private onTarotReadingStart: () => void;
  private onFestivalProximity: (seed: number | null) => void;
  private noise3D = createNoise3D();
  
  public getAttractionTarget: () => Vector3 | null;
  private setAttractionTarget: (pos: Vector3 | null) => void;

  private readonly cellSize = 8000;
  private readonly visibleRadius = 1; // 3x3 grid
  private activeCells = new Map<string, Group>();
  private allContent: IslandContent[] = [];
  
  private lastCollisionTime = 0;
  private readonly collisionCooldown = 3;
  private hasWarnedAboutTarot = false;

  constructor(
      scene: Scene, 
      callbacks: {
          onCollision: (content: IslandContent, position: Vector3) => void,
          onProximityChange: (text: string | null) => void,
          onProximityLevelChange: (level: number, type: 'default' | 'festival') => void,
          onSystemMessage: (message: string) => void,
          onTarotReadingStart: () => void,
          onFestivalProximity: (seed: number | null) => void,
          getAttractionTarget: () => Vector3 | null,
          setAttractionTarget: (pos: Vector3 | null) => void,
      }
  ) {
    this.scene = scene;
    this.onCollision = callbacks.onCollision;
    this.onProximityChange = callbacks.onProximityChange;
    this.onProximityLevelChange = callbacks.onProximityLevelChange;
    this.onSystemMessage = callbacks.onSystemMessage;
    this.onTarotReadingStart = callbacks.onTarotReadingStart;
    this.onFestivalProximity = callbacks.onFestivalProximity;
    this.getAttractionTarget = callbacks.getAttractionTarget;
    this.setAttractionTarget = callbacks.setAttractionTarget;
  }
  
  private getKey(x: number, z: number) {
    return `${x},${z}`;
  }
  
  public setContent(newContent: IslandContent[]) {
      this.allContent = [...newContent].sort(() => 0.5 - Math.random());
  }
  
  public hasContent(): boolean {
    return this.allContent.length > 0;
  }

  public getActiveIslandsForRadar(): RadarTarget[] {
      const targets: RadarTarget[] = [];
      this.activeCells.forEach(cellGroup => {
        cellGroup.children.forEach(island => {
            if (island instanceof Group && island.userData.content) {
                targets.push({
                    position: island.position,
                    type: island.userData.content.type,
                });
            }
        });
      });
      return targets;
  }

  public toggleIslandVisibility(visible: boolean) {
      this.activeCells.forEach(cellGroup => {
          cellGroup.visible = visible;
      });
  }

  update(skiffPosition: Vector3, time: number) {
    const currentCX = Math.round(skiffPosition.x / this.cellSize);
    const currentCZ = Math.round(skiffPosition.z / this.cellSize);

    const requiredCells = new Set<string>();
    for(let x = currentCX - this.visibleRadius; x <= currentCX + this.visibleRadius; x++) {
        for(let z = currentCZ - this.visibleRadius; z <= currentCZ + this.visibleRadius; z++) {
            const key = this.getKey(x, z);
            requiredCells.add(key);
            if (!this.activeCells.has(key)) {
                this.spawnCell(x, z);
            }
        }
    }
    
    for (const [key, group] of this.activeCells.entries()) {
        if (!requiredCells.has(key)) {
            this.despawnCell(key, group);
        } else {
             // Update logic for islands in active cells (e.g., animations)
            group.children.forEach(island => {
                if (island.userData.rotator) {
                    island.userData.rotator.rotation.y += 0.003;
                }
                // Animate CRT screen shaders on video islands
                if (island.userData.screenShader) {
                    island.userData.screenShader.uniforms.uTime.value += 0.016;
                }
                // Gentle bob on water
                if (island instanceof Group && island.userData.content) {
                    island.position.y = -10 + Math.sin(time * 0.5 + island.position.x * 0.001) * 3;
                }
            });
        }
    }
    
    this.checkCollisions(skiffPosition, time);
  }
  
  private spawnCell(cx: number, cz: number) {
    const key = this.getKey(cx, cz);
    const cellGroup = new Group();
    this.scene.add(cellGroup);
    this.activeCells.set(key, cellGroup);
    
    const seed = (cx * 31 + cz * 17) % 1000;
    const random = this.createSeededRandom(seed);
    const islandCount = Math.floor(random() * 3) + 2; // Increased island count slightly
    
    for (let i = 0; i < islandCount; i++) {
      let content: IslandContent | null = null;
      if (this.allContent.length > 0) {
        content = this.allContent.pop()!;
      }
      
      // Allow multiple tarot islands to spawn with a small chance
      if (content?.type !== 'festival' && random() < 0.03) { // Reduced chance
        content = { type: 'tarot', data: { title: 'Mystical Tent' } };
      }

      if (!content) continue;

      const island = this.createIsland(content, random);
      const angle = random() * Math.PI * 2;
      // Spawn islands further out to make them appear sooner on the horizon
      const distance = random() * (this.cellSize * 0.45) + (this.cellSize * 0.2);
      island.position.set(
          cx * this.cellSize + Math.cos(angle) * distance,
          -10,
          cz * this.cellSize + Math.sin(angle) * distance,
      );
      cellGroup.add(island);
    }
    
     // Add deep sea crystals
    const crystalCount = Math.floor(random() * 4);
    for (let i=0; i < crystalCount; i++) {
        const crystalGeo = new IcosahedronGeometry(random() * 80 + 40, 1);
        const crystalMat = new MeshStandardMaterial({
            color: new Color().setHSL(0.5 + random() * 0.2, 0.8, 0.6),
            emissive: new Color().setHSL(0.5 + random() * 0.2, 0.7, 0.4),
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.8,
            roughness: 0.2,
            metalness: 0.1,
        });
        const crystal = new Mesh(crystalGeo, crystalMat);
        const angle = random() * Math.PI * 2;
        const distance = random() * (this.cellSize * 0.5);
        crystal.position.set(
            cx * this.cellSize + Math.cos(angle) * distance,
            -800 - random() * 800,
            cz * this.cellSize + Math.sin(angle) * distance,
        );
        crystal.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
        cellGroup.add(crystal);
    }

  }

  private createIsland(content: IslandContent, random: () => number): Group {
      const islandGroup = new Group();
      islandGroup.userData.content = content;
      let radius = 120; islandGroup.userData.radius = radius;

      // Each content type gets a unique, iconic object floating on the water
      if (content.type === 'video') {
          // === CRT TV floating on the water ===
          radius = 100; islandGroup.userData.radius = radius;
          const crtGroup = new Group();

          // TV body — chunky retro CRT
          const bodyGeo = new RoundedBoxGeometry(60, 50, 45, 2, 3);
          const bodyMat = new MeshPhysicalMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.3 });
          const body = new Mesh(bodyGeo, bodyMat);
          crtGroup.add(body);

          // Screen — glowing blue-green with scanlines
          const screenShader = new ShaderMaterial({
              uniforms: { uTime: { value: random() * 100 } },
              vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
              fragmentShader: `
                  uniform float uTime; varying vec2 vUv;
                  float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
                  void main() {
                      float scanline = sin(vUv.y * 150.0 + uTime * 2.0) * 0.08 + 0.92;
                      float noise = rand(vUv + fract(uTime * 0.1)) * 0.15;
                      float vignette = 1.0 - dot((vUv - 0.5) * 1.3, (vUv - 0.5) * 1.3);
                      vec3 col = vec3(0.1, 0.6, 0.8) * scanline * vignette + noise * 0.1;
                      gl_FragColor = vec4(col, 1.0);
                  }`,
              toneMapped: false,
          });
          islandGroup.userData.screenShader = screenShader;
          const screen = new Mesh(new PlaneGeometry(48, 36), screenShader);
          screen.position.z = 23;
          crtGroup.add(screen);

          // Screen bezel
          const bezelMat = new MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
          const bezelTop = new Mesh(new BoxGeometry(52, 3, 2), bezelMat); bezelTop.position.set(0, 19.5, 23); crtGroup.add(bezelTop);
          const bezelBot = new Mesh(new BoxGeometry(52, 3, 2), bezelMat); bezelBot.position.set(0, -19.5, 23); crtGroup.add(bezelBot);
          const bezelL = new Mesh(new BoxGeometry(2, 42, 2), bezelMat); bezelL.position.set(-26, 0, 23); crtGroup.add(bezelL);
          const bezelR = new Mesh(new BoxGeometry(2, 42, 2), bezelMat); bezelR.position.set(26, 0, 23); crtGroup.add(bezelR);

          // Antenna
          const antennaMat = new MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
          const ant1 = new Mesh(new CylinderGeometry(0.5, 0.3, 35, 6), antennaMat);
          ant1.position.set(-8, 40, 0); ant1.rotation.z = 0.3; crtGroup.add(ant1);
          const ant2 = new Mesh(new CylinderGeometry(0.5, 0.3, 35, 6), antennaMat);
          ant2.position.set(8, 40, 0); ant2.rotation.z = -0.3; crtGroup.add(ant2);

          // Glow around the TV
          const glowMat = new MeshBasicMaterial({ color: 0x44aacc, transparent: true, opacity: 0.08, blending: AdditiveBlending, depthWrite: false });
          const glow = new Mesh(new SphereGeometry(70, 16, 8), glowMat);
          crtGroup.add(glow);

          crtGroup.position.y = 10;
          crtGroup.rotation.y = random() * Math.PI * 2;
          islandGroup.add(crtGroup);
          islandGroup.userData.rotator = crtGroup;

      } else if (content.type === 'web') {
          // === iMac G3 style floating computer ===
          radius = 90; islandGroup.userData.radius = radius;
          const imacGroup = new Group();

          // The iconic translucent shell — bondi blue
          const shellColor = new Color().setHSL(0.5 + random() * 0.1, 0.7, 0.45);
          const shellMat = new MeshPhysicalMaterial({
              color: shellColor, metalness: 0.1, roughness: 0.3,
              transmission: 0.3, transparent: true, opacity: 0.85,
              ior: 1.5, thickness: 2.0, clearcoat: 0.8,
          });

          // Main body — rounded, bulbous back
          const shellGeo = new SphereGeometry(30, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6);
          const shell = new Mesh(shellGeo, shellMat);
          shell.position.y = -5;
          shell.rotation.x = Math.PI * 0.15;
          imacGroup.add(shell);

          // Flat front face
          const frontMat = new MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3, metalness: 0.1 });
          const front = new Mesh(new RoundedBoxGeometry(40, 35, 5, 2, 2), frontMat);
          front.position.set(0, 2, 18);
          imacGroup.add(front);

          // Screen
          const screenMat = new MeshStandardMaterial({ color: 0x111111, emissive: shellColor.clone().multiplyScalar(0.5), emissiveIntensity: 1.2, toneMapped: false });
          const imacScreen = new Mesh(new PlaneGeometry(30, 22), screenMat);
          imacScreen.position.set(0, 5, 20.6);
          imacGroup.add(imacScreen);

          // Handle notch on top
          const handleGeo = new TorusGeometry(5, 1.5, 8, 16, Math.PI);
          const handle = new Mesh(handleGeo, shellMat);
          handle.position.set(0, 22, 5);
          handle.rotation.x = Math.PI;
          imacGroup.add(handle);

          // Apple logo glow
          const logoGlow = new Mesh(new SphereGeometry(3, 8, 8), new MeshBasicMaterial({
              color: shellColor, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false,
          }));
          logoGlow.position.set(0, 10, -18);
          imacGroup.add(logoGlow);

          // Soft glow
          const imacGlow = new Mesh(new SphereGeometry(55, 16, 8), new MeshBasicMaterial({
              color: shellColor, transparent: true, opacity: 0.06, blending: AdditiveBlending, depthWrite: false,
          }));
          imacGroup.add(imacGlow);

          imacGroup.position.y = 15;
          imacGroup.scale.setScalar(1.2);
          imacGroup.rotation.y = random() * Math.PI * 2;
          islandGroup.add(imacGroup);
          islandGroup.userData.rotator = imacGroup;

      } else if (content.type === 'tarot') {
          // === Mystical fountain pen / quill ===
          radius = 80; islandGroup.userData.radius = radius;
          const penGroup = new Group();

          const penMat = new MeshPhysicalMaterial({ color: 0x1a0a30, metalness: 0.8, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 });
          const goldMat = new MeshStandardMaterial({ color: 0xdaa520, metalness: 1.0, roughness: 0.15, emissive: 0x553300, emissiveIntensity: 0.3 });

          // Pen body
          const barrel = new Mesh(new CylinderGeometry(3, 3, 60, 16), penMat);
          penGroup.add(barrel);

          // Gold nib
          const nibGeo = new ConeGeometry(3, 20, 8);
          const nib = new Mesh(nibGeo, goldMat);
          nib.position.y = -40;
          penGroup.add(nib);

          // Gold ring
          const ring = new Mesh(new TorusGeometry(3.5, 0.8, 8, 32), goldMat);
          ring.position.y = 25;
          penGroup.add(ring);

          // Mystical ink drip glow
          const inkGlow = new Mesh(new SphereGeometry(8, 16, 8), new MeshBasicMaterial({
              color: 0x8a2be2, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false,
          }));
          inkGlow.position.y = -50;
          penGroup.add(inkGlow);

          // Outer mystical aura
          const aura = new Mesh(new SphereGeometry(45, 16, 8), new MeshBasicMaterial({
              color: 0x8a2be2, transparent: true, opacity: 0.08, blending: AdditiveBlending, depthWrite: false,
          }));
          penGroup.add(aura);

          penGroup.position.y = 40;
          penGroup.rotation.z = Math.PI * 0.15; // Slight angle like writing
          penGroup.rotation.y = random() * Math.PI * 2;
          islandGroup.add(penGroup);
          islandGroup.userData.rotator = penGroup;

      } else if (content.type === 'festival') {
          // === Festival stage — large glowing structure ===
          radius = 300; islandGroup.userData.radius = radius;

          // Stage platform
          const stageMat = new MeshStandardMaterial({ color: 0x1a0a30, emissive: 0x8a2be2, emissiveIntensity: 0.3, roughness: 0.5 });
          const stage = new Mesh(new CylinderGeometry(150, 180, 20, 32), stageMat);
          stage.position.y = -5;
          islandGroup.add(stage);

          // Stage towers
          const towerMat = new MeshStandardMaterial({ color: 0x333333, emissive: 0x8a2be2, emissiveIntensity: 0.5 });
          for (let i = 0; i < 4; i++) {
              const angle = (i / 4) * Math.PI * 2;
              const tower = new Mesh(new CylinderGeometry(5, 5, 120, 8), towerMat);
              tower.position.set(Math.cos(angle) * 120, 50, Math.sin(angle) * 120);
              islandGroup.add(tower);

              // Light on top
              const lightGeo = new SphereGeometry(8, 8, 8);
              const lightMat = new MeshBasicMaterial({ color: 0xff44ff, transparent: true, opacity: 0.8, blending: AdditiveBlending });
              const light = new Mesh(lightGeo, lightMat);
              light.position.set(Math.cos(angle) * 120, 115, Math.sin(angle) * 120);
              islandGroup.add(light);
          }

          // Floating name
          const textSprite = createTextSprite(`${content.data.name} ${content.data.year}`);
          textSprite.position.y = 140;
          islandGroup.add(textSprite);

          // Purple aura
          const festGlow = new Mesh(new SphereGeometry(200, 32, 16), new MeshBasicMaterial({
              color: 0x8a2be2, transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false,
          }));
          festGlow.position.y = 30;
          islandGroup.add(festGlow);
      }

      return islandGroup;
  }
  
  private despawnCell(key: string, group: Group) {
    if (this.allContent) {
        group.children.forEach(island => {
            if (island.userData.content) {
                // Don't requeue the randomly generated tarot islands
                if(island.userData.content.type !== 'tarot') {
                    this.allContent.push(island.userData.content);
                }
            }
        });
    }

    this.scene.remove(group);
    group.traverse(child => {
        if (child instanceof Mesh || child instanceof Sprite) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else if (child.material) {
                if (child.material instanceof SpriteMaterial && child.material.map) {
                    child.material.map.dispose();
                }
                child.material.dispose();
            }
        }
    });
    this.activeCells.delete(key);
  }
  
  private checkCollisions(skiffPosition: Vector3, time: number) {
      if (time < this.lastCollisionTime + this.collisionCooldown) {
          this.onProximityChange(null);
          this.setAttractionTarget(null);
          return;
      };
      
      let closestIsland: Group | null = null;
      let minDistance = Infinity;
      let closestFestival: { island: Group, dist: number } | null = null;

      this.activeCells.forEach(cellGroup => {
        cellGroup.children.forEach(island => {
            if (!(island instanceof Group) || !island.visible || !island.userData.content) return;
            const dist = island.position.distanceTo(skiffPosition);
            if (dist < minDistance) {
                minDistance = dist;
                closestIsland = island;
            }

            const content = island.userData.content as IslandContent;
            if (content.type === 'festival') {
                if (!closestFestival || dist < closestFestival.dist) {
                    closestFestival = { island, dist };
                }
            }
        });
      });

      if (closestFestival && closestFestival.dist < (closestFestival.island.userData.radius + 1500)) {
        const content = closestFestival.island.userData.content as IslandContent;
        if(content.type === 'festival') {
              this.onFestivalProximity(content.data.year);
              const proximityLevel = 1.0 - ((closestFestival.dist - closestFestival.island.userData.radius) / 1500);
              this.onProximityLevelChange(proximityLevel, 'festival');
        }
      } else {
          this.onFestivalProximity(null);
          this.onProximityLevelChange(0, 'default');
      }
      
      const attractionTarget = this.getAttractionTarget();

      if (closestIsland) {
          const content = closestIsland.userData.content as IslandContent;
          const radius = closestIsland.userData.radius;
          
          if (minDistance < radius) {
              if (content.type === 'tarot') {
                  this.onTarotReadingStart();
                  closestIsland.visible = false; 
                  this.lastCollisionTime = time + 65; // Long cooldown to prevent re-triggering on the same spot
              } else {
                  this.onCollision(content, closestIsland.position);
                  this.lastCollisionTime = time;
              }
              this.setAttractionTarget(null);
          } else if (minDistance < radius + 800) {
              this.setAttractionTarget(closestIsland.position);
              preloadContent(content); // Preload content when we get close
              let signalType = 'Web Archive';
              if (content.type === 'video') signalType = 'Video Signal';
              else if (content.type === 'festival') signalType = `Festival Signal: ${content.data.name}`;
              else if (content.type === 'tarot') {
                signalType = 'Strange Energy';
                if (!this.hasWarnedAboutTarot) {
                    this.onSystemMessage("Anomalous energy signature detected.");
                    this.hasWarnedAboutTarot = true;
                }
              }
              this.onProximityChange(`Proximity Alert: ${signalType} Detected`);
              if (content.type !== 'festival') {
                const proximityLevel = 1.0 - ((minDistance - radius) / 800);
                this.onProximityLevelChange(proximityLevel, 'default');
              }
          } else {
              if (attractionTarget && attractionTarget.equals(closestIsland.position)) {
                   this.setAttractionTarget(null);
              }
              this.onProximityChange(null);
              this.hasWarnedAboutTarot = false;
          }
      } else {
          this.setAttractionTarget(null);
          this.onProximityChange(null);
          this.hasWarnedAboutTarot = false;
      }
  }

  dispose() {
      for (const [key, group] of this.activeCells.entries()) {
          this.despawnCell(key, group);
      }
  }

  private createSeededRandom(seed: number) {
      return function() {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
  }
}

class GameEngine {
  private container: HTMLDivElement;
  private props: ThreeSceneProps;
  private audioBus: AudioBus | null;

  private camera!: PerspectiveCamera;
  private scene!: Scene;
  private renderer!: WebGLRenderer;
  private composer!: EffectComposer;
  private fxaaPass!: ShaderPass;
  private clock = new ThreeClock();
  private gltfLoader = new GLTFLoader();
  
  private isInitialized = false;
  private isPaused = true;
  private animationFrameId = 0;

  private water!: Water;
  private skiff!: Group;
  private rippleMeshes: Mesh[] = [];
  
  private thrusterTrailLeft!: ParticleTrail;
  private thrusterTrailRight!: ParticleTrail;
  private wakeTrail!: ParticleTrail;
  
  private subsurfaceLayer!: Mesh;
  private subsurfaceState = { status: 'idle', timer: 60, visible: false };

  private skiffParts: { [key: string]: Object3D | Object3D[] | ShaderMaterial | DirectionalLight | SpotLight[] } = {};

  private islandManager!: IslandManager;
  private seaLifeManager!: SeaLifeManager;
  private nebulaSkybox!: NebulaSkybox;
  
  private gullMessageTimer = 0;
  
  // Post processing passes
  private vignettePass!: ShaderPass;

  // New Fishing Minigame state
  private fishingState: FishingMinigameState = 'idle';
  private fishingResult: 'success' | 'fail' | null = null;
  private fishingTimer = 0;
  private fishingTension = 0;
  private fishingProgress = 0;
  private isFishFighting = false;
  private fishingLine: { curve: CatmullRomCurve3, mesh: Line, bobber: Mesh } | null = null;
  private fishingRod: Group | null = null;
  
  private pressedKeys = new Set<string>();
  private controls = { isLeftTouchActive: false, isRightTouchActive: false, isPullingBack: false };
  private skiffPhysics = { 
    speed: 0, 
    maxSpeed: 500.0, 
    baseAcceleration: 450.0,
    brake: 900.0,
    drag: 0.97,
    roll: 0,
    pitch: 0,
    angularVelocity: 0,
    angularAcceleration: 4.2,
    angularDrag: 0.88,
    leftThrusterPower: 0,
    rightThrusterPower: 0,
    whooshCooldown: 0,
  };
  
  public attractionTarget: Vector3 | null = null;
  public repulsionSource: { position: Vector3, strength: number } | null = null;
  
  private activeTouches = new Map<number, { x: number, y: number, startY: number }>();
  private cameraIntermediateLookAt = new Vector3();
  private readonly cameraDamping = 0.04;
  
  constructor(container: HTMLDivElement, props: ThreeSceneProps) {
    this.container = container;
    this.props = props;
    this.audioBus = props.audioBus;
  }

  public init() {
    if (this.isInitialized) return;
    
    this.initGraphics();
    this.initWorld();
    this.initSkiff();
    this.initGameplay();
    this.initControls();

    this.isInitialized = true;
    if (this.props.autoStart) {
      this.resume();
    }
  }

  private initGraphics() {
    this.scene = new Scene();
    this.scene.fog = new FogExp2(0x1d1c25, 0.00015);

    this.camera = new PerspectiveCamera(55, this.container.clientWidth / this.container.clientHeight, 1, 40000);
    this.scene.add(this.camera);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: this.props.lowPower ? 'low-power' : 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.props.lowPower ? 1.25 : 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.88);
    this.composer.addPass(bloomPass);
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.material.uniforms['resolution'].value.x = 1 / (this.container.clientWidth * this.renderer.getPixelRatio());
    this.fxaaPass.material.uniforms['resolution'].value.y = 1 / (this.container.clientHeight * this.renderer.getPixelRatio());
    this.composer.addPass(this.fxaaPass);

    const cinematicShader = {
      uniforms: { 'tDiffuse': { value: null }, 'uVignetteAmount': { value: 0.6 }, 'uAberrationAmount': { value: 0.003 }, },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uVignetteAmount; uniform float uAberrationAmount; varying vec2 vUv;
        void main() {
          vec2 centeredUv = vUv - 0.5; float vignette = 1.0 - dot(centeredUv, centeredUv) * uVignetteAmount; vec4 color;
          color.r = texture2D(tDiffuse, vUv - centeredUv * uAberrationAmount).r; color.g = texture2D(tDiffuse, vUv).g; color.b = texture2D(tDiffuse, vUv + centeredUv * uAberrationAmount).b;
          gl_FragColor = vec4(color.rgb * vignette, 1.0);
        }`
    };
    this.composer.addPass(new ShaderPass(cinematicShader));

    this.vignettePass = new ShaderPass({
        uniforms: {
            'tDiffuse': { value: null },
            'uAmount': { value: 0.0 },
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float uAmount;
            varying vec2 vUv;
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                float dist = distance(vUv, vec2(0.5));
                color.rgb *= (1.0 - smoothstep(0.25, 0.6, dist) * uAmount);
                gl_FragColor = color;
            }`
    });
    this.vignettePass.enabled = false;
    this.composer.addPass(this.vignettePass);
  }

  private initWorld() {
    this.scene.fog = new FogExp2(0x0a0a1a, 0.00018);
    const ambient = new AmbientLight(0x9a8fad, 1.2);
    const hemisphere = new HemisphereLight(0xe6c7ff, 0x443322, 1.2);
    const directional = new DirectionalLight(0xffe4e1, 4.0);
    directional.position.set(-300, 350, -200);
    directional.castShadow = true;
    directional.shadow.mapSize.width = this.props.lowPower ? 1024 : 2048;
    directional.shadow.mapSize.height = this.props.lowPower ? 1024 : 2048;
    directional.shadow.camera.far = 1000; directional.shadow.camera.left = -500;
    directional.shadow.camera.right = 500; directional.shadow.camera.top = 500;
    directional.shadow.camera.bottom = -500; directional.shadow.bias = -0.001;
    this.scene.add(ambient, hemisphere, directional);
    this.scene.add(directional.target);
    this.skiffParts.directionalLight = directional;

    const waterGeometry = new PlaneGeometry(40000, 40000);
    this.water = new Water(waterGeometry, {
      textureWidth: 512, textureHeight: 512,
      waterNormals: new TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', t => { t.wrapS = t.wrapT = RepeatWrapping; }),
      sunDirection: directional.position.clone().normalize(), sunColor: 0xccbbaa, waterColor: 0x001028,
      distortionScale: this.props.lowPower ? 1.0 : 1.8, fog: this.scene.fog !== undefined,
    });
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = -0.5; this.scene.add(this.water);

    // Procedural nebula skybox — swirling cosmos
    this.nebulaSkybox = new NebulaSkybox(this.scene);
    this.scene.background = null; // Skybox handles its own rendering
    this.createMoons(); this.createSubsurfaceLife();
  }
  
  private createMoons() {
    const moonMaterial = new MeshBasicMaterial({ map: new TextureLoader().load('https://threejs.org/examples/textures/planets/moon_1024.jpg'), fog: false });
    const moon = new Mesh(new SphereGeometry(800, 64, 64), moonMaterial);
    moon.position.set(8000, 2500, -15000);

    const coronaMaterial = new ShaderMaterial({
        uniforms: { uColor: { value: new Color(0xfefcd7) }, uGlowPower: { value: 3.0 } },
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uGlowPower; varying vec3 vNormal; void main() { float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), uGlowPower); gl_FragColor = vec4(uColor, intensity); }`,
        blending: AdditiveBlending, transparent: true, depthWrite: false, side: BackSide
    });
    const corona = new Mesh(new SphereGeometry(850, 64, 64), coronaMaterial);
    moon.add(corona);
    this.scene.add(moon);

    const moon2 = new Mesh(new SphereGeometry(350, 32, 32), new MeshBasicMaterial({ map: new TextureLoader().load('https://threejs.org/examples/textures/planets/pluto_1024.jpg'), fog: false }));
    moon2.position.set(-12000, 1800, -9000);
    const corona2 = corona.clone();
    (corona2.material as ShaderMaterial).uniforms.uColor.value = new Color(0xd7e5fe);
    (corona2.material as ShaderMaterial).uniforms.uGlowPower.value = 4.0;
    corona2.scale.setScalar(1.1);
    moon2.add(corona2);
    this.scene.add(moon2);
  }

  private createSubsurfaceLife() {
      const geo = new PlaneGeometry(4000, 4000, 100, 100);
      const mat = new ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uVisibility: { value: 0.0 }, },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
              vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
              vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
              vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
              float snoise(vec2 v) { const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243); vec2 i = floor(v + dot(v,C.yy)); vec2 x0 = v - i + dot(i,C.xx); vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0); vec2 x1 = x0.xy + C.xx - i1; vec2 x2 = x0.xy + C.zz; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0); m = m*m; m = m*m; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.7928429 - 0.8537347 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x + h.x  * x0.y; g.yz = a0.yz * vec2(x1.x,x2.x) + h.yz * vec2(x1.y,x2.y); return 130.0 * dot(m,g); }
              uniform float uTime; uniform float uVisibility; varying vec2 vUv;
              void main() {
                  vec2 pos = vUv * 12.0; float n1 = snoise(pos + uTime * 0.2); float n2 = snoise(pos * 3.0 - uTime * 0.4);
                  float combined = (n1 + n2) * 0.5;
                  float rings = sin(length(vUv - 0.5) * 50.0 - uTime * 0.8) * 0.5 + 0.5;
                  float pattern = smoothstep(0.55, 0.7, combined * rings);
                  float distToCenter = length(vUv - 0.5);
                  float edgeFade = smoothstep(0.5, 0.45, distToCenter);
                  vec3 color = mix(vec3(0.1, 0.8, 1.0), vec3(0.8, 0.5, 1.0), rings);
                  gl_FragColor = vec4(color, pattern * edgeFade * uVisibility * 1.5);
              }`,
            transparent: true, blending: AdditiveBlending, depthWrite: false
      });
      this.subsurfaceLayer = new Mesh(geo, mat);
      this.subsurfaceLayer.rotation.x = -Math.PI / 2;
      this.subsurfaceLayer.position.y = -30;
      this.subsurfaceLayer.visible = false;
      this.scene.add(this.subsurfaceLayer);
  }

  private initSkiff() {
    this.skiff = new Group(); this.skiff.position.y = 5;

    // Morris Minor inspired — rounded, lovable, with a glass dome roof
    const bodyMat = new MeshPhysicalMaterial({ color: 0x2a5a3a, metalness: 0.7, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0.3, sheenColor: 0x90ee90 });
    const glassMat = new MeshPhysicalMaterial({ color: 0x88ccff, metalness: 0.1, roughness: 0, transmission: 0.9, transparent: true, opacity: 0.25, ior: 1.5, thickness: 1.5 });
    const headlightMat = new MeshStandardMaterial({ emissive: 0xffffdd, emissiveIntensity: 2, color: 0xffffdd, toneMapped: false });
    const brakeLightMat = new MeshStandardMaterial({ emissive: 0xff0000, emissiveIntensity: 0, color: 0xff0000, toneMapped: false });
    const chromeMat = new MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.1 });
    const interiorMat = new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const thrusterGlowMat = new MeshStandardMaterial({ emissive: 0x00ffff, emissiveIntensity: 0, color: 0x00ffff, toneMapped: false });

    // Rounded Morris Minor body — wider, lower, more car-like
    const mainBody = new Mesh(new RoundedBoxGeometry(12, 4, 24, 2, 1.5), bodyMat); this.skiff.add(mainBody);

    // Glass dome — full hemisphere so you can see the archivist inside
    const dome = new Mesh(new SphereGeometry(5.5, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), glassMat);
    dome.position.set(0, 2.5, 1); this.skiff.add(dome); this.skiffParts.dome = dome;

    // Dome rim — chrome ring where glass meets body
    const domeRim = new Mesh(new TorusGeometry(5.5, 0.3, 8, 32), chromeMat);
    domeRim.rotation.x = -Math.PI / 2; domeRim.position.set(0, 2.5, 1); this.skiff.add(domeRim);
    this.createCockpit(interiorMat);

    const beamMaterial = new MeshBasicMaterial({ color: 0xfff2c2, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false });
    const headlightGroup = new Group();
    const headlightPositions = [new Vector3(-3.5, 0, -11), new Vector3(3.5, 0, -11)];
    const beamGeo = new ConeGeometry(15, 700, 32, 1, true); beamGeo.translate(0, -350, 0); beamGeo.rotateX(Math.PI / 2);
    const spotLights: SpotLight[] = [];

    headlightPositions.forEach(pos => {
        const headlight = new Mesh(new SphereGeometry(0.7, 12, 6), headlightMat);
        headlight.position.copy(pos);
        headlightGroup.add(headlight);
        const beamMesh = new Mesh(beamGeo, beamMaterial); beamMesh.position.copy(pos); this.skiff.add(beamMesh);
        const spotLight = new SpotLight(0xfff2c2, 300000, 1200, Math.PI / 8, 0.5, 1.0);
        spotLight.position.copy(pos);
        spotLight.target.position.copy(pos).add(new Vector3(0, 0, -1));
        this.skiff.add(spotLight, spotLight.target); spotLights.push(spotLight);
    });
    this.skiff.add(headlightGroup); this.skiffParts.spotLights = spotLights;
    
    const brakeLightGroup = new Group();
    const b1 = new Mesh(new BoxGeometry(1.5, 0.6, 0.4), brakeLightMat); b1.position.set(-3.5, 0, 11.2); brakeLightGroup.add(b1);
    const b2 = b1.clone(); b2.position.x = 3.5; brakeLightGroup.add(b2);
    this.skiff.add(brakeLightGroup); this.skiffParts.brakeLights = brakeLightGroup.children as Mesh[];

    const bumperGeo = new RoundedBoxGeometry(10.5, 1, 1, 2, 0.3);
    const frontBumper = new Mesh(bumperGeo, chromeMat); frontBumper.position.set(0, -1.2, -10.8); this.skiff.add(frontBumper);
    const rearBumper = new Mesh(bumperGeo, chromeMat); rearBumper.position.set(0, -1.2, 10.8); this.skiff.add(rearBumper);
    
    const finGeo = new BoxGeometry(0.5, 4, 6); finGeo.translate(0, 0, -2);
    const fin1 = new Mesh(finGeo, bodyMat); fin1.position.set(-5, 1, 7); fin1.rotation.y = 0.2; this.skiff.add(fin1);
    const fin2 = fin1.clone(); fin2.position.x = 5; fin2.rotation.y = -0.2; this.skiff.add(fin2);

    const thrusterGroup = new Group();
    const thrusterGlow = new Mesh(new CylinderGeometry(0.9, 0.8, 0.5, 16), thrusterGlowMat); thrusterGlow.position.z = 1.5;
    const t1 = new Group(); t1.add(new Mesh(new CylinderGeometry(1.2, 1, 3, 16), chromeMat), thrusterGlow.clone()); t1.position.set(-2.5, 0, 11); thrusterGroup.add(t1);
    const t2 = t1.clone(); t2.position.x = 2.5; thrusterGroup.add(t2);
    this.skiff.add(thrusterGroup);
    this.skiffParts.leftThruster = t1; this.skiffParts.rightThruster = t2;
    
    this.skiff.traverse(o => { if (o instanceof Mesh) o.castShadow = true; });
    this.scene.add(this.skiff);
    
    this.thrusterTrailLeft = new ParticleTrail(this.scene, { color: 0x00ffff, particleLifetime: 0.5, particlesPerSecond: 0, size: 1.8, spread: 2.5, gravity: 0 });
    this.thrusterTrailRight = new ParticleTrail(this.scene, { color: 0x00ffff, particleLifetime: 0.5, particlesPerSecond: 0, size: 1.8, spread: 2.5, gravity: 0 });
    this.wakeTrail = new ParticleTrail(this.scene, { color: 0x88ddff, particleLifetime: 5.0, particlesPerSecond: 0, size: 2.0, gravity: -0.5, spread: 0.8 });
  }

  private createCockpit(interiorMat: MeshStandardMaterial) {
    const cockpit = new Group(); cockpit.position.set(0, -0.5, -2);
    const dashboard = new Mesh(new BoxGeometry(9, 2, 4), interiorMat);
    dashboard.position.set(0, 0, -2); dashboard.rotation.x = -0.2; cockpit.add(dashboard);
    const yokeColumn = new Mesh(new CylinderGeometry(0.2, 0.2, 2), interiorMat);
    yokeColumn.position.set(0, -0.5, -3); yokeColumn.rotation.x = 1.2; cockpit.add(yokeColumn);
    const yokeHandle = new Mesh(new BoxGeometry(2.5, 0.4, 0.4), interiorMat);
    yokeHandle.position.set(0, 1, -3.8); cockpit.add(yokeHandle); this.skiffParts.yoke = yokeHandle;
    const seat = new Mesh(new RoundedBoxGeometry(4, 5, 3, 2, 0.5), interiorMat.clone()); seat.position.set(0, -1.2, 2.5); cockpit.add(seat);

    const blinkingLights: Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const light = new Mesh(new CylinderGeometry(0.1, 0.1, 0.05, 8), new MeshStandardMaterial({ emissive: 0xff0000, color: 0x220000, toneMapped: false }));
        light.position.set(-2 + i * 1, 1, -3.95); light.rotation.x = -0.2; cockpit.add(light); blinkingLights.push(light);
    }
    this.skiffParts.blinkingLights = blinkingLights;

    const screenShader = new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform float uTime; varying vec2 vUv; float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453); }
            void main() {
                float scanline = sin(vUv.y * 200.0) * 0.1 + 0.9; float noise = random(vUv + uTime) * 0.2;
                float signal = smoothstep(0.4, 0.6, sin(vUv.y * 20.0 + uTime * 3.0));
                vec3 color = vec3(0.1, 1.0, 0.5) * (scanline + noise + signal);
                gl_FragColor = vec4(color, 1.0);
            }`, toneMapped: false,
    });
    this.skiffParts.screenShader = screenShader;

    const mainScreen = new Mesh(new PlaneGeometry(3, 2), screenShader); mainScreen.position.set(0, 0.5, -3.8); mainScreen.rotation.x = -0.2; cockpit.add(mainScreen);
    this.loadPilotModel(cockpit);
    this.skiff.add(cockpit);
  }

  private loadPilotModel(cockpitGroup: Group) {
    const pilotUrl = 'https://storage.googleapis.com/generative-ai-codelab-assets/arc.ssey/pilot.glb';
    this.gltfLoader.load(pilotUrl,
        (gltf) => {
            const pilot = gltf.scene;
            pilot.scale.setScalar(1.8);
            pilot.position.set(0, -2.5, 2.5);
            pilot.rotation.y = Math.PI;
            pilot.traverse(o => {
                if (o instanceof Mesh) o.castShadow = true;
            });
            cockpitGroup.add(pilot);
            this.skiffParts.pilot = pilot;
        },
        undefined, // onProgress
        (error) => {
            console.error('Error loading pilot model', error);
            // Fallback to a simple placeholder
            const placeholderGeo = new BoxGeometry(1.5, 2.5, 1.5);
            const placeholderMat = new MeshStandardMaterial({ color: 0x222222 });
            const placeholder = new Mesh(placeholderGeo, placeholderMat);
            placeholder.position.set(0, -1.25, 2.5);
            cockpitGroup.add(placeholder);
        }
    );
  }

  private initGameplay() {
    this.islandManager = new IslandManager(this.scene, {
        onCollision: (content, pos) => {
            this.props.onIslandCollision(content, pos);
            this.skiffPhysics.speed *= 0.2;
        },
        onProximityChange: (text) => this.props.onProximityChange(text),
        onProximityLevelChange: (level, type) => this.audioBus?.setProximityLevel(level, type),
        onSystemMessage: (message) => this.props.onSystemMessage(message),
        onTarotReadingStart: () => this.props.onTarotReadingStart(),
        onFestivalProximity: (seed) => this.props.onFestivalProximity(seed),
        getAttractionTarget: () => this.attractionTarget,
        setAttractionTarget: (pos: Vector3 | null) => { this.attractionTarget = pos; },
    });
    
    this.seaLifeManager = new SeaLifeManager(this.scene, this.skiff, this.props.onGullRequest);
    
    for (let i = 0; i < 4; i++) {
        const ripple = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({
            map: new TextureLoader().load('https://storage.googleapis.com/generative-ai-codelab-assets/arc.ssey/ripple.png'),
            blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false,
        }));
        ripple.rotation.x = -Math.PI / 2; ripple.visible = false; ripple.userData.life = 0;
        this.rippleMeshes.push(ripple); this.scene.add(ripple);
    }
  }

  private initControls() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.container.addEventListener('pointerdown', this.handlePointerDown);
    this.container.addEventListener('pointermove', this.handlePointerMove);
    this.container.addEventListener('pointerup', this.handlePointerUp);
    this.container.addEventListener('pointercancel', this.handlePointerUp);
  }
  
  private disposeControls() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.container.removeEventListener('pointerdown', this.handlePointerDown);
    this.container.removeEventListener('pointermove', this.handlePointerMove);
    this.container.removeEventListener('pointerup', this.handlePointerUp);
    this.container.removeEventListener('pointercancel', this.handlePointerUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => { this.pressedKeys.add(e.key.toLowerCase()); }
  private handleKeyUp = (e: KeyboardEvent) => { this.pressedKeys.delete(e.key.toLowerCase()); }
  
  private handlePointerDown = (e: PointerEvent) => {
    this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY, startY: e.clientY });
    this.updateTouchControls();
  }
  private handlePointerMove = (e: PointerEvent) => {
    if (this.activeTouches.has(e.pointerId)) {
        const touchData = this.activeTouches.get(e.pointerId)!;
        touchData.x = e.clientX;
        touchData.y = e.clientY;
        this.updateTouchControls();
    }
  }
  private handlePointerUp = (e: PointerEvent) => {
    this.activeTouches.delete(e.pointerId);
    // When a finger is lifted, reset startY for remaining fingers to avoid weird brake-locking
    for(const touch of this.activeTouches.values()) {
        touch.startY = touch.y;
    }
    this.updateTouchControls();
  }
  
  private updateTouchControls() {
      this.controls.isLeftTouchActive = false;
      this.controls.isRightTouchActive = false;
      this.controls.isPullingBack = false;

      let totalPullBack = 0;
      for (const touch of this.activeTouches.values()) {
          if (touch.x < window.innerWidth / 2) this.controls.isLeftTouchActive = true;
          else this.controls.isRightTouchActive = true;
          totalPullBack += touch.y - touch.startY;
      }
      
      if (this.activeTouches.size >= 2) {
          const avgPullBack = totalPullBack / this.activeTouches.size;
          if (avgPullBack > 30) { // 30px threshold
              this.controls.isPullingBack = true;
          }
      }
  }
  
  public resume() {
    if (!this.isInitialized || !this.isPaused) {
      if (!this.isInitialized) { console.warn("Scene not initialized."); return; }
    }
    this.isPaused = false; this.clock.start(); this.animate();
  }
  public pause() {
    this.isPaused = true; this.clock.stop(); cancelAnimationFrame(this.animationFrameId);
  }
  public dispose() {
    this.pause(); this.disposeControls(); this.islandManager?.dispose();
    this.nebulaSkybox?.dispose();
    this.renderer.dispose(); this.container.removeChild(this.renderer.domElement);
    this.isInitialized = false;
  }

  public startFishing = () => {
      if (this.fishingState === 'idle') {
          this.setFishingState('starting');
          this.islandManager.toggleIslandVisibility(false);
          this.seaLifeManager.toggleVisibility(false);
          this.scene.fog = new FogExp2(0x05080a, 0.0012); // Much denser fog
          (this.water.material as ShaderMaterial).uniforms['waterColor'].value.set(0x000510);
      }
  }
  public triggerReelAction = () => { this.handleReelAction(); };
  public repelFrom(position: Vector3) { this.repulsionSource = { position, strength: 1500 }; }

  private animate = () => {
    if (this.isPaused) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    this.props.onPlayerStateUpdate(this.skiff.position, this.skiff.quaternion);
    
    if (this.skiffParts.screenShader) (this.skiffParts.screenShader as ShaderMaterial).uniforms.uTime.value = time;
    if (this.skiffParts.blinkingLights) {
        (this.skiffParts.blinkingLights as Mesh[]).forEach((light, i) => {
            (light.material as MeshStandardMaterial).emissiveIntensity = (Math.sin(time * (3 + i * 2.5)) > 0.5) ? 2.5 : 0.2;
        });
    }
    
    if (this.fishingState === 'idle') {
        this.updateSkiff(delta, time);
    }
    this.updateCamera(delta);
    this.updateWorld(delta, time);
    this.nebulaSkybox?.update(time, this.skiff.position);
    
    if (this.fishingState === 'idle') {
        this.seaLifeManager.update(delta, time, this.skiffPhysics.speed);
        this.updateSubsurfaceLife(delta, time);
        
        // FIX: Explicitly type `allContent` as `IslandContent[]` so that the `tarot` type can be added.
        const allContent: IslandContent[] = [
            ...this.props.sites.map(s => ({ type: 'web' as const, data: s })),
            ...this.props.videos.map(v => ({ type: 'video' as const, data: v })),
            ...this.props.festivals.map(f => ({ type: 'festival' as const, data: f })),
        ];
        if (!this.islandManager.hasContent() && allContent.length > 0) {
            allContent.push({ type: 'tarot', data: { title: 'Mystical Tent' } });
            this.islandManager.setContent(allContent);
        }
        this.islandManager.update(this.skiff.position, time);
        this.props.onRadarUpdate(this.islandManager.getActiveIslandsForRadar());
    }
    
    this.thrusterTrailLeft.update(delta);
    this.thrusterTrailRight.update(delta);
    this.wakeTrail.update(delta);
    
    this.updateGullMessage(delta);
    this.updateFishingMinigame(delta, time);
    this.updatePostProcessing(delta);

    const light = this.skiffParts.directionalLight as DirectionalLight;
    if (light) {
        light.position.copy(this.skiff.position).add(new Vector3(-300, 350, -200));
        light.target.position.copy(this.skiff.position);
        light.target.updateMatrixWorld();
    }

    this.composer.render();
  }
  
  private updateGullMessage(delta: number) {
    const activeGull = this.seaLifeManager.getActiveGull();

    if (activeGull && this.props.gullMessage) {
        this.gullMessageTimer = 5.0; // Show for 5 seconds
        
        const screenPos = activeGull.position.clone().add(new Vector3(0, 15, 0)).project(this.camera);
        if (screenPos.z < 1) { // Is it in front of the camera?
            const bubbleHalfWidth = 160; // max-w-xs is 320px, so half is 160
            const bubbleHalfHeight = 60; // estimated height
            let x = (screenPos.x * 0.5 + 0.5) * this.container.clientWidth;
            let y = (-screenPos.y * 0.5 + 0.5) * this.container.clientHeight;

            x = MathUtils.clamp(x, bubbleHalfWidth, this.container.clientWidth - bubbleHalfWidth);
            y = MathUtils.clamp(y, bubbleHalfHeight, this.container.clientHeight - bubbleHalfHeight);

            this.props.onGullUpdate({x, y});
        } else {
            this.props.onGullUpdate(null);
        }
    }
    
    if (this.gullMessageTimer > 0) {
        this.gullMessageTimer -= delta;
        if (this.gullMessageTimer <= 0) {
            this.props.onGullUpdate(null);
            this.props.onClearGullMessage();
        }
    }
  }

  private updateSkiff(delta: number, time: number) {
    const p = this.skiffPhysics;
    p.leftThrusterPower = 0; p.rightThrusterPower = 0;
    
    this.skiff.position.y = 5 + Math.sin(time * 1.5) * 0.5;
    const mainBody = this.skiff.children[0];
    if(mainBody) {
        mainBody.rotation.x = Math.sin(time * 1.2) * 0.01;
        mainBody.rotation.z = Math.cos(time * 0.8) * 0.01;
    }
    
    const isTwoThumbs = this.controls.isLeftTouchActive && this.controls.isRightTouchActive;
    const isOneThumbLeft = this.controls.isLeftTouchActive && !this.controls.isRightTouchActive;
    const isOneThumbRight = this.controls.isRightTouchActive && !this.controls.isLeftTouchActive;
    
    const isTouchBraking = isTwoThumbs && this.controls.isPullingBack;
    const isTouchAccelerating = (isTwoThumbs || isOneThumbLeft || isOneThumbRight) && !isTouchBraking;

    const isAccelerating = (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup') || isTouchAccelerating) && !this.props.isFishing;
    const isBraking = (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown') || isTouchBraking) && !this.props.isFishing;
    const isTurningLeft = (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft') || isOneThumbLeft) && !this.props.isFishing;
    const isTurningRight = (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright') || isOneThumbRight) && !this.props.isFishing;
    
    let acceleration = 0;
    if (isAccelerating) { acceleration = p.baseAcceleration; p.leftThrusterPower = 1; p.rightThrusterPower = 1; }
    if (isBraking) acceleration -= p.brake;

    p.speed += acceleration * delta;
    p.speed *= p.drag;
    p.speed = Math.max(0, Math.min(p.speed, p.maxSpeed));
    
    this.audioBus?.setEngineLevel(p.speed / p.maxSpeed);

    const forwardVector = new Vector3(0, 0, -1).applyQuaternion(this.skiff.quaternion);
    const moveVector = forwardVector.multiplyScalar(p.speed * delta);
    this.skiff.position.add(moveVector);

    if (this.attractionTarget) {
        const direction = this.attractionTarget.clone().sub(this.skiff.position);
        const distance = direction.length();
        if (distance > 1) {
            const strength = MathUtils.smoothstep(400, 50, distance) * 200;
            this.skiff.position.add(direction.normalize().multiplyScalar(strength * delta));
        }
    }
    if (this.repulsionSource) {
        const direction = this.skiff.position.clone().sub(this.repulsionSource.position);
        direction.y = 0;
        direction.normalize();
        this.skiff.position.add(direction.multiplyScalar(this.repulsionSource.strength * delta));
        this.repulsionSource.strength *= 0.9;
        if (this.repulsionSource.strength < 1) this.repulsionSource = null;
    }

    const speedFactor = 0.4 + 0.6 * (p.speed / p.maxSpeed);
    const turnPower = p.angularAcceleration * speedFactor;
    if (isTurningLeft) { p.angularVelocity += turnPower * delta; p.rightThrusterPower = Math.max(p.rightThrusterPower, 0.5); }
    if (isTurningRight) { p.angularVelocity -= turnPower * delta; p.leftThrusterPower = Math.max(p.leftThrusterPower, 0.5); }
    
    p.whooshCooldown = Math.max(0, p.whooshCooldown - delta);
    if (Math.abs(p.angularVelocity) > 0.03 && p.whooshCooldown === 0 && p.speed > 100) {
        this.audioBus?.playSfx('https://archive.org/download/whoosh-sound-effect/Whoosh%20Sound%20Effect.mp3');
        p.whooshCooldown = 0.5;
    }

    p.angularVelocity *= p.angularDrag;
    this.skiff.rotation.y += p.angularVelocity * delta;
    p.roll = MathUtils.lerp(p.roll, p.angularVelocity * -1.5, 0.1);
    p.pitch = MathUtils.lerp(p.pitch, (p.speed / p.maxSpeed) * -0.1, 0.1);
    this.skiff.children[0].rotation.set(p.pitch, 0, p.roll);
    if(this.skiffParts.yoke) (this.skiffParts.yoke as Object3D).rotation.z = p.angularVelocity * -1.2;

    ( (this.skiffParts.leftThruster as Group).children[1] as Mesh<any, MeshStandardMaterial>).material.emissiveIntensity = p.leftThrusterPower * 2;
    ( (this.skiffParts.rightThruster as Group).children[1] as Mesh<any, MeshStandardMaterial>).material.emissiveIntensity = p.rightThrusterPower * 2;
    (this.skiffParts.brakeLights as Mesh<any, MeshStandardMaterial>[]).forEach(l => l.material.emissiveIntensity = isBraking ? 2 : 0);
    
    const speedRatio = p.speed / p.maxSpeed;
    if (this.skiffParts.spotLights) (this.skiffParts.spotLights as SpotLight[]).forEach(sl => sl.intensity = MathUtils.lerp(300000, 500000, speedRatio * speedRatio));

    const leftThrusterWorldPos = new Vector3(), rightThrusterWorldPos = new Vector3();
    (this.skiffParts.leftThruster as Group).getWorldPosition(leftThrusterWorldPos);
    (this.skiffParts.rightThruster as Group).getWorldPosition(rightThrusterWorldPos);
    
    const shouldEmit = (isAccelerating) && speedRatio > 0.1;
    this.thrusterTrailLeft.config.particlesPerSecond = shouldEmit ? 80 : 0; this.thrusterTrailLeft.emitters[0].position.copy(leftThrusterWorldPos);
    this.thrusterTrailRight.config.particlesPerSecond = shouldEmit ? 80 : 0; this.thrusterTrailRight.emitters[0].position.copy(rightThrusterWorldPos);
    
    this.wakeTrail.emitters[0].position.copy(new Vector3(0, -1, 11).applyQuaternion(this.skiff.quaternion).add(this.skiff.position));
    this.wakeTrail.config.particlesPerSecond = MathUtils.lerp(20, 150, speedRatio);
  }
  
  private updateCamera(delta: number) {
    const isFishing = this.fishingState !== 'idle';
    let targetPosition: Vector3, lookAtTarget: Vector3;

    if (isFishing) {
        // First-person fishing view from cockpit
        targetPosition = new Vector3(0, 3.5, -3).applyQuaternion(this.skiff.quaternion).add(this.skiff.position);
        const bobberPos = this.fishingLine ? this.fishingLine.bobber.position : new Vector3(0, 0, -20).applyQuaternion(this.skiff.quaternion).add(this.skiff.position);
        lookAtTarget = bobberPos;
    } else {
        // Standard third-person view
        targetPosition = new Vector3(0, 12, 35).applyQuaternion(this.skiff.quaternion).add(this.skiff.position);
        lookAtTarget = new Vector3(0, 5, -30).applyQuaternion(this.skiff.quaternion).add(this.skiff.position);
    }

    this.cameraIntermediateLookAt.lerp(lookAtTarget, this.cameraDamping * 2);
    this.camera.position.lerp(targetPosition, this.cameraDamping);
    this.camera.lookAt(this.cameraIntermediateLookAt);
  }

  private updateWorld(delta: number, time: number) {
    this.water.material.uniforms['time'].value += delta;
    this.water.position.x = this.skiff.position.x;
    this.water.position.z = this.skiff.position.z;

    // Dynamic water color — subtle shifts over time
    const waterHue = 0.55 + Math.sin(time * 0.01) * 0.03;
    const waterColor = new Color().setHSL(waterHue, 0.8, 0.03);
    (this.water.material as ShaderMaterial).uniforms['waterColor'].value.copy(waterColor);

    if (this.skiffPhysics.speed > 100 && Math.random() < 0.2) {
        const ripple = this.rippleMeshes.find(r => r.userData.life <= 0);
        if (ripple) {
            const side = Math.random() > 0.5 ? 1 : -1;
            ripple.position.copy(this.skiff.position).add(new Vector3(side*5,0,10).applyQuaternion(this.skiff.quaternion));
            ripple.visible = true; ripple.userData.life = 1.0;
            (ripple.material as MeshBasicMaterial).opacity = 0.6; ripple.scale.set(1,1,1);
        }
    }

    this.rippleMeshes.forEach(r => {
        if (r.userData.life > 0) {
            r.userData.life -= delta * 0.8; r.scale.multiplyScalar(1.02); (r.material as MeshBasicMaterial).opacity = r.userData.life * 0.6;
        } else { r.visible = false; }
    });

    // Dynamic fog density — thicker in some areas, thinner in others
    const fogDensity = 0.00015 + Math.sin(time * 0.005 + this.skiff.position.x * 0.0001) * 0.00005;
    if (this.fishingState === 'idle') {
        (this.scene.fog as FogExp2).density = fogDensity;
    }
  }

  private updateSubsurfaceLife(delta: number, time: number) {
      const s = this.subsurfaceState; s.timer -= delta;
      const mat = this.subsurfaceLayer.material as ShaderMaterial;
      if (s.status === 'idle' && s.timer <= 0) {
          s.status = 'fading_in'; s.timer = 5.0; this.subsurfaceLayer.visible = true;
          this.subsurfaceLayer.position.x = this.skiff.position.x; this.subsurfaceLayer.position.z = this.skiff.position.z;
      } else if (s.status === 'fading_in') {
          mat.uniforms.uVisibility.value = Math.min(1.0, mat.uniforms.uVisibility.value + delta * 0.2);
          if (s.timer <= 0) { mat.uniforms.uVisibility.value = 1.0; s.status = 'visible'; s.timer = 15.0; }
      } else if (s.status === 'visible' && s.timer <= 0) {
          s.status = 'fading_out'; s.timer = 5.0;
      } else if (s.status === 'fading_out') {
          mat.uniforms.uVisibility.value = Math.max(0.0, mat.uniforms.uVisibility.value - delta * 0.2);
          if (s.timer <= 0) { mat.uniforms.uVisibility.value = 0.0; s.status = 'idle'; s.timer = 60+Math.random()*60; this.subsurfaceLayer.visible = false; }
      }
      if (this.subsurfaceLayer.visible) mat.uniforms.uTime.value = time;
  }
  
  private setFishingState(state: FishingMinigameState) {
      if (this.fishingState === state) return;
      if (state === 'success' || state === 'fail') {
          this.fishingResult = state;
          this.fishingTimer = 0;
      }
      this.fishingState = state;
      this.props.onFishingStateChange(state, this.fishingTension);
  }

  private updatePostProcessing(delta: number) {
    if (this.vignettePass) {
        const isFishingActive = this.fishingState !== 'idle' && this.fishingState !== 'ending';
        if (isFishingActive) {
            this.vignettePass.enabled = true;
        }

        if (this.vignettePass.enabled) {
            const targetAmount = isFishingActive ? 0.9 : 0.0;
            const currentUniform = (this.vignettePass.material as ShaderMaterial).uniforms.uAmount;
            currentUniform.value = MathUtils.lerp(currentUniform.value, targetAmount, delta * 2.5); // Faster fade-in

            if (currentUniform.value < 0.01 && !isFishingActive) {
                this.vignettePass.enabled = false;
            }
        }
    }
  }
  
  private updateFishingMinigame(delta: number, time: number) {
      switch (this.fishingState) {
          case 'starting':
              this.castLine();
              this.setFishingState('waiting');
              this.fishingTimer = Math.random() * 5 + 4; // 4-9 seconds until bite
              break;
          case 'waiting':
              this.fishingTimer -= delta;
              if(this.fishingLine) { // Bobber animation
                  this.fishingLine.bobber.position.y = Math.sin(time * 3) * 0.2;
              }
              if (this.fishingTimer <= 0) {
                  this.setFishingState('bite');
                  this.fishingTimer = 1.5; // 1.5s to react
              }
              break;
          case 'bite':
              this.fishingTimer -= delta;
              if(this.fishingLine) { // Pull bobber under water
                  this.fishingLine.bobber.position.y = Math.sin(time * 50) * 0.8 - 1;
              }
              if (this.fishingTimer <= 0) this.setFishingState('fail');
              break;
          case 'reeling':
              const tensionDecay = this.isFishFighting ? 0.1 : 0.5;
              this.fishingTension = Math.max(0, this.fishingTension - delta * tensionDecay);
              if (Math.random() < 0.02) this.isFishFighting = !this.isFishFighting;

              if (this.fishingLine) {
                const { curve, mesh, bobber } = this.fishingLine;
                const lastPoint = curve.points[curve.points.length - 1];
                bobber.position.copy(lastPoint);
                if (this.isFishFighting) {
                    lastPoint.x += (Math.random() - 0.5) * 3;
                    lastPoint.z += (Math.random() - 0.5) * 3;
                }
                const midPoint = curve.points[1];
                midPoint.y = -20 * this.fishingTension;

                mesh.geometry.dispose();
                mesh.geometry = new BufferGeometry().setFromPoints(curve.getPoints(20));
              }

              if (this.fishingTension > 1) { this.setFishingState('fail'); break; }
              if (this.fishingProgress > 1) { this.setFishingState('success'); break; }

              this.props.onFishingStateChange(this.fishingState, this.fishingTension);
              break;
          case 'success':
          case 'fail':
              this.fishingTimer += delta;
              if(this.fishingTimer > 2) this.setFishingState('ending');
              break;
          case 'ending':
              if(this.fishingLine) {
                  this.scene.remove(this.fishingLine.mesh); 
                  this.scene.remove(this.fishingLine.bobber);
                  this.fishingLine = null;
              }
              if(this.fishingRod) this.fishingRod.visible = false;
              
              if (this.fishingResult === 'success') this.props.onFishCaught();
              this.props.onFishingEnd();

              this.islandManager.toggleIslandVisibility(true);
              this.seaLifeManager.toggleVisibility(true);

              this.scene.fog = new FogExp2(0x0a0a1a, 0.00018);
              (this.water.material as ShaderMaterial).uniforms['waterColor'].value.set(0x001028);

              this.setFishingState('idle');
              this.fishingResult = null; // Reset for next attempt
              break;
      }
  }

  private castLine() {
      if (!this.fishingRod) {
          this.fishingRod = new Group();
          const rodMat = new MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.2 });
          const handle = new Mesh(new CylinderGeometry(0.3, 0.3, 4, 8), rodMat);
          const shaft = new Mesh(new CylinderGeometry(0.1, 0.05, 12, 6), rodMat);
          shaft.position.y = 8;
          this.fishingRod.add(handle, shaft);
          this.fishingRod.rotation.set(0.5, -0.2, 0.2);
          this.skiff.add(this.fishingRod);
      }
      this.fishingRod.position.set(4, 2, -1);
      this.fishingRod.visible = true;

      const rodTipPos = new Vector3(0, 14, 0);
      this.fishingRod.localToWorld(rodTipPos);

      const castPoint = new Vector3(8, 0, -50).applyQuaternion(this.skiff.quaternion).add(this.skiff.position);
      const midPoint = rodTipPos.clone().lerp(castPoint, 0.5).add(new Vector3(0, 5, 0));
      
      const curve = new CatmullRomCurve3([rodTipPos, midPoint, castPoint]);
      const points = curve.getPoints(20);
      const geometry = new BufferGeometry().setFromPoints(points);
      const material = new LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7 });
      const lineMesh = new Line(geometry, material);
      this.scene.add(lineMesh);
      
      const bobber = new Mesh(new SphereGeometry(0.4, 8, 6), new MeshStandardMaterial({ color: 0xff4444, roughness: 0.3 }));
      bobber.position.copy(castPoint);
      this.scene.add(bobber);

      this.fishingLine = { curve, mesh: lineMesh, bobber };
  }
  
  private handleReelAction() {
      if (this.fishingState === 'bite') {
          this.setFishingState('reeling');
          this.fishingTension = 0;
          this.fishingProgress = 0;
      } else if (this.fishingState === 'reeling') {
          this.fishingTension += 0.15 + (this.isFishFighting ? 0.1 : 0);
          this.fishingProgress += 0.03 * (1 - this.fishingTension);
          if (this.fishingLine) {
              const { curve } = this.fishingLine;
              const newEnd = curve.points[2].lerp(curve.points[0], 0.05 * (1-this.fishingTension));
              curve.points[2].copy(newEnd);
          }
          this.props.onFishingStateChange(this.fishingState, this.fishingTension);
      }
  }

  public handleResize = () => {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.fxaaPass.material.uniforms['resolution'].value.x = 1 / (this.container.clientWidth * this.renderer.getPixelRatio());
    this.fxaaPass.material.uniforms['resolution'].value.y = 1 / (this.container.clientHeight * this.renderer.getPixelRatio());
  }
}

const ThreeScene = forwardRef<ThreeSceneHandle, ThreeSceneProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (mountRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(mountRef.current, props);
    }
  }, []); 

  useEffect(() => {
      if (engineRef.current) {
          (engineRef.current as any)['props'] = props;
          (engineRef.current as any)['audioBus'] = props.audioBus;
      }
  }, [props]);

  useImperativeHandle(ref, () => ({
    init: () => engineRef.current?.init(),
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    dispose: () => engineRef.current?.dispose(),
    startFishing: () => engineRef.current?.startFishing(),
    triggerReelAction: () => engineRef.current?.triggerReelAction(),
    repelFrom: (position: Vector3) => engineRef.current?.repelFrom(position),
  }));

  useEffect(() => {
    const engine = engineRef.current;
    if(engine) {
      engine.init();
      window.addEventListener('resize', engine.handleResize);
    }
    return () => {
      if (engine) {
        window.removeEventListener('resize', engine.handleResize);
        engine.dispose();
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
});

export default ThreeScene;