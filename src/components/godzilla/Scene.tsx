import { useState } from "react";
import { Coldzilla } from "./Godzilla";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

const EnvironmentStage: React.FC = () => {
    return (
        <group position={[0, -4, 0]} >
            <mesh receiveShadow position={[0, 0, 0]} >
                <cylinderGeometry args={[260, 270, 8, 32]} />
                < meshPhongMaterial color="#d8dedb" flatShading />
            </mesh>
            {
                [
                    { pos: [-160, 4, 120] as [number, number, number], rot: [0, 0.6, 0] as [number, number, number], size: [28, 12, 34] as [number, number, number] },
                    { pos: [170, 6, 80] as [number, number, number], rot: [0, -0.4, 0] as [number, number, number], size: [34, 16, 26] as [number, number, number] },
                    { pos: [130, 4, -140] as [number, number, number], rot: [0, 0.8, 0] as [number, number, number], size: [24, 10, 28] as [number, number, number] },
                    { pos: [-150, 5, -120] as [number, number, number], rot: [0, -0.7, 0] as [number, number, number], size: [30, 14, 32] as [number, number, number] },
                ].map((rock, i) => (
                    <mesh key={i} position={rock.pos} rotation={rock.rot} castShadow receiveShadow >
                        <boxGeometry args={rock.size} />
                        <meshPhongMaterial color="#b2b8b6" flatShading />
                    </mesh>
                ))
            }
        </group>
    );
};

export default function Scene() {
    const [temp, setTemp] = useState<number>(100);
    const [status, setStatus] = useState<'cooling' | 'inhaling' | 'sneezing'>('cooling');

    // Map 0-100% temperature to -5.0°C (Frozen) -> 37.0°C (Normal)
    const celsius = (-5 + (temp / 100) * 42).toFixed(1);
    const barColor =
        temp > 60 ? '#ff8a47' : temp > 25 ? '#4fc3f7' : '#00e5ff';

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#e4ecef', position: 'relative', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
            {/* Temperature Meter HUD */}
            <div
                style={{
                    position: 'absolute',
                    top: 24,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    background: 'rgba(22, 30, 38, 0.85)',
                    backdropFilter: 'blur(8px)',
                    padding: '16px 24px',
                    borderRadius: 16,
                    color: '#ffffff',
                    minWidth: 300,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    border: `2px solid ${temp < 20 ? '#00e5ff' : 'rgba(255,255,255,0.12)'}`,
                    transition: 'border-color 0.3s ease',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, letterSpacing: 1.5, fontSize: 16 }}>
                        ❄️ COLDZILLA
                    </span>
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 99,
                            background:
                                status === 'sneezing'
                                    ? '#ff5252'
                                    : status === 'inhaling'
                                        ? '#ffb300'
                                        : temp < 25
                                            ? '#00b0ff'
                                            : '#37474f',
                        }}
                    >
                        {status === 'sneezing'
                            ? '🔥 ACHOO! WARMING UP'
                            : status === 'inhaling'
                                ? '😤 INHALING...'
                                : temp < 25
                                    ? '🥶 FREEZING!'
                                    : '😪 SNIFFLING'}
                    </span>
                </div>

                {/* Thermometer Bar */}
                <div style={{ width: '100%', height: 14, background: '#0f1519', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                    <div
                        style={{
                            width: `${Math.max(3, temp)}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, #00e5ff 0%, ${barColor} 100%)`,
                            borderRadius: 99,
                            transition: 'width 0.08s linear',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: '#b0bec5' }}>
                    <span>Body Temp: <strong style={{ color: '#fff' }}>{celsius}°C</strong></span>
                    <span>{Math.round(temp)}% Warmth</span>
                </div>
            </div>

            <Canvas shadows camera={{ position: [260, 240, 360], fov: 42, near: 1, far: 2000 }}>
                <color attach="background" args={['#e4ecef']} />
                <fog attach="fog" args={['#e4ecef', 400, 1100]} />

                <ambientLight color="#e3f2fd" intensity={0.75} />
                <directionalLight
                    castShadow
                    position={[250, 400, 220]}
                    intensity={1.2}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-camera-near={10}
                    shadow-camera-far={1000}
                    shadow-camera-left={-300}
                    shadow-camera-right={300}
                    shadow-camera-top={300}
                    shadow-camera-bottom={-300}
                    shadow-bias={-0.0002}
                />
                <directionalLight position={[-200, 180, -200]} intensity={0.45} color="#80d8ff" />

                <Coldzilla
                    position={[0, 0, 0]}
                    onTemperatureChange={(t, s) => {
                        setTemp(t);
                        setStatus(s);
                    }}
                />
                <EnvironmentStage />

                <OrbitControls
                    makeDefault
                    target={[0, 75, -20]}
                    maxPolarAngle={Math.PI / 2 - 0.05}
                    minDistance={180}
                    maxDistance={750}
                />
            </Canvas>
        </div>
    );
}