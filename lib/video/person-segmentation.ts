/**
 * Person Segmentation Module
 * Uses TensorFlow.js and MediaPipe Selfie Segmentation for real-time person segmentation
 * Provides background blur and emotion-based colorization overlay
 */

import { EmotionData, AuraColor } from '../hume/types';
import { EmotionProcessor } from '../hume/emotion-processor';

export interface SegmentationConfig {
  modelType?: 'general' | 'landscape'; // general = faster, landscape = more accurate
  smoothSegmentation?: boolean; // Smooth segmentation across frames
  minDetectionConfidence?: number; // 0-1, default 0.5
  minTrackingConfidence?: number; // 0-1, default 0.5
  selfieMode?: boolean; // Flip horizontally for selfie view
  backgroundBlurAmount?: number; // 0-20, blur intensity
  edgeBlurAmount?: number; // 0-20, edge softness
  enableColorization?: boolean; // Enable emotion-based colorization
  enableWebGL?: boolean; // Use WebGL acceleration
  targetFPS?: number; // Target frames per second
}

export interface SegmentationResult {
  mask: ImageData | HTMLCanvasElement;
  confidence: number;
  processingTime: number;
  fps: number;
}

export interface PerformanceMetrics {
  averageFPS: number;
  averageProcessingTime: number;
  frameCount: number;
  droppedFrames: number;
}

export class PersonSegmentation {
  private config: Required<SegmentationConfig>;
  private segmentationModel: any = null;
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;
  
  // Canvas elements for processing
  private inputCanvas: HTMLCanvasElement;
  private inputCtx: CanvasRenderingContext2D;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;
  private outputCanvas: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;
  private blurCanvas: HTMLCanvasElement;
  private blurCtx: CanvasRenderingContext2D;
  
  // WebGL context for acceleration
  private glCanvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private glProgram: WebGLProgram | null = null;
  
  // Performance tracking
  private frameCount: number = 0;
  private droppedFrames: number = 0;
  private lastFrameTime: number = 0;
  private processingTimes: number[] = [];
  private fpsHistory: number[] = [];
  
  // Emotion processor for colorization
  private emotionProcessor: EmotionProcessor;
  private currentAuraColor: AuraColor | null = null;

