
/**
 * Visual Effects Module for Aura Mirror
 * Provides emotion-based visual effects, particle systems, and WebGL shaders
 */

import { EmotionData, AuraColor } from '../hume/types';
import { EMOTION_AURA_MAPPINGS } from '../hume/emotion-processor';

export interface EffectConfig {
  enabled: boolean;
  intensity: number; // 0-1
  quality: 'low' | 'medium' | 'high';
  useWebGL: boolean;
}

export interface ParticleConfig {
  count: number;
  size: number;
  speed: number;
  lifetime: number;
  spread: number;
  gravity: number;
  turbulence: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  opacity: number;
}

export interface MirrorFrame {
  style: 'ornate' | 'modern' | 'mystical' | 'minimal';
  color: string;
  width: number;
  opacity: number;
  glowIntensity: number;
}

export class VisualEffects {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private gl: WebGLRenderingContext | null = null;
  private config: EffectConfig;
  private particles: Particle[] = [];
  private animationFrame: number | null = null;
  private startTime: number = Date.now();
  private shaderPrograms: Map<string, WebGLProgram> = new Map();
  private currentAura: AuraColor | null = null;
  private emotionTransitions: Map<string, number> = new Map();

  constructor(canvas: HTMLCanvasElement, config: Partial<EffectConfig> = {}) {
    this.canvas = canvas;
    this.config = {
      enabled: true,
      intensity: 1.0,
      quality: 'medium',
      useWebGL: true,
      ...config
    };

    // Initialize context
    if (this.config.useWebGL) {
      this.gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        antialias: true
      }) as WebGLRenderingContext;

