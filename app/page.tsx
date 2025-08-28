"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { VoiceInterface } from "@/components/voice-interface"
import { VideoProcessor } from "@/components/video-processor"
import { AuraVisualization } from "@/components/aura-visualization"
import { useHumeVoice } from "@/hooks/use-hume-voice"
import { useWakeWord } from "@/hooks/use-wake-word"
import { useFacialEmotions } from "@/hooks/use-facial-emotions"
import { EmotionProcessor } from "@/lib/hume/emotion-processor"
import { HumeWebSocketManager } from "@/lib/hume/websocket-manager"
import type { EmotionData, ProsodyData, VocalBurst } from "@/lib/hume/types"

interface ProcessedEmotion {
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
  const [isActive, setIsActive] = useState(false)
  const [wsManager, setWsManager] = useState<HumeWebSocketManager | null>(null)
  const [emotionProcessor, setEmotionProcessor] = useState<EmotionProcessor | null>(null)
  const [auraState, setAuraState] = useState<AuraState>({
    primaryEmotion: "neutral",
    intensity: 0.5,
    colors: ["#10b981", "#6366f1"],
    particles: [],
  })
  const [mirrorMessage, setMirrorMessage] = useState("Mirror, mirror on the wall...")
  const [processedEmotions, setProcessedEmotions] = useState<ProcessedEmotion[]>([])
  const [prosodyData, setProsodyData] = useState<ProsodyData | null>(null)
  const [vocalBurst, setVocalBurst] = useState<VocalBurst | null>(null)
  const [conversationActive, setConversationActive] = useState(false)

  // Hooks for Hume integration
  const {
    isConnected,
    isRecording,
    connect,
    disconnect,
    messages,
    sendMessage
  } = useHumeVoice()
  
  const { isListening, detected } = useWakeWord({ wakePhrase: "mirror mirror on the wall" })
  const { emotions: facialEmotions, isProcessing } = useFacialEmotions()

  // Emotion to color mapping
  const emotionColors: Record<string, string> = {
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
    admiration: "#a855f7", // Purple
    amusement: "#facc15", // Yellow
    anxiety: "#94a3b8", // Slate
    boredom: "#6b7280", // Gray
    concentration: "#0ea5e9", // Sky
    confusion: "#f97316", // Orange
    contemplation: "#8b5cf6", // Violet
    determination: "#dc2626", // Red
    disappointment: "#64748b", // Slate
    distress: "#b91c1c", // Dark red
    doubt: "#9ca3af", // Gray
    ecstasy: "#fbbf24", // Gold
    embarrassment: "#f87171", // Light red
    empathy: "#c084fc", // Purple
    envy: "#65a30d", // Green
    guilt: "#7c3aed", // Violet
    horror: "#1e293b", // Dark
    interest: "#0891b2", // Cyan
    nostalgia: "#c084fc", // Light purple
    pain: "#991b1b", // Dark red
    pride: "#fbbf24", // Gold
    realization: "#facc15", // Yellow
    relief: "#86efac", // Light green
    romance: "#f9a8d4", // Pink
    satisfaction: "#34d399", // Green
    shame: "#9f1239", // Dark pink
    sympathy: "#e9d5ff", // Light purple
    tiredness: "#6b7280", // Gray
    triumph: "#fde047", // Bright yellow
  }

