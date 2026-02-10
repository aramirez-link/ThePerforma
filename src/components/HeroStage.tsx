import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

type Props = {
  allowAudio: boolean;
};

function ParticleField({ intensity }: { intensity: number }) {
  const points = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const count = 2000;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      array[i] = (Math.random() - 0.5) * 12;
      array[i + 1] = (Math.random() - 0.5) * 6;
      array[i + 2] = (Math.random() - 0.5) * 10;
    }
    return array;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (points.current) {
      points.current.rotation.y = t * 0.08;
      points.current.rotation.x = t * 0.04;
      points.current.position.z = Math.sin(t * 0.2) * 0.4;
      (points.current.material as THREE.PointsMaterial).size = 0.02 + intensity * 0.04;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#f3d38b" size={0.02} transparent opacity={0.8} />
    </points>
  );
}

export default function HeroStage({ allowAudio }: Props) {
  const reducedMotion = useReducedMotion();
  const [intensity, setIntensity] = useState(0.25);

  useEffect(() => {
    if (!allowAudio || reducedMotion) return;

    let animationId: number;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array | null = null;
    let audioContext: AudioContext | null = null;

    const startAudio = async () => {
      try {
        audioContext = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);

        const tick = () => {
          if (analyser && dataArray) {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setIntensity(Math.min(1, avg / 140));
          }
          animationId = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setIntensity(0.35);
      }
    };

    startAudio();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext) audioContext.close();
    };
  }, [allowAudio, reducedMotion]);

  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
      <color attach="background" args={["#07070a"]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 2, 4]} intensity={1.2} color="#f2542d" />
      <pointLight position={[-3, -2, 5]} intensity={0.6} color="#f3d38b" />
      <ParticleField intensity={intensity} />
      {!reducedMotion && (
        <mesh rotation={[0.2, 0.1, 0]} position={[0, -1.6, -1]}>
          <planeGeometry args={[10, 4, 16, 16]} />
          <meshStandardMaterial color="#121218" metalness={0.7} roughness={0.2} />
        </mesh>
      )}
    </Canvas>
  );
}