  constructor(config: SegmentationConfig = {}) {
    this.config = {
      modelType: 'general',
      smoothSegmentation: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: false,
      backgroundBlurAmount: 10,
      edgeBlurAmount: 3,
      enableColorization: true,
      enableWebGL: true,
      targetFPS: 30,
      ...config
    };

    // Create canvas elements
    this.inputCanvas = document.createElement('canvas');
    this.inputCtx = this.inputCanvas.getContext('2d', { willReadFrequently: true })!;
    
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true })!;
    
    this.outputCanvas = document.createElement('canvas');
    this.outputCtx = this.outputCanvas.getContext('2d', { willReadFrequently: true })!;
    
    this.blurCanvas = document.createElement('canvas');
    this.blurCtx = this.blurCanvas.getContext('2d', { willReadFrequently: true })!;

    this.emotionProcessor = new EmotionProcessor();

    if (this.config.enableWebGL) {
      this.initializeWebGL();
    }
  }

  /**
   * Initialize the segmentation model
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Dynamically import TensorFlow.js and MediaPipe
      const tf = await import('@tensorflow/tfjs');
      const bodySegmentation = await import('@tensorflow-models/body-segmentation');
      
      // Set WebGL backend if enabled
      if (this.config.enableWebGL) {
        await tf.setBackend('webgl');
      }

      // Create segmentation model
      const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
      const segmenterConfig = {
        runtime: 'tfjs' as const,
        modelType: this.config.modelType as 'general' | 'landscape',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',
      };

      this.segmentationModel = await bodySegmentation.createSegmenter(model, segmenterConfig);
      this.isInitialized = true;
      
      console.log('Person segmentation initialized successfully');
    } catch (error) {
      console.error('Failed to initialize person segmentation:', error);
      throw error;
    }
  }

  /**
   * Initialize WebGL for hardware acceleration
   */
  private initializeWebGL(): void {
    try {
      this.glCanvas = document.createElement('canvas');
      this.gl = this.glCanvas.getContext('webgl', {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        antialias: false,
        depth: false,
        stencil: false,
        failIfMajorPerformanceCaveat: false
      }) as WebGLRenderingContext;

      if (!this.gl) {
        console.warn('WebGL not available, falling back to Canvas 2D');
        this.config.enableWebGL = false;
        return;
      }

      // Create shader program for effects
      this.glProgram = this.createShaderProgram();
      
      console.log('WebGL initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize WebGL:', error);
      this.config.enableWebGL = false;
    }
  }

  /**
   * Create WebGL shader program for effects
   */
  private createShaderProgram(): WebGLProgram | null {
    if (!this.gl) return null;

    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_image;
      uniform sampler2D u_mask;
      uniform vec3 u_auraColor;
      uniform float u_auraIntensity;
      uniform float u_blurAmount;
      uniform float u_time;
      
      varying vec2 v_texCoord;
      
      vec4 blur(sampler2D image, vec2 uv, float amount) {
        vec4 color = vec4(0.0);
        float total = 0.0;
        
        for (float x = -4.0; x <= 4.0; x += 1.0) {
          for (float y = -4.0; y <= 4.0; y += 1.0) {
            float weight = exp(-(x*x + y*y) / (2.0 * amount * amount));
            vec2 offset = vec2(x, y) / vec2(textureSize(image, 0));
            color += texture2D(image, uv + offset) * weight;
            total += weight;
          }
        }
        
        return color / total;
      }
      
      void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        float mask = texture2D(u_mask, v_texCoord).r;
        
        // Apply background blur
        vec4 blurred = blur(u_image, v_texCoord, u_blurAmount);
        
        // Mix original and blurred based on mask
        vec4 result = mix(blurred, color, mask);
        
        // Add aura effect for person
        if (mask > 0.5) {
          float pulse = sin(u_time * 3.0) * 0.5 + 0.5;
          vec3 aura = u_auraColor * u_auraIntensity * pulse;
          result.rgb = mix(result.rgb, result.rgb + aura, mask * 0.3);
        }
        
        gl_FragColor = result;
      }
    `;

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Failed to link shader program');
      return null;
    }

    return program;
  }

  /**
   * Compile a WebGL shader
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
   * Process a video frame for segmentation
   */
  public async processFrame(
    source: HTMLVideoElement | HTMLCanvasElement | ImageData,
    emotionData?: EmotionData
  ): Promise<SegmentationResult> {
    if (!this.isInitialized || this.isProcessing) {
      throw new Error('Segmentation not ready');
    }

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      // Update canvas sizes if needed
      const width = source instanceof ImageData ? source.width : source.width;
      const height = source instanceof ImageData ? source.height : source.height;
      
      if (this.inputCanvas.width !== width || this.inputCanvas.height !== height) {
        this.resizeCanvases(width, height);
      }

      // Draw source to input canvas
      if (source instanceof ImageData) {
        this.inputCtx.putImageData(source, 0, 0);
      } else {
        this.inputCtx.drawImage(source, 0, 0);
      }

      // Perform segmentation
      const segmentation = await this.segmentationModel.segmentPeople(this.inputCanvas, {
        flipHorizontal: this.config.selfieMode,
        multiSegmentation: false,
        segmentBodyParts: false,
        segmentationThreshold: this.config.minDetectionConfidence
      });

      if (segmentation.length === 0) {
        // No person detected
        this.isProcessing = false;
        return {
          mask: this.maskCanvas,
          confidence: 0,
          processingTime: performance.now() - startTime,
          fps: this.calculateFPS()
        };
      }

      // Get segmentation mask
      const mask = segmentation[0].mask;
      
      // Update aura color based on emotions
      if (emotionData && this.config.enableColorization) {
        this.currentAuraColor = this.emotionProcessor.emotionToAura(emotionData);
      }

      // Apply effects
      let result: HTMLCanvasElement;
      if (this.config.enableWebGL && this.gl && this.glProgram) {
        result = await this.applyWebGLEffects(this.inputCanvas, mask as ImageData);
      } else {
        result = await this.applyCanvas2DEffects(this.inputCanvas, mask as ImageData);
      }

      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);

      this.isProcessing = false;

      return {
        mask: result,
        confidence: 1.0,
        processingTime,
        fps: this.calculateFPS()
      };
    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }

  /**
   * Apply effects using WebGL
   */
  private async applyWebGLEffects(
    image: HTMLCanvasElement,
    mask: ImageData
  ): Promise<HTMLCanvasElement> {
    if (!this.gl || !this.glProgram || !this.glCanvas) {
      return this.applyCanvas2DEffects(image, mask);
    }

    // Set up WebGL context
    this.gl.useProgram(this.glProgram);
    this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);

    // Create textures
    const imageTexture = this.createTexture(image);
    const maskTexture = this.createTexture(mask);

    // Set uniforms
    const auraColor = this.currentAuraColor || { primary: '#ffffff', intensity: 0 };
    const rgb = this.hexToRgb(auraColor.primary);
    
    this.gl.uniform1i(this.gl.getUniformLocation(this.glProgram, 'u_image'), 0);
    this.gl.uniform1i(this.gl.getUniformLocation(this.glProgram, 'u_mask'), 1);
    this.gl.uniform3f(this.gl.getUniformLocation(this.glProgram, 'u_auraColor'), rgb.r / 255, rgb.g / 255, rgb.b / 255);
    this.gl.uniform1f(this.gl.getUniformLocation(this.glProgram, 'u_auraIntensity'), auraColor.intensity);
    this.gl.uniform1f(this.gl.getUniformLocation(this.glProgram, 'u_blurAmount'), this.config.backgroundBlurAmount);
    this.gl.uniform1f(this.gl.getUniformLocation(this.glProgram, 'u_time'), performance.now() / 1000);

    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, imageTexture);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, maskTexture);

    // Draw
    this.drawQuad();

    // Copy result to output canvas
    this.outputCtx.drawImage(this.glCanvas, 0, 0);
    
    // Clean up textures
    this.gl.deleteTexture(imageTexture);
    this.gl.deleteTexture(maskTexture);

    return this.outputCanvas;
  }

  /**
   * Apply effects using Canvas 2D API
   */
  private async applyCanvas2DEffects(
    image: HTMLCanvasElement,
    mask: ImageData
  ): Promise<HTMLCanvasElement> {
    // Draw original image
    this.outputCtx.drawImage(image, 0, 0);
    
    // Apply background blur
    if (this.config.backgroundBlurAmount > 0) {
      // Create blurred version
      this.blurCtx.filter = `blur(${this.config.backgroundBlurAmount}px)`;
      this.blurCtx.drawImage(image, 0, 0);
      
      // Draw mask to mask canvas
      this.maskCtx.putImageData(mask, 0, 0);
      
      // Composite: draw blurred background where mask is transparent
      this.outputCtx.globalCompositeOperation = 'destination-over';
      this.outputCtx.drawImage(this.blurCanvas, 0, 0);
      
      // Restore composite operation
      this.outputCtx.globalCompositeOperation = 'source-over';
    }

    // Apply emotion-based colorization
    if (this.config.enableColorization && this.currentAuraColor) {
      const imageData = this.outputCtx.getImageData(0, 0, this.outputCanvas.width, this.outputCanvas.height);
      const pixels = imageData.data;
      const maskData = mask.data;
      
      const rgb = this.hexToRgb(this.currentAuraColor.primary);
      const intensity = this.currentAuraColor.intensity * 0.3;
      
      for (let i = 0; i < pixels.length; i += 4) {
        const maskValue = maskData[i] / 255;
        if (maskValue > 0.5) {
          // Apply aura color to person pixels
          pixels[i] = Math.min(255, pixels[i] + rgb.r * intensity * maskValue);
          pixels[i + 1] = Math.min(255, pixels[i + 1] + rgb.g * intensity * maskValue);
          pixels[i + 2] = Math.min(255, pixels[i + 2] + rgb.b * intensity * maskValue);
        }
      }
      
      this.outputCtx.putImageData(imageData, 0, 0);
    }

    // Apply edge blur for smoother boundaries
    if (this.config.edgeBlurAmount > 0) {
      this.outputCtx.filter = `blur(${this.config.edgeBlurAmount}px)`;
      // Apply only to edges by using mask
      // This is a simplified approach
    }

    return this.outputCanvas;
  }

  /**
   * Create WebGL texture from source
   */
  private createTexture(source: HTMLCanvasElement | ImageData): WebGLTexture | null {
    if (!this.gl) return null;

    const texture = this.gl.createTexture();
    if (!texture) return null;

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    
    if (source instanceof ImageData) {
      this.gl.texImage2D(
        this.gl.TEXTURE_2D, 0, this.gl.RGBA,
        source.width, source.height, 0,
        this.gl.RGBA, this.gl.UNSIGNED_BYTE, source.data
      );
    } else {
      this.gl.texImage2D(
        this.gl.TEXTURE_2D, 0, this.gl.RGBA,
        this.gl.RGBA, this.gl.UNSIGNED_BYTE, source
      );
    }

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    return texture;
  }

  /**
   * Draw a full-screen quad in WebGL
   */
  private drawQuad(): void {
    if (!this.gl || !this.glProgram) return;

    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]);

    // Set up position attribute
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    
    const positionLocation = this.gl.getAttribLocation(this.glProgram, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Set up texture coordinate attribute
    const texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
    
    const texCoordLocation = this.gl.getAttribLocation(this.glProgram, 'a_texCoord');
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Resize all canvases
   */
  private resizeCanvases(width: number, height: number): void {
    this.inputCanvas.width = width;
    this.inputCanvas.height = height;
    
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
    
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    
    this.blurCanvas.width = width;
    this.blurCanvas.height = height;

    if (this.glCanvas) {
      this.glCanvas.width = width;
      this.glCanvas.height = height;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    this.frameCount++;
    this.processingTimes.push(processingTime);
    
    // Keep only last 30 samples
    if (this.processingTimes.length > 30) {
      this.processingTimes.shift();
    }

    // Check for dropped frames
    const targetFrameTime = 1000 / this.config.targetFPS;
    if (processingTime > targetFrameTime) {
      this.droppedFrames++;
    }
  }

  /**
   * Calculate current FPS
   */
  private calculateFPS(): number {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    
    if (deltaTime > 0) {
      const fps = 1000 / deltaTime;
      this.fpsHistory.push(fps);
      
      if (this.fpsHistory.length > 30) {
        this.fpsHistory.shift();
      }
    }
    
    this.lastFrameTime = now;
    
    // Return average FPS
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return {
      averageFPS: this.calculateFPS(),
      averageProcessingTime,
      frameCount: this.frameCount,
      droppedFrames: this.droppedFrames
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SegmentationConfig>): void {
    this.config = { ...this.config, ...config };
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
   * Cleanup resources
   */
  public dispose(): void {
    this.isProcessing = false;
    this.isInitialized = false;
    
    if (this.segmentationModel) {
      this.segmentationModel.dispose();
      this.segmentationModel = null;
    }

    if (this.gl) {
      if (this.glProgram) {
        this.gl.deleteProgram(this.glProgram);
      }
      this.gl = null;
    }

    // Clear performance metrics
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.processingTimes = [];
    this.fpsHistory = [];
  }
}

/**
 * Create a person segmentation instance
 */
export function createPersonSegmentation(config?: SegmentationConfig): PersonSegmentation {
  return new PersonSegmentation(config);
}