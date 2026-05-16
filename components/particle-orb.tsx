"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import type * as THREE from "three"

type OrbTier = "portrait-mobile" | "mobile-landscape-tablet" | "desktop"

type OrbConfig = {
  radius: number
  dotCount: number
  dotSize: number
  rotY: number
  rotX: number
  coreSegments: number
  shellSegments: number
  dpr: [number, number]
  glowClass: string
}

const ORB_CONFIG: Record<OrbTier, OrbConfig> = {
  "portrait-mobile": {
    radius: 1.08,
    dotCount: 320,
    dotSize: 0.029,
    rotY: 0.06,
    rotX: 0.06,
    coreSegments: 16,
    shellSegments: 6,
    dpr: [1, 1.2],
    glowClass: "absolute inset-[-20%] rounded-full bg-gradient-radial from-white/20 via-white/5 to-transparent blur-2xl",
  },
  "mobile-landscape-tablet": {
    radius: 1.15,
    dotCount: 520,
    dotSize: 0.032,
    rotY: 0.072,
    rotX: 0.085,
    coreSegments: 24,
    shellSegments: 8,
    dpr: [1, 1.45],
    glowClass: "absolute inset-[-24%] rounded-full bg-gradient-radial from-white/20 via-white/5 to-transparent blur-3xl",
  },
  desktop: {
    radius: 1.2,
    dotCount: 800,
    dotSize: 0.035,
    rotY: 0.08,
    rotX: 0.1,
    coreSegments: 32,
    shellSegments: 8,
    dpr: [1, 2],
    glowClass: "absolute inset-[-30%] rounded-full bg-gradient-radial from-white/20 via-white/5 to-transparent blur-3xl",
  },
}

function DottedSphere({
  radius,
  dotCount,
  dotSize,
  rotY,
  rotX,
  shellSegments,
}: {
  radius: number
  dotCount: number
  dotSize: number
  rotY: number
  rotX: number
  shellSegments: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  const dots = useMemo(() => {
    const positions: [number, number, number][] = []
    const phi = Math.PI * (3 - Math.sqrt(5)) // golden angle for even distribution

    for (let i = 0; i < dotCount; i++) {
      const y = 1 - (i / (dotCount - 1)) * 2
      const radiusAtY = Math.sqrt(1 - y * y)
      const theta = phi * i

      const x = Math.cos(theta) * radiusAtY * radius
      const z = Math.sin(theta) * radiusAtY * radius
      positions.push([x, y * radius, z])
    }
    return positions
  }, [radius, dotCount])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * rotY
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * rotX
    }
  })

  return (
    <group ref={groupRef}>
      {dots.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[dotSize, shellSegments, shellSegments]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.8}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}
    </group>
  )
}

function GlowingCore({ coreSegments }: { coreSegments: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.02
      meshRef.current.scale.set(scale, scale, scale)
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.15, coreSegments, coreSegments]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} metalness={0.5} roughness={0.1} />
    </mesh>
  )
}

function Scene({ config }: { config: OrbConfig }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={2} color="#ffffff" />
      <pointLight position={[-5, -5, -5]} intensity={1} color="#cccccc" />
      <pointLight position={[0, 0, 5]} intensity={1.5} color="#ffffff" />

      <GlowingCore coreSegments={config.coreSegments} />
      <DottedSphere
        radius={config.radius}
        dotCount={config.dotCount}
        dotSize={config.dotSize}
        rotY={config.rotY}
        rotX={config.rotX}
        shellSegments={config.shellSegments}
      />
    </>
  )
}

export function ParticleOrb() {
  const [tier, setTier] = useState<OrbTier>("desktop")

  useEffect(() => {
    const updateTier = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isPortraitPhone = width < 768 && height >= width
      const isMobileLandscapeOrTablet = (width < 768 && height < width) || (width >= 768 && width < 1024)

      if (isPortraitPhone) {
        setTier("portrait-mobile")
        return
      }

      if (isMobileLandscapeOrTablet) {
        setTier("mobile-landscape-tablet")
        return
      }

      setTier("desktop")
    }

    updateTier()
    window.addEventListener("resize", updateTier)
    return () => window.removeEventListener("resize", updateTier)
  }, [])

  const config = ORB_CONFIG[tier]

  return (
    <div className="relative mx-auto h-32 w-32 overflow-visible sm:h-40 sm:w-40 md:h-56 md:w-56 lg:h-72 lg:w-72">
      {/* Outer glow effect */}
      <div className={config.glowClass} />
      <Canvas
        dpr={config.dpr}
        camera={{ position: [0, 0, 4], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <Scene config={config} />
      </Canvas>
    </div>
  )
}
