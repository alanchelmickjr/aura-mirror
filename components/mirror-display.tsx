"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { VideoProcessor } from "@/components/video-processor"
import { VoiceInterface } from "@/components/voice-interface"
import { AuraVisualization } from "@/components/aura-visualization"
import { cn } from "@/lib/utils"

interface MirrorDisplayProps {
  emotions: Array<{ name: string; score: number; color: string }>
  intensity: number
  isConversationActive: boolean
  mirrorMessage: string
  primaryEmotion: string
  prosodyData?: {
    pitch: number
    energy: number
  }
  vocalBurst?: {
    type: string
    confidence: number
  }
  className?: string
  fullScreen?: boolean
}

export function MirrorDisplay({
  emotions,
  intensity,
  isConversationActive,
  mirrorMessage,
  primaryEmotion,
  prosodyData,
  vocalBurst,
  className = "",
  fullScreen = false
}: MirrorDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showFrame, setShowFrame] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Update time for display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle full-screen toggle
  useEffect(() => {
    const handleFullScreen = async () => {
      if (fullScreen && containerRef.current) {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen()
          } else {
            await containerRef.current.requestFullscreen()
          }
        } catch (error) {
          console.error("Fullscreen error:", error)
        }
      }
    }

    if (fullScreen) {
      handleFullScreen()
    }
  }, [fullScreen])

  // Format time display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full min-h-screen bg-black overflow-hidden",
        className
      )}
    >
      {/* Ornate Mirror Frame */}
      {showFrame && (
        <>
          {/* Top Frame */}
          <div className="absolute top-0 left-0 right-0 h-24 z-20 pointer-events-none">
            <div className="h-full bg-gradient-to-b from-black via-gray-900 to-transparent">
              <div className="flex justify-center items-center h-full">
                <div className="text-center">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                    Mirror Mirror on the Wall
                  </h1>
                  <div className="text-xs text-amber-400/60 mt-1">
                    {formatDate(currentTime)} • {formatTime(currentTime)}
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute top-4 left-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400/20 to-transparent animate-pulse" />
              </div>
              <div className="absolute top-4 right-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-bl from-amber-400/20 to-transparent animate-pulse" />
              </div>
            </div>
          </div>

          {/* Side Frames */}
          <div className="absolute top-24 bottom-24 left-0 w-12 z-20 pointer-events-none">
            <div className="h-full bg-gradient-to-r from-black via-gray-900 to-transparent">
              <div className="h-full flex flex-col justify-center space-y-8 pl-2">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2 h-2 rounded-full bg-amber-400/40 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="absolute top-24 bottom-24 right-0 w-12 z-20 pointer-events-none">
            <div className="h-full bg-gradient-to-l from-black via-gray-900 to-transparent">
              <div className="h-full flex flex-col justify-center space-y-8 pr-2 items-end">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2 h-2 rounded-full bg-amber-400/40 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Frame */}
          <div className="absolute bottom-0 left-0 right-0 h-24 z-20 pointer-events-none">
            <div className="h-full bg-gradient-to-t from-black via-gray-900 to-transparent" />
          </div>
        </>
      )}

      {/* Main Mirror Content */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="relative w-full max-w-6xl aspect-video">
          {/* Video Feed */}
          <VideoProcessor className="w-full h-full rounded-2xl" />
          
          {/* Aura Overlay */}
          <AuraVisualization 
            emotions={emotions}
            intensity={intensity}
            className="rounded-2xl"
          />

          {/* Emotion Indicators */}
          <div className="absolute top-4 left-4 space-y-2 z-10">
            {emotions.slice(0, 3).map((emotion) => (
              <div
                key={emotion.name}
                className="flex items-center space-x-2 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5"
              >
                <div 
                  className="w-3 h-3 rounded-full animate-pulse" 
                  style={{ backgroundColor: emotion.color }}
                />
                <span className="text-white text-sm font-medium capitalize">
                  {emotion.name}
                </span>
                <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
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
            <div className="absolute top-4 right-4 z-10">
              <div className="bg-black/60 backdrop-blur-md rounded-2xl px-4 py-2">
                <div className="text-white text-sm font-medium mb-1">Voice Analysis</div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-white/60">Pitch</span>
                    <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all"
                        style={{ width: `${prosodyData.pitch * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-white/60">Energy</span>
                    <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-yellow-400 rounded-full transition-all"
                        style={{ width: `${prosodyData.energy * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vocal Burst Indicator */}
          {vocalBurst && (
            <div className="absolute bottom-4 right-4 z-10">
              <div className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full px-4 py-2 animate-pulse">
                <span className="text-white text-sm font-bold capitalize">
                  {vocalBurst.type} detected
                </span>
              </div>
            </div>
          )}

          {/* Conversation Interface */}
          {isConversationActive && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <VoiceInterface className="w-full" />
            </div>
          )}
        </div>
      </div>

      {/* Mirror Message Overlay */}
      <div className="absolute bottom-32 left-0 right-0 z-10 pointer-events-none">
        <div className="max-w-4xl mx-auto px-8">
          <div className="bg-gradient-to-r from-purple-900/60 via-pink-900/60 to-purple-900/60 backdrop-blur-xl rounded-3xl p-6 border border-purple-400/20">
            <p className="text-2xl font-semibold text-white text-center mb-2">
              {mirrorMessage}
            </p>
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse" />
                <span className="text-sm text-white/80">
                  Primary Aura: <span className="font-bold capitalize">{primaryEmotion}</span>
                </span>
              </div>
              <div className="text-white/40">•</div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse" />
                <span className="text-sm text-white/80">
                  Intensity: <span className="font-bold">{Math.round(intensity * 100)}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Magical Particles Background */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 6 + 2}px`,
              height: `${Math.random() * 6 + 2}px`,
              backgroundColor: emotions[0]?.color || '#ffffff',
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${Math.random() * 20 + 10}s`
            }}
          />
        ))}
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-24 left-12 w-32 h-32 pointer-events-none z-10">
        <div className="relative w-full h-full">
          <div className="absolute inset-0 border-t-2 border-l-2 border-amber-400/30 rounded-tl-3xl" />
          <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-400/60 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="absolute top-24 right-12 w-32 h-32 pointer-events-none z-10">
        <div className="relative w-full h-full">
          <div className="absolute inset-0 border-t-2 border-r-2 border-amber-400/30 rounded-tr-3xl" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400/60 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="absolute bottom-24 left-12 w-32 h-32 pointer-events-none z-10">
        <div className="relative w-full h-full">
          <div className="absolute inset-0 border-b-2 border-l-2 border-amber-400/30 rounded-bl-3xl" />
          <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-amber-400/60 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="absolute bottom-24 right-12 w-32 h-32 pointer-events-none z-10">
        <div className="relative w-full h-full">
          <div className="absolute inset-0 border-b-2 border-r-2 border-amber-400/30 rounded-br-3xl" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400/60 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Full Screen Toggle Hint */}
      {!fullScreen && (
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={() => containerRef.current?.requestFullscreen()}
            className="bg-black/60 backdrop-blur-md text-white/80 px-3 py-1.5 rounded-lg text-xs hover:bg-black/80 transition-colors"
          >
            Press F11 for Full Screen
          </button>
        </div>
      )}
    </div>
  )
}