import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

// --- Constants (Adapted from sneeze.txt) ---
const MAX_SNEEZING_RATE = 8;
const GLOBAL_SPEED_RATE = 1;
const DEFAULT_SNEEZE_POWER = 5.5; // Controls sneeze intensity & fire burst

interface ColdzillaProps {
    position?: [number, number, number];
    scale?: [number, number, number];
    onTemperatureChange?: (temp: number, status: 'cooling' | 'inhaling' | 'sneezing') => void;
}

export const Coldzilla: React.FC<ColdzillaProps> = ({
    position = [0, 0, 0],
    scale = [1, 1, 1],
    onTemperatureChange,
}) => {
    // Hierarchy Refs
    const groupRef = useRef<THREE.Group>(null);
    const upperBodyRef = useRef<THREE.Group>(null);
    const lowerBodyRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Mesh>(null);
    const faceRef = useRef<THREE.Group>(null);
    const upperJawRef = useRef<THREE.Mesh>(null);
    const lowerJawRef = useRef<THREE.Mesh>(null);
    const mouthEmitterRef = useRef<THREE.Object3D>(null);
    const leftEyeRef = useRef<THREE.Mesh>(null);
    const rightEyeRef = useRef<THREE.Mesh>(null);
    const leftIrisRef = useRef<THREE.Mesh>(null);
    const rightIrisRef = useRef<THREE.Mesh>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftThighRef = useRef<THREE.Mesh>(null);
    const rightThighRef = useRef<THREE.Mesh>(null);
    const leftFootRef = useRef<THREE.Mesh>(null);
    const rightFootRef = useRef<THREE.Mesh>(null);
    const tailRef = useRef<THREE.Group>(null);

    // Sneeze & Temperature State Refs
    const temperature = useRef<number>(100); // 100 = Warm (37°C), 0 = Frozen (0°C)
    const isSneezing = useRef<boolean>(false);
    const sneezePhase = useRef<'cooling' | 'inhaling' | 'sneezing'>('cooling');
    const timeSmoke = useRef<number>(0);
    const timeFire = useRef<number>(0);
    const fireRate = useRef<number>(0);
    const uiSyncTimer = useRef<number>(0);

    // Base Warm vs. Frozen Color Palettes
    const palette = useMemo(
        () => ({
            warmSkin: new THREE.Color('#5a6670'),
            coldSkin: new THREE.Color('#80d8ff'),
            warmBelly: new THREE.Color('#73828c'),
            coldBelly: new THREE.Color('#ccf2ff'),
            warmSpines: new THREE.Color('#3b434a'),
            coldSpines: new THREE.Color('#4dd0e1'),
            warmDetail: new THREE.Color('#24282c'),
            coldDetail: new THREE.Color('#1a5276'),
        }),
        []
    );

    // Shared Materials (Mutated in useFrame for smooth freezing transitions)
    const materials = useMemo(
        () => ({
            skin: new THREE.MeshPhongMaterial({ color: '#5a6670', flatShading: true }),
            belly: new THREE.MeshPhongMaterial({ color: '#73828c', flatShading: true }),
            spines: new THREE.MeshPhongMaterial({ color: '#3b434a', flatShading: true }),
            darkDetail: new THREE.MeshPhongMaterial({ color: '#24282c', flatShading: true }),
            eyeWhite: new THREE.MeshPhongMaterial({ color: '#e6e1d6', flatShading: true }), // Slightly tired off-white
            iris: new THREE.MeshPhongMaterial({ color: '#111111', flatShading: true }),
            coldNose: new THREE.MeshPhongMaterial({ color: '#d9534f', flatShading: true }), // Sniffly red nose tip
            particle: new THREE.MeshLambertMaterial({
                transparent: true,
                opacity: 0.5,
                flatShading: true,
                depthWrite: false,
                blending: THREE.NormalBlending,
            }),
        }),
        []
    );

    // Geometries
    const { bodyGeo, pyramidGeo, tailSegmentGeo, particleGeo } = useMemo(() => {
        const bGeo = new THREE.CylinderGeometry(36, 85, 180, 4, 1);
        bGeo.rotateY(Math.PI / 4);
        const pos = bGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            if (pos.getY(i) > 0) pos.setZ(i, pos.getZ(i) + 16);
        }
        bGeo.computeVertexNormals();

        const pGeo = new THREE.CylinderGeometry(2, 20, 40, 4, 1);
        pGeo.rotateY(Math.PI / 4);
        pGeo.computeVertexNormals();

        const tGeo = new THREE.CylinderGeometry(12, 24, 50, 4, 1);
        tGeo.rotateY(Math.PI / 4);
        tGeo.rotateX(-Math.PI / 2);
        tGeo.computeVertexNormals();

        // Smaller base particle box (reduced from 4x4x4 to 2.5x2.5x2.5)
        const partGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);

        return { bodyGeo: bGeo, pyramidGeo: pGeo, tailSegmentGeo: tGeo, particleGeo: partGeo };
    }, []);

    // Particle Pools (Hidden by default)
    const smokePool = useRef(
        Array.from({ length: 35 }).map(() => {
            const mesh = new THREE.Mesh(particleGeo, materials.particle.clone());
            mesh.visible = false;
            return { mesh, active: false };
        })
    );

    const firePool = useRef(
        Array.from({ length: 140 }).map(() => {
            const mesh = new THREE.Mesh(particleGeo, materials.particle.clone());
            mesh.visible = false;
            return { mesh, active: false };
        })
    );

    // --- Sneeze Sequence (Adapted from sneeze.txt) ---
    const prepareToSneeze = (s: number) => {
        isSneezing.current = true;
        sneezePhase.current = 'inhaling';
        onTemperatureChange?.(temperature.current, 'inhaling');

        const speed = 0.75 * GLOBAL_SPEED_RATE;

        // Inhale: Lean upper body back and swell chest
        gsap.to(upperBodyRef.current!.rotation, { duration: speed, x: -s * 0.05, y: 0, z: 0, ease: 'back.out(1.7)' });
        gsap.to(upperBodyRef.current!.scale, { duration: speed, y: 1 + s * 0.015, z: 1 + s * 0.02, ease: 'back.out(1.7)' });

        // Open upper and lower jaws wide
        gsap.to(upperJawRef.current!.rotation, { duration: speed, x: -s * 0.05, ease: 'back.out(1.7)' });
        gsap.to(lowerJawRef.current!.rotation, { duration: speed, x: s * 0.14, ease: 'back.out(1.7)' });

        // Squint sleepy eyes even tighter during inhale
        gsap.to([leftEyeRef.current!.scale, rightEyeRef.current!.scale], { duration: speed, y: 0.25, ease: 'back.out(1.7)' });
        gsap.to([leftIrisRef.current!.scale, rightIrisRef.current!.scale], { duration: speed, y: 0.25, ease: 'back.out(1.7)' });

        // Pull arms and tail back
        gsap.to(leftArmRef.current!.rotation, { duration: speed, x: 0.4 - s * 0.12, z: 0.25 + s * 0.05, ease: 'back.out(1.7)' });
        gsap.to(rightArmRef.current!.rotation, { duration: speed, x: 0.4 - s * 0.12, z: -0.25 - s * 0.05, ease: 'back.out(1.7)' });

        // Feet lift slightly and toes curl up in anticipation during inhale
        if (leftFootRef.current && rightFootRef.current) {
            gsap.to(leftFootRef.current.position, {
                duration: speed,
                y: 26 + s * 0.8,
                z: 68 - s * 0.4,
                ease: 'back.out(1.4)',
            });
            gsap.to(rightFootRef.current.position, {
                duration: speed,
                y: 26 + s * 0.8,
                z: 68 - s * 0.4,
                ease: 'back.out(1.4)',
            });
            gsap.to(leftFootRef.current.rotation, {
                duration: speed,
                x: -0.55 - s * 0.05,
                ease: 'back.out(1.4)',
            });
            gsap.to(rightFootRef.current.rotation, {
                duration: speed,
                x: -0.55 - s * 0.05,
                ease: 'back.out(1.4)',
            });
        }
        if (leftThighRef.current && rightThighRef.current) {
            gsap.to([leftThighRef.current.rotation, rightThighRef.current.rotation], {
                duration: speed,
                x: 0.4 - s * 0.03,
                ease: 'back.out(1.4)',
            });
        }

        gsap.to(tailRef.current!.rotation, {
            duration: speed,
            x: s * 0.04,
            ease: 'back.out(1.7)',
            onComplete: () => sneeze(s),
        });
    };

    const sneeze = (s: number) => {
        sneezePhase.current = 'sneezing';
        onTemperatureChange?.(temperature.current, 'sneezing');

        const sneezeEffect = 1 - s / MAX_SNEEZING_RATE;
        const speed = 0.35 * GLOBAL_SPEED_RATE;

        // Trigger smaller fire burst count
        timeFire.current = Math.round(s * 18);
        fireRate.current = s;

        // Warm body temperature back up to 100% (37°C) as fire releases
        gsap.to(temperature, {
            current: 100,
            duration: speed * 2.5,
            ease: 'power2.out',
        });

        // Snap body forward
        gsap.to(upperBodyRef.current!.rotation, { duration: speed, x: s * 0.04, ease: 'back.out(1.7)' });
        gsap.to(upperBodyRef.current!.scale, { duration: speed, y: 1 - s * 0.02, z: 1, ease: 'back.out(1.7)' });

        // Snap mouth shut to blow fire out
        gsap.to(upperJawRef.current!.rotation, { duration: speed, x: 0, ease: 'power4.out' });
        gsap.to(lowerJawRef.current!.rotation, { duration: speed, x: 0, ease: 'power4.out' });

        // Squeeze eyes shut on sneeze impact
        gsap.to([leftEyeRef.current!.scale, rightEyeRef.current!.scale], { duration: speed, y: sneezeEffect * 0.2, ease: 'back.out(1.7)' });
        gsap.to([leftIrisRef.current!.scale, rightIrisRef.current!.scale], { duration: speed, y: sneezeEffect * 0.2, ease: 'power4.out' });

        // Thrust arms forward
        gsap.to(leftArmRef.current!.rotation, { duration: speed, x: 0.4 + s * 0.15, z: 0.25, ease: 'back.out(1.7)' });
        gsap.to(rightArmRef.current!.rotation, { duration: speed, x: 0.4 + s * 0.15, z: -0.25, ease: 'back.out(1.7)' });

        // Sneeze recoil kicks feet high up into the air
        const footLiftDuration = speed * 1.5;
        if (leftFootRef.current && rightFootRef.current) {
            gsap.to(leftFootRef.current.position, {
                duration: footLiftDuration,
                y: 26 + s * 5.2, // At s=5.5, lifts +28.6 to y=54.6!
                z: 68 + s * 3.0, // Kicks forward into the air
                ease: 'back.out(2.2)',
            });
            gsap.to(rightFootRef.current.position, {
                duration: footLiftDuration,
                y: 26 + s * 5.2,
                z: 68 + s * 3.0,
                ease: 'back.out(2.2)',
            });
            gsap.to(leftFootRef.current.rotation, {
                duration: footLiftDuration,
                x: -0.55 - s * 0.15, // Toes point up toward the sky
                z: 0.1 + s * 0.035,  // Slight outward flare
                ease: 'back.out(2.2)',
            });
            gsap.to(rightFootRef.current.rotation, {
                duration: footLiftDuration,
                x: -0.55 - s * 0.15,
                z: -0.1 - s * 0.035, // Slight outward flare
                ease: 'back.out(2.2)',
            });
        }

        // Seated thighs rotate and lift to follow the kick
        if (leftThighRef.current && rightThighRef.current) {
            gsap.to(leftThighRef.current.position, {
                duration: footLiftDuration,
                y: 34 + s * 1.6,
                ease: 'back.out(1.8)',
            });
            gsap.to(rightThighRef.current.position, {
                duration: footLiftDuration,
                y: 34 + s * 1.6,
                ease: 'back.out(1.8)',
            });
            gsap.to([leftThighRef.current.rotation, rightThighRef.current.rotation], {
                duration: footLiftDuration,
                x: 0.4 - s * 0.09,
                ease: 'back.out(1.8)',
            });
        }

        gsap.to(tailRef.current!.rotation, {
            duration: speed * 2.5,
            x: -s * 0.04,
            ease: 'back.out(1.7)',
            onComplete: () => backToNormal(s),
        });
    };

    const backToNormal = (s: number) => {
        const speed = 0.9 * GLOBAL_SPEED_RATE;

        gsap.to(upperJawRef.current!.rotation, { duration: speed, x: 0, ease: 'power4.inOut' });
        gsap.to(lowerJawRef.current!.rotation, { duration: speed, x: 0, ease: 'power4.inOut' });

        // Return eyes to sleepy half-closed state (0.42 scale)
        gsap.to([leftEyeRef.current!.scale, rightEyeRef.current!.scale], { duration: speed, y: 0.42, ease: 'power4.out' });
        gsap.to([leftIrisRef.current!.scale, rightIrisRef.current!.scale], { duration: speed, y: 0.42, ease: 'back.out(1.7)' });

        gsap.to(leftArmRef.current!.rotation, { duration: speed, x: 0.4, z: 0.25, ease: 'back.inOut(1.7)' });
        gsap.to(rightArmRef.current!.rotation, { duration: speed, x: 0.4, z: -0.25, ease: 'back.inOut(1.7)' });

        // Feet drop back down to rest on the ground
        if (leftFootRef.current && rightFootRef.current) {
            gsap.to(leftFootRef.current.position, {
                duration: speed,
                x: -26,
                y: 26,
                z: 68,
                ease: 'back.out(1.4)',
            });
            gsap.to(rightFootRef.current.position, {
                duration: speed,
                x: 26,
                y: 26,
                z: 68,
                ease: 'back.out(1.4)',
            });
            gsap.to(leftFootRef.current.rotation, {
                duration: speed,
                x: -0.55,
                y: -0.15,
                z: 0.1,
                ease: 'power4.out',
            });
            gsap.to(rightFootRef.current.rotation, {
                duration: speed,
                x: -0.55,
                y: 0.15,
                z: -0.1,
                ease: 'power4.out',
            });
        }

        // Thighs return to seated rest
        if (leftThighRef.current && rightThighRef.current) {
            gsap.to([leftThighRef.current.position, rightThighRef.current.position], {
                duration: speed,
                y: 34,
                ease: 'back.out(1.4)',
            });
            gsap.to([leftThighRef.current.rotation, rightThighRef.current.rotation], {
                duration: speed,
                x: 0.4,
                ease: 'power4.out',
            });
        }

        gsap.to(tailRef.current!.rotation, {
            duration: speed,
            x: 0,
            ease: 'back.out(1.7)',
            onComplete: () => {
                isSneezing.current = false;
                sneezePhase.current = 'cooling';
                timeSmoke.current = Math.round(s * 4);
            },
        });
    };

    // Cleanup tweens on unmount
    useEffect(() => {
        return () => {
            gsap.killTweensOf(temperature);
        };
    }, []);

    // --- Main Animation & Particle Loop ---
    useFrame(({ clock, pointer }, delta) => {
        const t = clock.getElapsedTime();

        // 1. Temperature Cooling Loop
        if (!isSneezing.current) {
            // Gradually freeze (drops from 100 to 0 in ~7.5 seconds)
            temperature.current = Math.max(0, temperature.current - delta * 13.5);

            // When frozen (0%), automatically sneeze to warm up!
            if (temperature.current <= 0) {
                prepareToSneeze(DEFAULT_SNEEZE_POWER);
            }
        }

        // Update HUD meter smoothly (~15fps throttled callback)
        uiSyncTimer.current += delta;
        if (uiSyncTimer.current > 0.06) {
            uiSyncTimer.current = 0;
            onTemperatureChange?.(temperature.current, sneezePhase.current);
        }

        // 2. Interpolate Body Colors based on Cold Factor (0 = Warm, 1 = Frozen)
        const coldFactor = 1 - temperature.current / 100;
        materials.skin.color.lerpColors(palette.warmSkin, palette.coldSkin, coldFactor);
        materials.belly.color.lerpColors(palette.warmBelly, palette.coldBelly, coldFactor);
        materials.spines.color.lerpColors(palette.warmSpines, palette.coldSpines, coldFactor);
        materials.darkDetail.color.lerpColors(palette.warmDetail, palette.coldDetail, coldFactor);

        // 3. Idle Movement, Shivering & Sleepy Blinking (when not sneezing)
        if (!isSneezing.current) {
            // Sleepy eyes: default scale.y is 0.42 (half-lidded), blinking squashes to 0.08
            const isBlinking = t % 3.5 > 3.32;
            const sleepyScale = isBlinking ? 0.08 : 0.42;

            if (leftEyeRef.current && rightEyeRef.current && leftIrisRef.current && rightIrisRef.current) {
                leftEyeRef.current.scale.y = sleepyScale;
                rightEyeRef.current.scale.y = sleepyScale;
                leftIrisRef.current.scale.y = sleepyScale;
                rightIrisRef.current.scale.y = sleepyScale;
            }

            // Shivering intensity increases as Coldzilla gets colder
            const shiverX = Math.sin(t * 48) * coldFactor * 2.2;
            const shiverRotZ = Math.cos(t * 42) * coldFactor * 0.025;

            if (upperBodyRef.current) {
                upperBodyRef.current.position.y = 60 + Math.sin(t * 2) * 1.5;
                upperBodyRef.current.position.x = shiverX;

                const targetBodyRotX = -pointer.y * 0.15;
                const targetBodyRotY = pointer.x * 0.2;
                const targetBodyRotZ = -pointer.x * 0.08 + shiverRotZ;

                upperBodyRef.current.rotation.x = THREE.MathUtils.lerp(upperBodyRef.current.rotation.x, targetBodyRotX, 0.05);
                upperBodyRef.current.rotation.y = THREE.MathUtils.lerp(upperBodyRef.current.rotation.y, targetBodyRotY, 0.05);
                upperBodyRef.current.rotation.z = THREE.MathUtils.lerp(upperBodyRef.current.rotation.z, targetBodyRotZ, 0.1);
            }

            if (lowerBodyRef.current) {
                lowerBodyRef.current.position.x = shiverX * 0.4;
                const targetLowerRotY = pointer.x * 0.06;
                const targetLowerRotX = -pointer.y * 0.03;

                lowerBodyRef.current.rotation.y = THREE.MathUtils.lerp(lowerBodyRef.current.rotation.y, targetLowerRotY, 0.05);
                lowerBodyRef.current.rotation.x = THREE.MathUtils.lerp(lowerBodyRef.current.rotation.x, targetLowerRotX, 0.05);
            }

            if (leftArmRef.current && rightArmRef.current) {
                leftArmRef.current.rotation.x = 0.4 + Math.sin(t * 3) * 0.08 + shiverRotZ * 2;
                rightArmRef.current.rotation.x = 0.4 - Math.sin(t * 3) * 0.08 - shiverRotZ * 2;
            }

            if (tailRef.current) {
                tailRef.current.rotation.y = Math.sin(t * 1.5) * 0.08;
            }
        }

        // 4. Particle Emission (Smaller Fire & Smoke from Mouth)
        const emitParticle = (pool: { mesh: THREE.Mesh; active: boolean }[], type: 'smoke' | 'fire') => {
            const p = pool.find((item) => !item.active);
            if (!p || !mouthEmitterRef.current) return;
            p.active = true;

            const pos = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 4,
                0
            );
            mouthEmitterRef.current.localToWorld(pos);

            const initX = pos.x;
            const initY = pos.y;
            const initZ = pos.z;

            const mat = p.mesh.material as THREE.MeshLambertMaterial;
            gsap.killTweensOf(p.mesh.position);
            gsap.killTweensOf(p.mesh.scale);
            gsap.killTweensOf(p.mesh.rotation);
            gsap.killTweensOf(mat);

            p.mesh.visible = true;
            mat.opacity = 0.65;
            p.mesh.scale.set(1, 1, 1);
            p.mesh.position.set(initX, initY, initZ);
            p.mesh.rotation.set(0, 0, 0);

            if (type === 'smoke') {
                const speed = 3.5 * GLOBAL_SPEED_RATE;
                mat.color.setHex(0x8899a6).convertSRGBToLinear();

                gsap.to(p.mesh.position, {
                    duration: speed,
                    ease: 'power3.out',
                    keyframes: [
                        { x: initX + (Math.random() - 0.5) * 18, y: initY + 14, z: initZ + 14 },
                        { x: initX + (Math.random() - 0.5) * 28, y: initY + 32, z: initZ + 24 },
                    ],
                });

                gsap.to(p.mesh.rotation, {
                    duration: speed,
                    ease: 'power3.out',
                    x: Math.random() * Math.PI * 2,
                    y: Math.random() * Math.PI * 2,
                });

                // Smaller smoke puffs
                const smokeScale = 1.8 + Math.random() * 2.0;
                gsap.to(p.mesh.scale, {
                    duration: speed,
                    ease: 'power3.out',
                    x: smokeScale,
                    y: smokeScale,
                    z: smokeScale,
                });

                gsap.to(mat, {
                    duration: speed,
                    ease: 'power3.out',
                    opacity: 0,
                    onComplete: () => {
                        p.active = false;
                        p.mesh.visible = false;
                    },
                });
            } else {
                // Smaller, compact Fire Burst
                const fRate = fireRate.current || DEFAULT_SNEEZE_POWER;
                const proxyColor = { r: 1, g: 205 / 255, b: 74 / 255 };
                mat.color.setRGB(proxyColor.r, proxyColor.g, proxyColor.b).convertSRGBToLinear();

                const baseFireDuration = (0.75 + fRate * 0.12) * GLOBAL_SPEED_RATE;
                const distanceZ = initZ + 32 + fRate * 8; // Reduced reach
                const spreadX = (Math.random() - 0.5) * (fRate * 4.2); // Tighter cone
                const spreadY = (Math.random() - 0.5) * (fRate * 3.5) - 4;

                gsap.to(p.mesh.position, {
                    duration: baseFireDuration,
                    x: initX + spreadX,
                    y: initY + spreadY,
                    z: distanceZ,
                    ease: 'power4.out',
                });

                gsap.to(p.mesh.rotation, {
                    duration: baseFireDuration,
                    x: Math.random() * 8,
                    y: Math.random() * 8,
                    ease: 'power4.out',
                });

                // Smaller fire particle scale (1.15x instead of 3.5x)
                const maxScale = fRate * 1.15;
                gsap.to(p.mesh.scale, {
                    duration: baseFireDuration,
                    x: maxScale,
                    y: maxScale,
                    z: maxScale,
                    ease: 'power1.out',
                    onComplete: () => {
                        p.active = false;
                        p.mesh.visible = false;
                    },
                });

                gsap.to(mat, {
                    duration: baseFireDuration,
                    opacity: 0,
                    ease: 'power4.out',
                });

                gsap.to(proxyColor, {
                    duration: baseFireDuration,
                    ease: 'power4.out',
                    keyframes: [
                        { r: 1.0, g: 0.85, b: 0.35 },
                        { r: 1.0, g: 0.55, b: 0.15 },
                        { r: 0.969, g: 0.133, b: 0.196 },
                        { r: 0.15, g: 0.15, b: 0.15 },
                    ],
                    onUpdate: () => mat.color.setRGB(proxyColor.r, proxyColor.g, proxyColor.b).convertSRGBToLinear(),
                });
            }
        };

        if (timeSmoke.current > 0) {
            emitParticle(smokePool.current, 'smoke');
            timeSmoke.current--;
        }
        if (timeFire.current > 0) {
            // Emit 2 small fire particles per frame for a crisp burst
            emitParticle(firePool.current, 'fire');
            emitParticle(firePool.current, 'fire');
            timeFire.current--;
        }
    });

    return (
        <group>
            {/* World-Space Particle Pools */}
            {
                smokePool.current.map((p, i) => (
                    <primitive key={`smoke-${i}`} object={p.mesh} />
                ))}
            {
                firePool.current.map((p, i) => (
                    <primitive key={`fire-${i}`} object={p.mesh} />
                ))}

            <group
                ref={groupRef}
                position={position}
                scale={scale}
                onClick={() => {
                    if (!isSneezing.current) prepareToSneeze(DEFAULT_SNEEZE_POWER);
                }}
            >
                {/* ==================== UPPER BODY PIVOT ==================== */}
                < group ref={upperBodyRef} position={[0, 60, 0]} >
                    <group position={[0, -60, 0]}>
                        {/* Main Body Torso */}
                        < mesh
                            ref={bodyRef}
                            position={[0, 90, 0]}
                            scale={[0.85, 1, 1]}
                            geometry={bodyGeo}
                            material={materials.skin}
                            castShadow
                            receiveShadow
                        />

                        {/* Segmented Front Belly Plates */}
                        < group position={[0, 0, 0]} >
                            {
                                [
                                    { y: 125, z: 45, w: 36, h: 28 },
                                    { y: 95, z: 49, w: 46, h: 28 },
                                    { y: 65, z: 53, w: 56, h: 28 },
                                    { y: 35, z: 57, w: 66, h: 28 },
                                ].map((plate, idx) => (
                                    <mesh
                                        key={idx}
                                        position={[0, plate.y, plate.z]}
                                        rotation={[-0.12, 0, 0]}
                                        material={materials.belly}
                                        castShadow
                                        receiveShadow
                                    >
                                        <boxGeometry args={[plate.w, plate.h, 6]} />
                                    </mesh>
                                ))
                            }
                        </group>

                        {/* Head, Split Mouth & Sleepy Eyes */}
                        <group ref={faceRef} position={[0, 140, 15]} >
                            {/* Fire/Smoke Emitter Point inside Mouth */}
                            < object3D ref={mouthEmitterRef} position={[0, 26, 40]} />

                            {/* Upper Snout (Length halved along Z from 30 to 15) */}
                            < group ref={upperJawRef} position={[0, 28, 26]} >
                                {/* Main upper snout block */}
                                < mesh position={[0, 0, 7.5]} rotation={[0.08, 0, 0]} material={materials.skin} castShadow receiveShadow >
                                    <boxGeometry args={[22, 16, 15]} />
                                </mesh>
                                {/* Sloped nose bridge tip */}
                                <mesh position={[0, -2, 15]} rotation={[-0.2, 0, 0]} material={materials.skin} castShadow receiveShadow >
                                    <boxGeometry args={[18, 12, 3]} />
                                </mesh>
                                {/* Nostril Holes (Dark recessed square slits on the snout tip) */}
                                <mesh position={[-4, -0.5, 16.6]} rotation={[-0.2, -0, 0]} material={materials.darkDetail} >
                                    <boxGeometry args={[2.5, 3.5, 0.8]} />
                                </mesh>
                                < mesh position={[4, -0.5, 16.6]} rotation={[-0.2, 0, 0]} material={materials.darkDetail} >
                                    <boxGeometry args={[2.5, 3.5, 0.8]} />
                                </mesh>
                                {/* Dark upper mouth roof/lip line */}
                                <mesh position={[0, -7.5, 7.5]} material={materials.darkDetail} >
                                    <boxGeometry args={[20, 1.5, 13]} />
                                </mesh>
                            </group>

                            {/* Lower Jaw (Length halved along Z from 28 to 14) */}
                            <group ref={lowerJawRef} position={[0, 19, 26]} >
                                {/* Main mandible chin */}
                                < mesh position={[0, -3, 7]} rotation={[-0.05, 0, 0]} material={materials.skin} castShadow receiveShadow >
                                    <boxGeometry args={[19, 9, 14]} />
                                </mesh>
                                {/* Dark inner mouth / tongue base */}
                                <mesh position={[0, 1.2, 7]} material={materials.darkDetail} >
                                    <boxGeometry args={[17, 1.5, 12]} />
                                </mesh>
                            </group>

                            {/* Upper Spine behind Head */}
                            <mesh
                                position={[0, 24, -30]}
                                rotation={[-1.3, 0, 0]}
                                scale={[0.2, 0.45, 0.4]}
                                geometry={pyramidGeo}
                                material={materials.spines}
                                castShadow
                            />

                            {/* Sleepy Eyes (tilted slightly downward for tired look) */}
                            < mesh
                                ref={leftEyeRef}
                                position={[-20, 28, 11]}
                                rotation={[0.12, -0.25, -0.2]}
                                scale={[1, 0.42, 1]}
                                material={materials.eyeWhite}
                            >
                                <boxGeometry args={[6, 10, 14]} />
                            </mesh>
                            < mesh
                                ref={rightEyeRef}
                                position={[20, 28, 11]}
                                rotation={[0.12, 0.25, 0.2]}
                                scale={[1, 0.42, 1]}
                                material={materials.eyeWhite}
                            >
                                <boxGeometry args={[6, 10, 14]} />
                            </mesh>

                            {/* Sleepy Irises */}
                            <mesh
                                ref={leftIrisRef}
                                position={[-22, 27.5, 13]}
                                rotation={[0.12, -0.25, -0.2]}
                                scale={[1, 0.42, 1]}
                                material={materials.iris}
                            >
                                <boxGeometry args={[4, 6, 6]} />
                            </mesh>
                            < mesh
                                ref={rightIrisRef}
                                position={[22, 27.5, 13]}
                                rotation={[0.12, 0.25, 0.2]}
                                scale={[1, 0.42, 1]}
                                material={materials.iris}
                            >
                                <boxGeometry args={[4, 6, 6]} />
                            </mesh>

                            {/* Neck Gills */}
                            {
                                [-1, 1].map((side) => (
                                    <group key={side} position={[side * 25, 2, 1]} rotation={[0, side * 0.2, 0]} >
                                        <mesh position={[0, 6, 0]} rotation={[0, 0, 0.2]} material={materials.darkDetail} >
                                            <boxGeometry args={[4, 4, 14]} />
                                        </mesh>
                                        < mesh position={[0, -4, -2]} rotation={[0, 0, 0.2]} material={materials.darkDetail} >
                                            <boxGeometry args={[4, 4, 14]} />
                                        </mesh>
                                    </group>
                                ))
                            }
                        </group>

                        {/* Arms */}
                        <group ref={leftArmRef} position={[-38, 105, 16]} rotation={[0.4, 0, 0.25]} >
                            <mesh position={[0, -14, 0]} material={materials.skin} castShadow receiveShadow >
                                <boxGeometry args={[14, 32, 16]} />
                            </mesh>
                            {
                                [-4, 0, 4].map((zOffset, i) => (
                                    <mesh
                                        key={i}
                                        position={[0, -34, zOffset]}
                                        rotation={[Math.PI, 0, 0]}
                                        scale={[0.2, 0.3, 0.2]}
                                        geometry={pyramidGeo}
                                        material={materials.darkDetail}
                                    />
                                ))
                            }
                        </group>

                        < group ref={rightArmRef} position={[38, 105, 16]} rotation={[0.4, 0, -0.25]} >
                            <mesh position={[0, -14, 0]} material={materials.skin} castShadow receiveShadow >
                                <boxGeometry args={[14, 32, 16]} />
                            </mesh>
                            {
                                [-4, 0, 4].map((zOffset, i) => (
                                    <mesh
                                        key={i}
                                        position={[0, -34, zOffset]}
                                        rotation={[Math.PI, 0, 0]}
                                        scale={[0.2, 0.3, 0.2]}
                                        geometry={pyramidGeo}
                                        material={materials.darkDetail}
                                    />
                                ))
                            }
                        </group>

                        {/* Back Dorsal Fins */}
                        {
                            [
                                { y: 126, z: -24, s: 1.05 },
                                { y: 90, z: -34, s: 1.0 },
                                { y: 54, z: -44, s: 0.85 },
                            ].map((fin, idx) => (
                                <group key={idx} position={[0, fin.y, fin.z]} rotation={[-1.3, 0, 0]} scale={[fin.s, fin.s, fin.s]} >
                                    <mesh position={[0, 22, 0]} scale={[0.25, 1.15, 0.65]} geometry={pyramidGeo} material={materials.spines} castShadow receiveShadow />
                                    <mesh position={[0, 16, 10]} rotation={[0.45, 0, 0]} scale={[0.22, 0.8, 0.5]} geometry={pyramidGeo} material={materials.spines} castShadow receiveShadow />
                                    <mesh position={[0, 14, -10]} rotation={[-0.45, 0, 0]} scale={[0.22, 0.75, 0.5]} geometry={pyramidGeo} material={materials.spines} castShadow receiveShadow />
                                </group>
                            ))
                        }
                    </group>
                </group>

                {/* ==================== LOWER BODY ==================== */}
                <group ref={lowerBodyRef}>
                    {/* Seated Thighs */}
                    <mesh ref={leftThighRef} position={[-42, 34, 12]} rotation={[0.4, 0, 0.3]} material={materials.skin} castShadow receiveShadow >
                        <boxGeometry args={[24, 52, 48]} />
                    </mesh>
                    <mesh ref={rightThighRef} position={[42, 34, 12]} rotation={[0.4, 0, -0.3]} material={materials.skin} castShadow receiveShadow >
                        <boxGeometry args={[24, 52, 48]} />
                    </mesh>

                    {/* Pointed Feet */}
                    <mesh ref={leftFootRef} position={[-26, 26, 68]} rotation={[-0.55, -0.15, 0.1]} scale={[0.8, 1.35, 0.7]} geometry={pyramidGeo} material={materials.skin} castShadow receiveShadow />
                    <mesh ref={rightFootRef} position={[26, 26, 68]} rotation={[-0.55, 0.15, -0.1]} scale={[0.8, 1.35, 0.7]} geometry={pyramidGeo} material={materials.skin} castShadow receiveShadow />
                </group>

                {/* Tail Segments and Spines */}
                <group ref={tailRef}>
                    <mesh position={[0, 26, -72]} rotation={[-0.12, 0, 0]} scale={[1.45, 1.15, 1.1]} geometry={tailSegmentGeo} material={materials.skin} castShadow receiveShadow />
                    <mesh position={[0, 19, -118]} rotation={[-0.08, 0, 0]} scale={[1.05, 0.85, 1.05]} geometry={tailSegmentGeo} material={materials.skin} castShadow receiveShadow />
                    <mesh position={[0, 13, -162]} rotation={[-0.05, 0, 0]} scale={[0.7, 0.6, 1.0]} geometry={tailSegmentGeo} material={materials.skin} castShadow receiveShadow />
                    <mesh position={[0, 8, -210]} rotation={[-Math.PI / 2 - 0.04, 0, 0]} scale={[0.5, 1.4, 0.45]} geometry={pyramidGeo} material={materials.skin} castShadow receiveShadow />

                    {
                        [
                            { y: 44, z: -68, s: 0.45 },
                            { y: 36, z: -92, s: 0.38 },
                            { y: 29, z: -116, s: 0.32 },
                            { y: 23, z: -140, s: 0.26 },
                            { y: 18, z: -164, s: 0.21 },
                            { y: 14, z: -186, s: 0.16 },
                        ].map((tSpine, idx) => (
                            <mesh
                                key={idx}
                                position={[0, tSpine.y, tSpine.z]}
                                rotation={[-0.25, 0, 0]}
                                scale={[tSpine.s * 0.6, tSpine.s, tSpine.s]}
                                geometry={pyramidGeo}
                                material={materials.spines}
                                castShadow
                                receiveShadow
                            />
                        ))
                    }
                </group>
            </group>
        </group>
    );
};