  // Initialize WebSocket and Emotion Processor
  useEffect(() => {
    const initializeHume = async () => {
      try {
        // Get API key from environment variables (client-side)
        const apiKey = typeof window !== 'undefined'
          ? window.location.hostname === 'localhost'
            ? 'test-api-key' // Use test key for local development
            : ''
          : ''
        const configId = typeof window !== 'undefined' ? '' : ''
        
        // Create proper HumeConfig object
        const config = {
          apiKey,
          configId,
          websocketUrl: 'wss://api.hume.ai/v0/stream/models',
          enabledFeatures: {
            emotions: true,
            prosody: true,
            facial: true,
            vocalBursts: true,
            speech: true,
            evi2: false
          },
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2
          }
        }
        
        const manager = new HumeWebSocketManager(config)
        const processor = new EmotionProcessor()
        
        setWsManager(manager)
        setEmotionProcessor(processor)
        
        // Connect WebSocket
        await manager.connect()
        
        // Set up event listeners using the WebSocket's message handler
        // Listen for WebSocket messages
        const handleMessage = (message: any) => {
          if (message.type === 'emotion' && message.data) {
            const emotionScores = message.data.predictions?.[0]?.emotions || []
            const processed = processor.processEmotionData(emotionScores)
            const formattedEmotions = processed.emotions.map((e: any) => ({
              emotion: e.name,
              score: e.score
            }))
            updateFromEmotions(formattedEmotions)
          } else if (message.type === 'prosody' && message.data) {
            setProsodyData(message.data)
            const processed = processor.processProsodyData(message.data)
            updateFromProsody(processed)
          } else if (message.type === 'vocal_burst' && message.data) {
            setVocalBurst(message.data)
            handleVocalBurst(message.data)
          }
        }
        
        // We'll need to set up the message handler differently
        // For now, let's use a simplified approach
        
        setIsActive(true)
      } catch (error) {
        console.error("Failed to initialize Hume:", error)
      }
    }

    initializeHume()

    return () => {
      wsManager?.disconnect()
    }
  }, [])

  // Handle wake word detection
  useEffect(() => {
    if (detected && !conversationActive) {
      startConversation()
    }
  }, [detected, conversationActive])

  // Combine emotions from all sources
  useEffect(() => {
    if (!emotionProcessor) return

    const sources = []
    if (facialEmotions && facialEmotions.length > 0) {
      sources.push({
        data: {
          emotions: facialEmotions,
          timestamp: Date.now(),
          dominantEmotion: facialEmotions[0]?.name
        },
        weight: 0.5
      })
    }
    if (prosodyData?.emotions && prosodyData.emotions.length > 0) {
      sources.push({
        data: {
          emotions: prosodyData.emotions,
          timestamp: Date.now(),
          dominantEmotion: prosodyData.emotions[0]?.name
        },
        weight: 0.5
      })
    }
    
    const combined = sources.length > 0
      ? emotionProcessor.combineEmotionSources(sources)
      : { emotions: [], timestamp: Date.now() }

    const processed = combined.emotions.map((emotion: any) => ({
      name: emotion.name,
      score: emotion.score,
      color: emotionColors[emotion.name] || "#6366f1"
    }))

    setProcessedEmotions(processed)
    updateAura(processed)
  }, [facialEmotions, prosodyData, emotionProcessor])

  const startConversation = useCallback(async () => {
    setConversationActive(true)
    setMirrorMessage("Yes, my dear? What would you like to know?")
    
    // Start recording for voice interaction
    if (!isConnected) {
      await connect()
    }
    
    // Auto-stop conversation after 30 seconds of inactivity
    setTimeout(() => {
      if (conversationActive) {
        stopConversation()
      }
    }, 30000)
  }, [isConnected, connect, conversationActive])

  const stopConversation = useCallback(async () => {
    setConversationActive(false)
    setMirrorMessage("Mirror, mirror on the wall...")
    
    if (isConnected) {
      await disconnect()
    }
  }, [isConnected, disconnect])

  const updateFromEmotions = (emotions: Array<{ emotion: string; score: number }>) => {
    const processed = emotions.map(e => ({
      name: e.emotion,
      score: e.score,
      color: emotionColors[e.emotion] || "#6366f1"
    }))
    
    setProcessedEmotions((prev: ProcessedEmotion[]) => {
      // Merge with existing emotions, prioritizing new ones
      const merged = [...processed]
      prev.forEach((existing: ProcessedEmotion) => {
        if (!merged.find(e => e.name === existing.name)) {
          merged.push({ ...existing, score: existing.score * 0.8 }) // Decay old emotions
        }
      })
      return merged.slice(0, 5) // Keep top 5
    })
  }

  const updateFromProsody = (prosody: any) => {
    if (prosody.dominantEmotion) {
      updateMirrorMessage({
        name: prosody.dominantEmotion,
        score: prosody.confidence || 0.5
      })
    }
  }

  const handleVocalBurst = (burst: VocalBurst) => {
    // Add special effects for vocal bursts
    const burstMessages: Record<string, string> = {
      laugh: "Your laughter brightens the realm! 😄",
      sigh: "I sense a weight upon your soul... 💭",
      gasp: "What surprises you so? 😮",
      cry: "Your tears are precious, dear one... 💧",
      scream: "Such intensity! 😱",
      yawn: "Rest well when you need to... 😴"
    }
    
    if (burstMessages[burst.type]) {
      setMirrorMessage(burstMessages[burst.type])
      
      // Add burst particles
      addBurstParticles(burst.type)
    }
  }

  const addBurstParticles = (burstType: string) => {
    const burstColors: Record<string, string> = {
      laugh: "#fbbf24",
      sigh: "#6b7280",
      gasp: "#f59e0b",
      cry: "#3b82f6",
      scream: "#ef4444",
      yawn: "#c084fc"
    }
    
    const color = burstColors[burstType] || "#ffffff"
    const particles = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i,
      x: 40 + Math.random() * 20,
      y: 40 + Math.random() * 20,
      size: Math.random() * 12 + 6,
      color
    }))
    
    setAuraState((prev: AuraState) => ({
      ...prev,
      particles: [...prev.particles.slice(-20), ...particles]
    }))
  }

  const updateAura = (emotions: ProcessedEmotion[]) => {
    if (emotions.length === 0) return
    
    const primary = emotions[0]
    const intensity = primary.score
    const colors = emotions.map(e => e.color)

    // Generate magical particles based on emotion intensity
    const particleCount = Math.floor(intensity * 15) + 5
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
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
      particles: [...newParticles, ...auraState.particles].slice(0, 50), // Keep max 50 particles
    })
  }

  const updateMirrorMessage = (emotion: { name: string; score: number }) => {
    const messages: Record<string, string> = {
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
      admiration: "Your appreciation creates golden threads! ⭐",
      amusement: "Playful spirits dance around you! 🎭",
      anxiety: "Breathe deep, the storm shall pass... 🌬️",
      concentration: "Your focused mind cuts through the veil! 🎯",
      confusion: "The mists will clear, revealing truth... 🌫️",
      determination: "Unbreakable will forges your path! ⚔️",
      empathy: "Your compassion bridges all souls! 🌈",
      interest: "Curiosity opens magical doorways! 🚪",
      nostalgia: "Memories shimmer like starlight... ✨",
      pride: "You stand tall in your achievements! 👑",
      relief: "Peace washes over you like moonlight! 🌙",
      satisfaction: "Fulfillment glows within your core! 🌟",
      sympathy: "Your kindness heals the world! 💝",
      triumph: "Victory's light crowns you! 🏆"
    }

    if (!conversationActive) {
      setMirrorMessage(messages[emotion.name] || "Your unique essence is beautiful! ✨")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background overflow-hidden relative">
      {/* Magical Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {auraState.particles.map((particle: any) => (
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 relative z-10">
        {/* Mirror Title */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2 sm:mb-4">
            Aura Mirror
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
            Say "Mirror Mirror on the Wall" to begin your magical journey
          </p>
        </div>

        {/* Main Mirror Display */}
        <Card className="mirror-frame p-4 sm:p-6 lg:p-8 max-w-sm sm:max-w-2xl lg:max-w-4xl w-full relative overflow-hidden">
          {/* Video Feed with Processor */}
          <div className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-6">
            <VideoProcessor
              className="w-full h-full"
            />

            {/* Aura Overlay */}
            <AuraVisualization 
              emotions={processedEmotions}
              intensity={auraState.intensity}
            />

            {/* Emotion Indicators */}
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 space-y-1 sm:space-y-2">
              {processedEmotions.slice(0, 3).map((emotion: ProcessedEmotion) => (
                <div
                  key={emotion.name}
                  className="flex items-center space-x-1 sm:space-x-2 bg-black/50 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1"
                >
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: emotion.color }} />
                  <span className="text-white text-xs sm:text-sm capitalize font-medium">{emotion.name}</span>
                  <div className="w-12 sm:w-16 h-1 bg-white/20 rounded-full overflow-hidden">
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

            {/* Prosody Indicator */}
            {prosodyData && (
              <div className="absolute top-2 sm:top-4 right-2 sm:right-4 space-y-1 sm:space-y-2">
                <div className="bg-black/50 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1">
                  <span className="text-white text-xs sm:text-sm">
                    Voice: {prosodyData.pitch.mean > 0.5 ? "↑" : "↓"} {Math.round(prosodyData.energy.mean * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Vocal Burst Indicator */}
            {vocalBurst && (
              <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4">
                <div className="bg-accent/80 backdrop-blur-sm rounded-full px-3 py-1 animate-pulse">
                  <span className="text-white text-sm capitalize">{vocalBurst.type}</span>
                </div>
              </div>
            )}
          </div>

          {/* Voice Interface for Conversation */}
          {conversationActive && (
            <div className="mb-4">
              <VoiceInterface className="w-full" />
            </div>
          )}

          {/* Mirror Message */}
          <div className="text-center">
            <div className="magical-gradient p-4 sm:p-6 rounded-xl sm:rounded-2xl">
              <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">{mirrorMessage}</p>
              <p className="text-sm sm:text-base text-white/80">
                Primary Aura: <span className="capitalize font-bold">{auraState.primaryEmotion}</span>
              </p>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full magical-gradient opacity-60 particle-float" />
          </div>
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4">
            <div
              className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 rounded-full bg-accent/40 particle-float"
              style={{ animationDelay: "2s" }}
            />
          </div>
        </Card>

        {/* Status Indicators */}
        <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
            <span className="text-xs text-muted-foreground">System</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
            <span className="text-xs text-muted-foreground">Voice AI</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isListening ? "bg-blue-500" : "bg-gray-500"} animate-pulse`} />
            <span className="text-xs text-muted-foreground">Wake Word</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? "bg-purple-500" : "bg-gray-500"} animate-pulse`} />
            <span className="text-xs text-muted-foreground">Facial Analysis</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 sm:mt-8 text-center max-w-xs sm:max-w-lg lg:max-w-2xl px-4">
          <p className="text-sm sm:text-base text-muted-foreground">
            {conversationActive 
              ? "Speak naturally - the mirror is listening to your voice and watching your expressions..."
              : "Step into view and say 'Mirror Mirror on the Wall' to activate the magical mirror. Your emotions will create a unique aura!"
            }
          </p>
        </div>
      </div>
    </div>
  )
}
