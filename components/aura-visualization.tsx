"use client"

import { useEffect, useRef } from "react"

interface AuraVisualizationProps {
  emotions: Array<{ name: string; score: number; color: string }>
  intensity: number
}

export function AuraVisualization({ emotions, intensity }: AuraVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw aura layers
      emotions.forEach((emotion, index) => {
        const radius = (100 + index * 30) * (1 + intensity * 0.5)
        const alpha = emotion.score * 0.3

        // Create gradient
        const gradient = ctx.createRadialGradient(
          canvas.width / 4,
          canvas.height / 4,
          0,
          canvas.width / 4,
          canvas.height / 4,
          radius,
        )
        gradient.addColorStop(
          0,
          `${emotion.color}${Math.floor(alpha * 255)
            .toString(16)
            .padStart(2, "0")}`,
        )
        gradient.addColorStop(1, "transparent")

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(canvas.width / 4, canvas.height / 4, radius, 0, Math.PI * 2)
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [emotions, intensity])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  )
}