      if (this.gl) {
        this.initializeWebGL();
      } else {
        this.config.useWebGL = false;
      }
    }

    if (!this.gl) {
      this.ctx = canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: false
      });
    }
  }

  /**
   * Initialize WebGL shaders and programs
   */
  private initializeWebGL(): void {
    if (!this.gl) return;

    // Aura glow shader
    this.createShaderProgram('auraGlow', 
      this.getAuraGlowVertexShader(),
      this.getAuraGlowFragmentShader()
    );

    // Particle shader
    this.createShaderProgram('particles',
      this.getParticleVertexShader(),
      this.getParticleFragmentShader()
    );

    // Distortion shader for mystical effects
    this.createShaderProgram('distortion',
      this.getDistortionVertexShader(),
      this.getDistortionFragmentShader()
    );
  }

  /**
   * Create and compile shader program
   */
  private createShaderProgram(name: string, vertexSource: string, fragmentSource: string): void {
    if (!this.gl) return;

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return;

    const program = this.gl.createProgram();
    if (!program) return;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(`Failed to link shader program ${name}`);
      return;
    }

    this.shaderPrograms.set(name, program);
  }

  /**
   * Compile individual shader
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Apply emotion-based aura effect
   */
  public applyAuraEffect(emotionData: EmotionData): void {
    if (!this.config.enabled) return;

    // Get aura color for dominant emotion
    const auraMapping = EMOTION_AURA_MAPPINGS.find(
      m => m.emotion === emotionData.dominantEmotion
    );

    if (auraMapping) {
      this.currentAura = auraMapping.colors;
      
      // Smooth transition between emotions
      this.updateEmotionTransitions(emotionData);
      
      if (this.gl && this.config.useWebGL) {
        this.renderWebGLAura();
      } else if (this.ctx) {
        this.renderCanvas2DAura();
      }
    }
  }

  /**
   * Update emotion transitions for smooth blending
   */
  private updateEmotionTransitions(emotionData: EmotionData): void {
    const transitionSpeed = 0.1;
    
    emotionData.emotions.forEach(emotion => {
      const current = this.emotionTransitions.get(emotion.name) || 0;
      const target = emotion.score;
      const newValue = current + (target - current) * transitionSpeed;
      this.emotionTransitions.set(emotion.name, newValue);
    });

    // Decay unused emotions
    this.emotionTransitions.forEach((value, key) => {
      if (!emotionData.emotions.find(e => e.name === key)) {
        const newValue = value * 0.95;
        if (newValue < 0.01) {
          this.emotionTransitions.delete(key);
        } else {
          this.emotionTransitions.set(key, newValue);
        }
      }
    });
  }

  /**
   * Render aura effect using WebGL
   */
  private renderWebGLAura(): void {
    if (!this.gl || !this.currentAura) return;

    const program = this.shaderPrograms.get('auraGlow');
    if (!program) return;

    this.gl.useProgram(program);

    // Set uniforms
    const time = (Date.now() - this.startTime) / 1000;
    const rgb = this.hexToRgb(this.currentAura.primary);

    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_time'), time);
    this.gl.uniform3f(this.gl.getUniformLocation(program, 'u_color'), rgb.r / 255, rgb.g / 255, rgb.b / 255);
    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_intensity'), this.currentAura.intensity * this.config.intensity);
    this.gl.uniform1f(this.gl.getUniformLocation(program, 'u_pulseRate'), this.currentAura.pulse_rate || 1.0);

    // Draw full-screen quad
    this.drawQuad();
  }

  /**
   * Render aura effect using Canvas 2D
   */
  private renderCanvas2DAura(): void {
    if (!this.ctx || !this.currentAura) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const time = (Date.now() - this.startTime) / 1000;
    
    // Calculate pulse
    const pulse = (Math.sin(time * (this.currentAura.pulse_rate || 1)) + 1) / 2;
    const intensity = this.currentAura.intensity * this.config.intensity * pulse;

    // Create radial gradient
    const gradient = this.ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) / 2
    );

    const alpha = Math.floor(intensity * 100);
    gradient.addColorStop(0, `${this.currentAura.primary}${alpha.toString(16).padStart(2, '0')}`);
    gradient.addColorStop(0.5, `${this.currentAura.secondary}${Math.floor(alpha * 0.5).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `${this.currentAura.accent || this.currentAura.secondary}00`);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Create and animate particle system
   */
  public createParticleSystem(config: Partial<ParticleConfig> = {}): void {
    const particleConfig: ParticleConfig = {
      count: this.getQualityAdjustedValue(50, 100, 200),
      size: 3,
      speed: 2,
      lifetime: 3000,
      spread: Math.PI * 2,
      gravity: 0,
      turbulence: 0.1,
      ...config
    };

    // Create particles
    for (let i = 0; i < particleConfig.count; i++) {
      this.createParticle(particleConfig);
    }

    // Start animation if not running
    if (!this.animationFrame) {
      this.animate();
    }
  }

  /**
   * Create individual particle
   */
  private createParticle(config: ParticleConfig): void {
    const angle = Math.random() * config.spread;
    const speed = config.speed * (0.5 + Math.random() * 0.5);
    
    const particle: Particle = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: config.size * (0.5 + Math.random() * 0.5),
      life: config.lifetime,
      maxLife: config.lifetime,
      color: this.currentAura?.primary || '#ffffff',
      opacity: 1
    };

    this.particles.push(particle);
  }

  /**
   * Update and render particles
   */
  private updateParticles(deltaTime: number): void {
    if (!this.ctx) return;

    // Update particles
    this.particles = this.particles.filter(particle => {
      // Update position
      particle.x += particle.vx * deltaTime / 16;
      particle.y += particle.vy * deltaTime / 16;
      
      // Apply gravity
      particle.vy += 0.1 * deltaTime / 16;
      
      // Update life
      particle.life -= deltaTime;
      particle.opacity = particle.life / particle.maxLife;
      
      // Remove dead particles
      return particle.life > 0;
    });

    // Render particles
    this.particles.forEach(particle => {
      if (!this.ctx) return;
      
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity * this.config.intensity;
      this.ctx.fillStyle = particle.color;
      
      // Draw particle with glow
      const gradient = this.ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.size * 2
      );
      gradient.addColorStop(0, particle.color);
      gradient.addColorStop(1, `${particle.color}00`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw core
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    });
  }

  /**
   * Apply glow effect
   */
  public applyGlowEffect(color: string, intensity: number): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 20 * intensity;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    // Draw glow
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = intensity * 0.5;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.restore();
  }

  /**
   * Apply blur effect
   */
  public applyBlurEffect(amount: number): void {
    if (!this.ctx) return;
    
    this.ctx.filter = `blur(${amount}px)`;
  }

  /**
   * Draw mirror frame overlay
   */
  public drawMirrorFrame(frame: MirrorFrame): void {
    if (!this.ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.save();
    this.ctx.globalAlpha = frame.opacity;
    
    // Draw frame based on style
    switch (frame.style) {
      case 'ornate':
        this.drawOrnateFrame(frame);
        break;
      case 'modern':
        this.drawModernFrame(frame);
        break;
      case 'mystical':
        this.drawMysticalFrame(frame);
        break;
      case 'minimal':
        this.drawMinimalFrame(frame);
        break;
    }
    
    // Add glow if specified
    if (frame.glowIntensity > 0) {
      this.applyGlowEffect(frame.color, frame.glowIntensity);
    }
    
    this.ctx.restore();
  }

  /**
   * Draw ornate frame style
   */
  private drawOrnateFrame(frame: MirrorFrame): void {
    if (!this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.strokeStyle = frame.color;
    this.ctx.lineWidth = frame.width;
    
    // Outer frame
    this.ctx.strokeRect(10, 10, width - 20, height - 20);
    
    // Inner decorative frame
    this.ctx.lineWidth = frame.width / 2;
    this.ctx.strokeRect(20, 20, width - 40, height - 40);
    
    // Corner decorations
    const cornerSize = 50;
    this.ctx.lineWidth = frame.width / 3;
    
    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(10, 10 + cornerSize);
    this.ctx.quadraticCurveTo(10, 10, 10 + cornerSize, 10);
    this.ctx.stroke();
    
    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(width - 10 - cornerSize, 10);
    this.ctx.quadraticCurveTo(width - 10, 10, width - 10, 10 + cornerSize);
    this.ctx.stroke();
    
    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(10, height - 10 - cornerSize);
    this.ctx.quadraticCurveTo(10, height - 10, 10 + cornerSize, height - 10);
    this.ctx.stroke();
    
    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(width - 10 - cornerSize, height - 10);
    this.ctx.quadraticCurveTo(width - 10, height - 10, width - 10, height - 10 - cornerSize);
    this.ctx.stroke();
  }

  /**
   * Draw modern frame style
   */
  private drawModernFrame(frame: MirrorFrame): void {
    if (!this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.strokeStyle = frame.color;
    this.ctx.lineWidth = frame.width;
    
    // Simple rectangular frame
    this.ctx.strokeRect(0, 0, width, height);
    
    // Accent lines
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(frame.width, frame.width, width - frame.width * 2, height - frame.width * 2);
  }

  /**
   * Draw mystical frame style
   */
  private drawMysticalFrame(frame: MirrorFrame): void {
    if (!this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    const time = (Date.now() - this.startTime) / 1000;
    
    // Animated mystical border
    this.ctx.strokeStyle = frame.color;
    
    for (let i = 0; i < 3; i++) {
      this.ctx.lineWidth = frame.width * (1 - i * 0.3);
      this.ctx.globalAlpha = frame.opacity * (1 - i * 0.3);
      
      const offset = Math.sin(time + i) * 5;
      this.ctx.strokeRect(
        10 + offset + i * 10,
        10 + offset + i * 10,
        width - 20 - offset * 2 - i * 20,
        height - 20 - offset * 2 - i * 20
      );
    }
  }

  /**
   * Draw minimal frame style
   */
  private drawMinimalFrame(frame: MirrorFrame): void {
    if (!this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.strokeStyle = frame.color;
    this.ctx.lineWidth = frame.width;
    
    // Corner brackets only
    const bracketSize = 50;
    
    // Top-left
    this.ctx.beginPath();
    this.ctx.moveTo(0, bracketSize);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(bracketSize, 0);
    this.ctx.stroke();
    
    // Top-right
    this.ctx.beginPath();
    this.ctx.moveTo(width - bracketSize, 0);
    this.ctx.lineTo(width, 0);
    this.ctx.lineTo(width, bracketSize);
    this.ctx.stroke();
    
    // Bottom-left
    this.ctx.beginPath();
    this.ctx.moveTo(0, height - bracketSize);
    this.ctx.lineTo(0, height);
    this.ctx.lineTo(bracketSize, height);
    this.ctx.stroke();
    
    // Bottom-right
    this.ctx.beginPath();
    this.ctx.moveTo(width - bracketSize, height);
    this.ctx.lineTo(width, height);
    this.ctx.lineTo(width, height - bracketSize);
    this.ctx.stroke();
  }

  /**
   * Create transition animation between emotion states
   */
  public createEmotionTransition(
    fromEmotion: string,
    toEmotion: string,
    duration: number = 1000
  ): void {
    const fromMapping = EMOTION_AURA_MAPPINGS.find(m => m.emotion === fromEmotion);
    const toMapping = EMOTION_AURA_MAPPINGS.find(m => m.emotion === toEmotion);
    
    if (!fromMapping || !toMapping) return;
    
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-in-out function
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      // Interpolate colors
      const fromRgb = this.hexToRgb(fromMapping.colors.primary);
      const toRgb = this.hexToRgb(toMapping.colors.primary);
      
      const r = Math.floor(fromRgb.r + (toRgb.r - fromRgb.r) * eased);
      const g = Math.floor(fromRgb.g + (toRgb.g - fromRgb.g) * eased);
      const b = Math.floor(fromRgb.b + (toRgb.b - fromRgb.b) * eased);
      
      const interpolatedColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      // Apply interpolated effect
      this.applyGlowEffect(interpolatedColor, fromMapping.colors.intensity + (toMapping.colors.intensity - fromMapping.colors.intensity) * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  /**
   * Animation loop
   */
  private animate(): void {
    const now = Date.now();
    const deltaTime = now - (this.lastFrameTime || now);
    this.lastFrameTime = now;
    
    // Clear canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Update and render particles
    if (this.particles.length > 0) {
      this.updateParticles(deltaTime);
    }
    
    // Continue animation
    if (this.particles.length > 0 || this.config.enabled) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.animationFrame = null;
    }
  }
  
  private lastFrameTime: number = 0;

  /**
   * WebGL shader sources
   */
  private getAuraGlowVertexShader(): string {
    return `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) / 2.0;
      }
    `;
  }

  private getAuraGlowFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform float u_time;
      uniform vec3 u_color;
      uniform float u_intensity;
      uniform float u_pulseRate;
      
      varying vec2 v_texCoord;
      
      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(v_texCoord, center);
        
        float pulse = sin(u_time * u_pulseRate) * 0.5 + 0.5;
        float glow = (1.0 - dist) * u_intensity * pulse;
        
        vec3 color = u_color * glow;
        float alpha = glow * 0.5;
        
        gl_FragColor = vec4(color, alpha);
      }
    `;
  }

  private getParticleVertexShader(): string {
    return `
      attribute vec2 a_position;
      attribute float a_size;
      
      uniform mat4 u_projection;
      
      void main() {
        gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_size;
      }
    `;
  }

  private getParticleFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform vec4 u_color;
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        
        if (dist > 0.5) {
          discard;
        }
        
        float alpha = 1.0 - (dist * 2.0);
        gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
      }
    `;
  }

  private getDistortionVertexShader(): string {
    return `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) / 2.0;
      }
    `;
  }

  private getDistortionFragmentShader(): string {
    return `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform float u_time;
      uniform float u_amount;
      
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        
        // Wave distortion
        uv.x += sin(uv.y * 10.0 + u_time) * u_amount;
        uv.y += cos(uv.x * 10.0 + u_time) * u_amount;
        
        vec4 color = texture2D(u_texture, uv);
        gl_FragColor = color;
      }
    `;
  }

  /**
   * Draw full-screen quad for WebGL
   */
  private drawQuad(): void {
    if (!this.gl) return;

    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    const program = this.gl.getParameter(this.gl.CURRENT_PROGRAM);
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Get quality-adjusted value
   */
  private getQualityAdjustedValue(low: number, medium: number, high: number): number {
    switch (this.config.quality) {
      case 'low': return low;
      case 'medium': return medium;
      case 'high': return high;
      default: return medium;
    }
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<EffectConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all effects
   */
  public clear(): void {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    
    this.particles = [];
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.gl) {
      this.shaderPrograms.forEach(program => {
        this.gl!.deleteProgram(program);
      });
      this.shaderPrograms.clear();
    }

    this.particles = [];
    this.emotionTransitions.clear();
  }
}

/**
 * Create visual effects instance
 */
export function createVisualEffects(
  canvas: HTMLCanvasElement,
  config?: Partial<EffectConfig>
): VisualEffects {
  return new VisualEffects(canvas, config);
}

/**
 * Preset effect configurations
 */
export const EFFECT_PRESETS = {
  subtle: {
    intensity: 0.3,
    quality: 'low' as const,
    useWebGL: false
  },
  balanced: {
    intensity: 0.6,
    quality: 'medium' as const,
    useWebGL: true
  },
  dramatic: {
    intensity: 1.0,
    quality: 'high' as const,
    useWebGL: true
  }
};

/**
 * Preset particle configurations
 */
export const PARTICLE_PRESETS = {
  sparkles: {
    count: 50,
    size: 2,
    speed: 1,
    lifetime: 2000,
    spread: Math.PI * 2,
    gravity: -0.1,
    turbulence: 0.2
  },
  fireflies: {
    count: 30,
    size: 4,
    speed: 0.5,
    lifetime: 5000,
    spread: Math.PI * 2,
    gravity: 0,
    turbulence: 0.5
  },
  embers: {
    count: 100,
    size: 3,
    speed: 2,
    lifetime: 3000,
    spread: Math.PI / 4,
    gravity: 0.2,
    turbulence: 0.1
  },
  aurora: {
    count: 80,
    size: 5,
    speed: 0.3,
    lifetime: 8000,
    spread: Math.PI,
    gravity: -0.05,
    turbulence: 0.3
  }
};

/**
 * Preset frame styles
 */
export const FRAME_PRESETS = {
  ornate: {
    style: 'ornate' as const,
    color: '#D4AF37',
    width: 8,
    opacity: 0.8,
    glowIntensity: 0.3
  },
  modern: {
    style: 'modern' as const,
    color: '#FFFFFF',
    width: 4,
    opacity: 0.9,
    glowIntensity: 0.1
  },
  mystical: {
    style: 'mystical' as const,
    color: '#9B59B6',
    width: 6,
    opacity: 0.7,
    glowIntensity: 0.5
  },
  minimal: {
    style: 'minimal' as const,
    color: '#333333',
    width: 2,
    opacity: 1.0,
    glowIntensity: 0
  }
};