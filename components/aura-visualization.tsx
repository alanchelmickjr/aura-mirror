"use client"

import { useEffect, useRef, useState } from "react"
import { EmotionProcessor } from "@/lib/hume/emotion-processor"

interface AuraVisualizationProps {
  emotions: Array<{ name: string; score: number; color: string }>
  intensity: number
  className?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  maxLife: number
}

export function AuraVisualization({ emotions, intensity, className = "" }: AuraVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const particlesRef = useRef<Particle[]>([])
  const [emotionProcessor] = useState(() => new EmotionProcessor())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    // Set canvas size to match display size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Initialize particles based on emotions
    const initParticles = () => {
      const particles: Particle[] = []
      const particleCount = Math.floor(20 + intensity * 30)
      
      emotions.forEach((emotion, emotionIndex) => {
        const emotionParticles = Math.floor(particleCount * emotion.score / emotions.reduce((sum, e) => sum + e.score, 0))
        
        for (let i = 0; i < emotionParticles; i++) {
          particles.push({
            x: Math.random() * canvas.width / window.devicePixelRatio,
            y: Math.random() * canvas.height / window.devicePixelRatio,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: Math.random() * 4 + 2,
            color: emotion.color,
            life: Math.random() * 100,
            maxLife: 100 + Math.random() * 100
          })
        }
      })
      
      particlesRef.current = particles
    }

    initParticles()

    // Animation loop
    const animate = () => {
      const width = canvas.width / window.devicePixelRatio
      const height = canvas.height / window.devicePixelRatio
      
      // Clear canvas with fade effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
      ctx.fillRect(0, 0, width, height)
      
      // Draw aura gradient layers
      emotions.forEach((emotion, index) => {
        const radius = (80 + index * 40) * (1 + intensity * 0.5)
        const centerX = width / 2
        const centerY = height / 2
        
        // Create radial gradient
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, radius
        )
        
        const alpha = emotion.score * 0.2 * (1 + intensity * 0.5)
        gradient.addColorStop(0, `${emotion.color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`)
        gradient.addColorStop(0.5, `${emotion.color}${Math.floor(alpha * 128).toString(16).padStart(2, "0")}`)
        gradient.addColorStop(1, "transparent")
        
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      })
      
      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        // Update particle position
        particle.x += particle.vx * intensity
        particle.y += particle.vy * intensity
        particle.life++
        
        // Wrap around edges
        if (particle.x < 0) particle.x = width
        if (particle.x > width) particle.x = 0
        if (particle.y < 0) particle.y = height
        if (particle.y > height) particle.y = 0
        
        // Calculate opacity based on life
        const lifeRatio = particle.life / particle.maxLife
        const opacity = lifeRatio < 0.5 ? lifeRatio * 2 : 2 - lifeRatio * 2
        
        // Draw particle with glow effect
        ctx.save()
        ctx.globalCompositeOperation = "screen"
        
        // Outer glow
        const glowGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        )
        glowGradient.addColorStop(0, `${particle.color}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`)
        glowGradient.addColorStop(1, "transparent")
        
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2)
        ctx.fill()
        
        // Inner particle
        ctx.fillStyle = `${particle.color}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
        
        // Remove dead particles
        return particle.life < particle.maxLife
      })
      
      // Add new particles to maintain count
      const targetCount = Math.floor(20 + intensity * 30)
      while (particlesRef.current.length < targetCount && emotions.length > 0) {
        const emotion = emotions[Math.floor(Math.random() * emotions.length)]
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 4 + 2,
          color: emotion.color,
          life: 0,
          maxLife: 100 + Math.random() * 100
        })
      }
      
      // Draw emotion energy waves
      const time = Date.now() * 0.001
      emotions.forEach((emotion, index) => {
        const waveIntensity = emotion.score * intensity
        const waveRadius = 100 + Math.sin(time + index) * 20 * waveIntensity
        
        ctx.save()
        ctx.globalCompositeOperation = "screen"
        ctx.strokeStyle = `${emotion.color}40`
        ctx.lineWidth = 2 + waveIntensity * 2
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, waveRadius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })
      
      // Add burst effect for high intensity
      if (intensity > 0.7) {
        const burstCount = Math.floor((intensity - 0.7) * 10)
        for (let i = 0; i < burstCount; i++) {
          const angle = (Math.PI * 2 * i) / burstCount + time
          const distance = 150 + Math.sin(time * 2) * 30
          const x = width / 2 + Math.cos(angle) * distance
          const y = height / 2 + Math.sin(angle) * distance
          
          const primaryEmotion = emotions[0]
          if (primaryEmotion) {
            ctx.save()
            ctx.globalCompositeOperation = "screen"
            ctx.fillStyle = `${primaryEmotion.color}60`
            ctx.beginPath()
            ctx.arc(x, y, 3 + intensity * 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [emotions, intensity])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ 
        mixBlendMode: "screen",
        opacity: 0.9
      }}
    />
  )
}
