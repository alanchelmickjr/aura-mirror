"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"

interface EmotionData {
  name: string
  score: number
  color: string
}

interface AuraState {
  primaryEmotion: string
  intensity: number
  colors: string[]
  particles: Array<{ id: number; x: number; y: number; size: number; color: string }>
}

export default function AuraMirror() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [auraState, setAuraState] = useState<AuraState>({
    primaryEmotion: "neutral",
    intensity: 0.5,
    colors: ["#10b981", "#6366f1"],
    particles: [],
  })
  const [mirrorMessage, setMirrorMessage] = useState("Mirror, mirror on the wall...")
  const [emotions, setEmotions] = useState<EmotionData[]>([])

  // Emotion to color mapping
  const emotionColors = {
    joy: "#fbbf24", // Golden yellow
    excitement: "#f97316", // Orange
    love: "#ec4899", // Pink
    awe: "#8b5cf6", // Purple
    calmness: "#06b6d4", // Cyan
    contentment: "#10b981", // Emerald
    surprise: "#f59e0b", // Amber
    fear: "#6b7280", // Gray
    anger: "#ef4444", // Red
    sadness: "#3b82f6", // Blue
    disgust: "#84cc16", // Lime
    neutral: "#6366f1", // Indigo
  }

  // Initialize camera and start emotion detection
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setIsActive(true)
        startEmotionDetection()
      } catch (error) {
        console.error("Camera access denied:", error)
        // Simulate emotions for demo
        simulateEmotions()
      }
    }

    initializeCamera()
  }, [])

  // Simulate emotion detection for demo purposes
  const simulateEmotions = () => {
    const emotionNames = Object.keys(emotionColors)

    setInterval(() => {
      const randomEmotions = emotionNames
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((name) => ({
          name,
          score: Math.random() * 0.8 + 0.2,
          color: emotionColors[name as keyof typeof emotionColors],
        }))

      setEmotions(randomEmotions)
      updateAura(randomEmotions)
      updateMirrorMessage(randomEmotions[0])
    }, 2000)
  }

  const startEmotionDetection = () => {
    // In a real implementation, this would connect to Hume.ai WebSocket
    // For now, we'll simulate the emotion detection
    simulateEmotions()
  }

  const updateAura = (emotionData: EmotionData[]) => {
    const primary = emotionData[0]
    const intensity = primary.score
    const colors = emotionData.map((e) => e.color)

    // Generate magical particles
    const newParticles = Array.from({ length: Math.floor(intensity * 20) }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    setAuraState({
      primaryEmotion: primary.name,
      intensity,
      colors,
      particles: newParticles,
    })
  }

  const updateMirrorMessage = (emotion: EmotionData) => {
    const messages = {
      joy: "Your radiant joy illuminates the realm! ✨",
      excitement: "Such vibrant energy flows through you! 🌟",
      love: "Your heart glows with the warmest light! 💖",
      awe: "Wonder fills your aura with cosmic beauty! 🌌",
      calmness: "Serenity flows like gentle waters around you! 🌊",
      contentment: "Your peaceful spirit shines like emerald! 💚",
      surprise: "Sparks of curiosity dance in your aura! ⚡",
      fear: "Shadows gather, but courage still flickers within! 🕯️",
      anger: "Fiery passion burns bright in your essence! 🔥",
      sadness: "Blue depths hold wisdom and healing! 💙",
      disgust: "Your discerning nature protects your light! 🛡️",
      neutral: "Your balanced aura holds infinite potential! ⚖️",
    }

    setMirrorMessage(messages[emotion.name as keyof typeof messages] || "Your unique essence is beautiful! ✨")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background overflow-hidden relative">
      {/* Magical Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {auraState.particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full particle-float opacity-60"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              animationDelay: `${Math.random() * 6}s`,
            }}
          />
        ))}
      </div>

      {/* Main Mirror Interface */}
      <div className="flex flex-col items-center justify-center min-h-screen p-8 relative z-10">
        {/* Mirror Title */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4">
            Aura Mirror
          </h1>
          <p className="text-xl text-muted-foreground">Discover your true colors through the magic of emotion</p>
        </div>

        {/* Main Mirror Display */}
        <Card className="mirror-frame p-8 max-w-4xl w-full relative overflow-hidden">
          {/* Video Feed */}
          <div className="relative aspect-video rounded-2xl overflow-hidden mb-6">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{
                filter: `hue-rotate(${auraState.intensity * 180}deg) saturate(${1 + auraState.intensity})`,
                transform: "scaleX(-1)", // Mirror effect
              }}
            />

            {/* Aura Overlay */}
            <div
              className="absolute inset-0 rounded-2xl aura-glow"
              style={{
                background: `radial-gradient(ellipse at center, ${auraState.colors[0]}20 0%, ${auraState.colors[1] || auraState.colors[0]}10 50%, transparent 70%)`,
                animation: `pulse-aura ${2 + auraState.intensity * 2}s ease-in-out infinite`,
              }}
            />

            {/* Emotion Indicators */}
            <div className="absolute top-4 left-4 space-y-2">
              {emotions.slice(0, 3).map((emotion, index) => (
                <div
                  key={emotion.name}
                  className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1"
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: emotion.color }} />
                  <span className="text-white text-sm capitalize font-medium">{emotion.name}</span>
                  <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${emotion.score * 100}%`,
                        backgroundColor: emotion.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mirror Message */}
          <div className="text-center">
            <div className="magical-gradient p-6 rounded-2xl">
              <p className="text-2xl font-semibold text-white mb-2">{mirrorMessage}</p>
              <p className="text-white/80">
                Primary Aura: <span className="capitalize font-bold">{auraState.primaryEmotion}</span>
              </p>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-4 right-4">
            <div className="w-16 h-16 rounded-full magical-gradient opacity-60 particle-float" />
          </div>
          <div className="absolute bottom-4 left-4">
            <div className="w-12 h-12 rounded-full bg-accent/40 particle-float" style={{ animationDelay: "2s" }} />
          </div>
        </Card>

        {/* Status Indicator */}
        <div className="mt-6 flex items-center space-x-4">
          <div className={`w-3 h-3 rounded-full ${isActive ? "bg-primary" : "bg-muted"} animate-pulse`} />
          <span className="text-sm text-muted-foreground">
            {isActive ? "Mirror is active - detecting your aura..." : "Initializing magical mirror..."}
          </span>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center max-w-2xl">
          <p className="text-muted-foreground">
            Step into view and let the mirror reveal your emotional aura. The colors and effects will change based on
            your expressions and voice. No interaction needed - just be yourself! ✨
          </p>
        </div>
      </div>
    </div>
  )
}
