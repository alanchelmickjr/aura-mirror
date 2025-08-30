"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { VoiceInterface } from "@/components/voice-interface"
import { VideoProcessor } from "@/components/video-processor"
import { SimpleCamera } from "@/components/simple-camera"
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
  const [videoProcessorEmotions, setVideoProcessorEmotions] = useState<ProcessedEmotion[]>([])
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
  const { 
    emotions: facialEmotions, 
    isProcessing,
    currentEmotions,
    dominantEmotion,
    auraColor,
    emotionTrends,
    isInitialized: facialInitialized 
  } = useFacialEmotions({
    wsManager: wsManager || undefined,
    autoStart: true,
    frameRate: 5, // Lower frame rate for better performance
    onEmotionChange: (emotions) => {
      // console.log('Facial emotions detected:', emotions);
      const formattedEmotions = emotions.emotions.map((e: any) => ({
        emotion: e.name,
        score: e.score
      }));
      updateFromEmotions(formattedEmotions);
    }
  })

  // VideoProcessor emotion color mapping (matches VideoProcessor component)
  const getVideoProcessorEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      joy: '#FFD700',
      sadness: '#4169E1',
      anger: '#DC143C',
      fear: '#8B008B',
      surprise: '#FF69B4',
      disgust: '#228B22',
      contempt: '#8B4513',
      neutral: '#808080',
      // Add more emotions with consistent colors
      love: '#FF1493',
      excitement: '#FF4500',
      calmness: '#87CEEB',
      contentment: '#98FB98',
      admiration: '#9370DB',
      amusement: '#FF69B4',
      anxiety: '#8B4513',
      concentration: '#4682B4',
      contemplation: '#708090',
      interest: '#20B2AA',
      realization: '#00CED1',
      annoyance: '#CD5C5C',
      confusion: '#696969',
      disappointment: '#483D8B',
      distress: '#8B008B',
      embarrassment: '#DC143C',
      guilt: '#800020',
      shame: '#8B4513',
      gratitude: '#98FB98',
      pride: '#4B0082'
    };
    return colors[emotion.toLowerCase()] || '#808080';
  };

  // Emotion to hue rotation mapping (0-360 degrees)
  const getHueFromEmotion = (emotion: string): number => {
    const hueMap: Record<string, number> = {
      // Warm emotions - reds/oranges/yellows (0-60)
      joy: 45,        // Golden yellow
      excitement: 15, // Orange-red
      love: 330,      // Pink-red
      amusement: 50,  // Yellow
      pride: 40,      // Gold
      gratitude: 120, // Green

      // Cool emotions - blues/purples (180-270)
      sadness: 220,      // Blue
      calmness: 200,     // Light blue
      concentration: 210, // Sky blue
      contemplation: 240, // Purple-blue
      fear: 270,         // Purple

      // Energetic emotions - magentas/reds (300-360)
      anger: 0,          // Red
      surprise: 300,     // Magenta
      distress: 320,     // Red-purple

      // Neutral/earthy emotions - greens/browns (60-180)
      neutral: 0,        // No hue shift
      boredom: 30,       // Brown-orange (to match saturated skin tones)
      disgust: 100,      // Green
      contentment: 140,  // Green-cyan
      interest: 180,     // Cyan
      realization: 190,  // Light cyan

      // Complex emotions - mixed hues
      admiration: 260,    // Violet
      anxiety: 30,        // Brown-orange
      confusion: 0,       // No shift
      disappointment: 230, // Blue-purple
      embarrassment: 350,  // Pink
      guilt: 280,         // Dark purple
      shame: 20,          // Brown
      annoyance: 10,      // Red-orange
    };
    
    return hueMap[emotion.toLowerCase()] || 0;
  };

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
        // Get API key from environment variable (client-side)
        const apiKey = process.env.NEXT_PUBLIC_HUME_API_KEY;
        
        if (!apiKey) {
          console.error('NEXT_PUBLIC_HUME_API_KEY not found in environment variables');
          return;
        }
        
        const configId = ''
        
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
    // console.log('Page: updateFromEmotions called with:', emotions);
    const processed = emotions.map(e => ({
      name: e.emotion,
      score: e.score,
      color: emotionColors[e.emotion] || "#6366f1"
    }))
    
    // console.log('Page: processed emotions:', processed);
    
    setProcessedEmotions((prev: ProcessedEmotion[]) => {
      // Merge with existing emotions, prioritizing new ones
      const merged = [...processed]
      prev.forEach((existing: ProcessedEmotion) => {
        if (!merged.find(e => e.name === existing.name)) {
          merged.push({ ...existing, score: existing.score * 0.8 }) // Decay old emotions
        }
      })
      const result = merged.slice(0, 5); // Keep top 5
      // console.log('Page: Updated processedEmotions to:', result);
      return result;
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
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      <VideoProcessor
        className="w-full h-full"
        wsManager={wsManager || undefined}
        apiKey={process.env.NEXT_PUBLIC_HUME_API_KEY || ""}
        enableFacialAnalysis={true}
        enableSegmentation={false}
        enableEffects={true}
        showDebugInfo={true}
        hueRotation={videoProcessorEmotions.length > 0 ? getHueFromEmotion(videoProcessorEmotions[0].name) : 0}
        saturation={videoProcessorEmotions.length > 0 ? 2 + videoProcessorEmotions[0].score * 2 : 1}
        brightness={videoProcessorEmotions.length > 0 ? 1.1 + videoProcessorEmotions[0].score * 0.3 : 1}
        onEmotionUpdate={(emotions) => {
          // console.log('Page: Emotions from VideoProcessor:', emotions);
          const formattedEmotions = emotions.emotions.map((e: any) => ({
            emotion: e.name,
            score: e.score
          }));
          
          // Also update video processor emotions for overlay
          const videoEmotions = emotions.emotions
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 5)
            .map((e: any) => ({
              name: e.name,
              score: e.score,
              color: getVideoProcessorEmotionColor(e.name)
            }));
          setVideoProcessorEmotions(videoEmotions);
          
          // console.log('Page: formattedEmotions:', formattedEmotions);
          updateFromEmotions(formattedEmotions);
        }}
        onFacesDetected={(faces) => {
          // console.log('Faces detected:', faces.length);
        }}
      />
      
      {/* Debug Info */}
      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 text-white text-xs max-w-xs">
        <div className="font-semibold mb-2">Hue Filter Debug</div>
        <div>VideoProcessor Emotions: {videoProcessorEmotions.length}</div>
        {videoProcessorEmotions.length > 0 && (
          <>
            <div>Current emotion: {videoProcessorEmotions[0].name}</div>
            <div>Hue rotation: {getHueFromEmotion(videoProcessorEmotions[0].name)}°</div>
            <div>Saturation: {(2 + videoProcessorEmotions[0].score * 2).toFixed(2)}</div>
            <div>Brightness: {(1.1 + videoProcessorEmotions[0].score * 0.3).toFixed(2)}</div>
            <div>Score: {(videoProcessorEmotions[0].score * 100).toFixed(1)}%</div>
            
            {/* Show the actual color being displayed */}
            <div className="mt-3 p-3 border border-white/20 rounded">
              <div className="text-xs text-gray-300 mb-2">Bottom-left indicator color:</div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded border-2 border-white/50" 
                  style={{ backgroundColor: videoProcessorEmotions[0].color }}
                />
                <div>
                  <div className="font-mono text-xs">{videoProcessorEmotions[0].color}</div>
                  <div className="text-gray-400 text-xs">({videoProcessorEmotions[0].name})</div>
                </div>
              </div>
            </div>
            
            <div className="mt-2 text-gray-300">All detected emotions:</div>
            {videoProcessorEmotions.slice(0, 5).map((emotion, i) => (
              <div key={emotion.name} className="text-xs flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded border border-white/30" 
                  style={{ backgroundColor: emotion.color }}
                />
                {i + 1}. {emotion.name}: {(emotion.score * 100).toFixed(1)}% 
                <span className="text-gray-400">({getHueFromEmotion(emotion.name)}°)</span>
                {i === 0 && <span className="text-yellow-400">← DOMINANT</span>}
              </div>
            ))}
            
            <div className="mt-3 p-2 bg-yellow-900/30 rounded text-xs">
              <div className="text-yellow-400 font-semibold">Expected for Yellow Video:</div>
              <div>• Joy (45°) • Amusement (50°) • Excitement (15°)</div>
              <div>• Gratitude (120°) • Pride (40°)</div>
            </div>
          </>
        )}
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div>Page Emotions: {processedEmotions.length}</div>
        </div>
      </div>
      
      {/* Emotion Overlay */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 max-w-xs">
        <h3 className="text-white text-sm font-semibold mb-2">Detected Emotions</h3>
        {processedEmotions.length > 0 ? (
          <div className="space-y-1">
            {processedEmotions.slice(0, 5).map((emotion, index) => (
              <div key={emotion.name} className="flex items-center justify-between">
                <span 
                  className="text-xs font-medium"
                  style={{ color: emotion.color }}
                >
                  {emotion.name}
                </span>
                <div className="flex items-center ml-2">
                  <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(emotion.score * 100, 100)}%`,
                        backgroundColor: emotion.color 
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-300 ml-2 min-w-[2.5rem] text-right">
                    {(emotion.score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-xs">
            {facialInitialized ? 'No emotions detected' : 'Initializing...'}
          </div>
        )}
        
        {dominantEmotion && (
          <div className="mt-3 pt-2 border-t border-gray-600">
            <div className="text-xs text-gray-300">Primary Emotion:</div>
            <div 
              className="text-sm font-bold"
              style={{ color: auraColor?.primary || '#6366f1' }}
            >
              {dominantEmotion}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
