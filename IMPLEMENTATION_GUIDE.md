
# Aura Mirror - Technical Implementation Guide 🛠️

## Quick Start

### Prerequisites
- Node.js 18+ 
- Hume AI Account ([Sign up here](https://beta.hume.ai/sign-up))
- API Keys from Hume Dashboard

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd aura-mirror

# Install dependencies
pnpm install

# Add Hume AI packages
pnpm add hume @humeai/voice-react @humeai/voice-embed-react

# Add video processing libraries
pnpm add @tensorflow/tfjs @mediapipe/selfie_segmentation

# Add additional utilities
pnpm add socket.io-client uuid
```

### Environment Setup

Create `.env.local`:
```env
# Hume AI Credentials
HUME_API_KEY=your_api_key_here
HUME_SECRET_KEY=your_secret_key_here
NEXT_PUBLIC_HUME_API_KEY=your_api_key_here
NEXT_PUBLIC_HUME_CONFIG_ID=optional_config_id

# Optional: Development Settings
NEXT_PUBLIC_ENABLE_DEBUG=true
NEXT_PUBLIC_MOCK_MODE=false
```

## Core Implementation

### 1. Hume AI Client Setup

Create `lib/hume/client.ts`:
```typescript
import { HumeClient } from 'hume';

let humeClient: HumeClient | null = null;

export function getHumeClient(): HumeClient {
  if (!humeClient) {
    const apiKey = process.env.HUME_API_KEY || process.env.NEXT_PUBLIC_HUME_API_KEY;
    
    if (!apiKey) {
      throw new Error('Hume API key is not configured');
    }
    
    humeClient = new HumeClient({
      apiKey,
      secretKey: process.env.HUME_SECRET_KEY,
    });
  }
  
  return humeClient;
}

export async function getAccessToken(): Promise<string> {
  const client = getHumeClient();
  const token = await client.getAccessToken();
  return token;
}
```

### 2. WebSocket Connection Manager

Create `lib/hume/websocket-manager.ts`:
```typescript
import { getHumeClient } from './client';

export interface EmotionScore {
  name: string;
  score: number;
}

export interface EmotionFrame {
  face?: {
    emotions: EmotionScore[];
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  prosody?: {
    emotions: EmotionScore[];
  };
  timestamp: number;
}

export class HumeWebSocketManager {
  private socket: any;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private onEmotionCallback?: (frame: EmotionFrame) => void;
  private onStatusCallback?: (status: string) => void;

  async connect() {
    try {
      const client = getHumeClient();
      
      this.socket = await client.expressionMeasurement.stream.connect({
        config: {
          face: {
            fps: 3,
            identifyFaces: false,
            minFaceSize: 0.1,
            probThreshold: 0.1,
          },
          prosody: {
            granularity: 'utterance',
          },
          language: {
            granularity: 'word',
          },
        },
      });

      this.setupEventHandlers();
      this.onStatusCallback?.('connected');
      this.reconnectAttempts = 0;
      
    } catch (error) {
      console.error('Failed to connect to Hume WebSocket:', error);
      this.handleReconnect();
    }
  }

  private setupEventHandlers() {
    this.socket.on('message', (message: any) => {
      this.handleMessage(message);
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.onStatusCallback?.('error');
    });

    this.socket.on('close', () => {
      console.log('WebSocket closed');
      this.onStatusCallback?.('disconnected');
      this.handleReconnect();
    });
  }

  private handleMessage(message: any) {
    const frame: EmotionFrame = {
      timestamp: Date.now(),
    };

    // Process face emotions
    if (message.face && message.face.predictions) {
      const prediction = message.face.predictions[0];
      if (prediction && prediction.emotions) {
        frame.face = {
          emotions: this.processEmotions(prediction.emotions),
          boundingBox: prediction.bbox,
        };
      }
    }

    // Process voice emotions
    if (message.prosody && message.prosody.predictions) {
      const prediction = message.prosody.predictions[0];
      if (prediction && prediction.emotions) {
        frame.prosody = {
          emotions: this.processEmotions(prediction.emotions),
        };
      }
    }

    if (frame.face || frame.prosody) {
      this.onEmotionCallback?.(frame);
    }
  }

  private processEmotions(emotions: any): EmotionScore[] {
    return Object.entries(emotions)
      .map(([name, score]) => ({
        name,
        score: score as number,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 emotions
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.onStatusCallback?.('failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.onStatusCallback?.('reconnecting');
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  async sendVideo(videoData: Blob) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready for video data');
      return;
    }

    const base64 = await this.blobToBase64(videoData);
    this.socket.sendVideo(base64);
  }

  async sendAudio(audioData: Blob) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready for audio data');
      return;
    }

    const base64 = await this.blobToBase64(audioData);
    this.socket.sendAudio(base64);
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  onEmotion(callback: (frame: EmotionFrame) => void) {
    this.onEmotionCallback = callback;
  }

  onStatus(callback: (status: string) => void) {
    this.onStatusCallback = callback;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
```

### 3. EVI Voice Provider Setup

Create `components/providers/voice-provider.tsx`:
```typescript
'use client';

import { VoiceProvider, VoiceReadyState } from '@humeai/voice-react';
import { useCallback, ReactNode } from 'react';
import { toast } from 'sonner';

interface HumeVoiceProviderProps {
  children: ReactNode;
}

export function HumeVoiceProvider({ children }: HumeVoiceProviderProps) {
  const handleError = useCallback((error: any) => {
    console.error('Voice provider error:', error);
    
    if (error.message?.includes('API key')) {
      toast.error('Invalid API key. Please check your configuration.');
    } else if (error.message?.includes('network')) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('Voice connection error. Please try again.');
    }
  }, []);

  const handleStateChange = useCallback((state: VoiceReadyState) => {
    console.log('Voice state changed:', state);
    
    switch (state) {
      case 'connected':
        toast.success('Voice assistant connected');
        break;
      case 'disconnected':
        toast.info('Voice assistant disconnected');
        break;
      case 'error':
        toast.error('Voice connection error');
        break;
    }
  }, []);

  return (
    <VoiceProvider
      auth={{ 
        type: 'apiKey', 
        value: process.env.NEXT_PUBLIC_HUME_API_KEY! 
      }}
      configId={process.env.NEXT_PUBLIC_HUME_CONFIG_ID}
      onError={handleError}
      onStateChange={handleStateChange}
      hostname="api.hume.ai"
      reconnectOnDisconnect={true}
      debug={process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true'}
    >
      {children}
    </VoiceProvider>
  );
}
```

### 4. Voice Interface Component

Create `components/voice/voice-interface.tsx`:
```typescript
'use client';

import { useVoice } from '@humeai/voice-react';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function VoiceInterface() {
  const { 
    connect, 
    disconnect, 
    status,
    messages,
    sendUserInput,
    sendAudioInput,
    isMuted,
    mute,
    unmute,
    micFft,
    audioLevel
  } = useVoice();

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Auto-connect on mount
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        // Send audio to Hume
        const arrayBuffer = await audioBlob.arrayBuffer();
        sendAudioInput(new Uint8Array(arrayBuffer));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Voice Assistant</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            status.value === 'connected' ? 'bg-green-500' : 
            status.value === 'connecting' ? 'bg-yellow-500' : 
            'bg-red-500'
          } animate-pulse`} />
          <span className="text-sm text-muted-foreground">
            {status.value}
          </span>
        </div>
      </div>

      {/* Audio Level Visualizer */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${audioLevel * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          onClick={toggleRecording}
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          className="flex-1"
        >
          {isRecording ? (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Start Recording
            </>
          )}
        </Button>

        <Button
          onClick={toggleMute}
          variant="outline"
          size="lg"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Transcript */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {messages.map((message, index) => (
          <div 
            key={index}
            className={`p-3 rounded-lg ${
              message.role === 'user' 
                ? 'bg-primary/10 ml-auto max-w-[80%]' 
                : 'bg-muted mr-auto max-w-[80%]'
            }`}
          >
            <p className="text-sm">{message.content}</p>
            {message.models?.prosody && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {Object.entries(message.models.prosody.scores || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 3)
                  .map(([emotion, score]) => (
                    <span 
                      key={emotion}
                      className="text-xs bg-background px-2 py-1 rounded-full"
                    >
                      {emotion}: {((score as number) * 100).toFixed(0)}%
                    </span>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

### 5. Video Segmentation Implementation

Create `lib/video/segmentation.ts`:
```typescript
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

export interface SegmentationConfig {
  modelSelection: 0 | 1; // 0: light, 1: full
  smoothing: number; // 0-1
  flipHorizontal: boolean;
}

export class VideoSegmentation {
  private segmenter: SelfieSegmentation | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private outputCanvas: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;
  private isProcessing = false;

  constructor() {
    // Create canvases for processing
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.outputCanvas = document.createElement('canvas');
    this.outputCtx = this.outputCanvas.getContext('2d')!;
  }

  async initialize(config: SegmentationConfig = {
    modelSelection: 0,
    smoothing: 0.7,
    flipHorizontal: true,
  }) {
    // Initialize MediaPipe segmentation
    this.segmenter = new SelfieSegmentation({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      },
    });

    this.segmenter.setOptions({
      modelSelection: config.modelSelection,
      selfieMode: config.flipHorizontal,
    });

    this.segmenter.onResults(this.onSegmentationResults.bind(this));

    // Ensure TensorFlow.js uses WebGL backend
    await tf.setBackend('webgl');
    await tf.ready();
  }

  async processFrame(
    video: HTMLVideoElement,
    emotionColors: string[]
  ): Promise<HTMLCanvasElement> {
    if (!this.segmenter || this.isProcessing) {
      return this.outputCanvas;
    }

    this.isProcessing = true;

    // Set canvas dimensions
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.outputCanvas.width = video.videoWidth;
    this.outputCanvas.height = video.videoHeight;

    // Send frame to segmenter
    await this.segmenter.send({ image: video });

    this.isProcessing = false;
    return this.outputCanvas;
  }

  private onSegmentationResults(results: any) {
    const { segmentationMask, image } = results;

    // Save current context state
    this.outputCtx.save();

    // Clear canvas
    this.outputCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    // Draw blurred background
    this.outputCtx.filter = 'blur(16px) brightness(0.7)';
    this.outputCtx.globalCompositeOperation = 'source-over';
    this.outputCtx.drawImage(image, 0, 0);

    // Apply emotion-based color overlay to background
    this.outputCtx.globalCompositeOperation = 'overlay';
    const gradient = this.outputCtx.createRadialGradient(
      this.outputCanvas.width / 2,
      this.outputCanvas.height / 2,
      0,
      this.outputCanvas.width / 2,
      this.outputCanvas.height / 2,
      Math.max(this.outputCanvas.width, this.outputCanvas.height) / 2
    );
    
    // Use emotion colors for gradient
    const emotionColor = this.getCurrentEmotionColor();
    gradient.addColorStop(0, emotionColor + '40');
    gradient.addColorStop(1, emotionColor + '00');
    
    this.outputCtx.fillStyle = gradient;
    this.outputCtx.fillRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    // Reset composite operation and filter
    this.outputCtx.globalCompositeOperation = 'source-over';
    this.outputCtx.filter = 'none';

    // Draw person (foreground) using mask
    this.outputCtx.globalCompositeOperation = 'source-over';
    
    // Create temporary canvas for masking
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.outputCanvas.width;
    tempCanvas.height = this.outputCanvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Draw original image
    tempCtx.drawImage(image, 0, 0);

    // Apply mask
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(segmentationMask, 0, 0);

    // Draw masked person on output
    this.outputCtx.drawImage(tempCanvas, 0, 0);

    // Add subtle glow around person
    this.outputCtx.shadowColor = this.getCurrentEmotionColor();
    this.outputCtx.shadowBlur = 20;
    this.outputCtx.globalCompositeOperation = 'screen';
    this.outputCtx.drawImage(tempCanvas, 0, 0);

    // Restore context state
    this.outputCtx.restore();
  }

  private getCurrentEmotionColor(): string {
    // This should be connected to actual emotion data
    // For now, return a default color
    return '#6366f1';
  }

  setEmotionColor(color: string) {
    // Store emotion color for use in processing
    this.emotionColor = color;
  }

  private emotionColor = '#6366f1';

  destroy() {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
  }
}
```

### 6. Main Hook Integration

Create `hooks/use-aura-mirror.ts`:
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { HumeWebSocketManager, EmotionFrame } from '@/lib/hume/websocket-manager';
import { VideoSegmentation } from '@/lib/video/segmentation';
import { useVoice } from '@humeai/voice-react';

interface AuraState {
  primaryEmotion: string;
  intensity: number;
  colors: string[];
  particles: Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
  }>;
}

const EMOTION_COLORS: Record<string, string> = {
  joy: '#fbbf24',
  excitement: '#f97316',
  love: '#ec4899',
  awe: '#8b5cf6',
  calmness: '#06b6d4',
  contentment: '#10b981',
  surprise: '#f59e0b',
  fear: '#6b7280',
  anger: '#ef4444',
  sadness: '#3b82f6',
  disgust: '#84cc16',
  neutral: '#6366f1',
};

export function useAuraMirror() {
  const [isActive, setIsActive] = useState(false);
  const [auraState, setAuraState] = useState<AuraState>({
    primaryEmotion: 'neutral',
    intensity: 0.5,
    colors: ['#10b981', '#6366f1'],
    particles: [],
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsManagerRef = useRef<HumeWebSocketManager | null>(null);
  const segmentationRef = useRef<VideoSegmentation | null>(null);
  const animationFrameRef = useRef<number>();

  // Voice integration
  const { messages, status: voiceStatus } = useVoice();

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      return true;
    } catch (error) {
      console.error('Failed to access camera:', error);
      return false;
    }
  }, []);

  // Initialize Hume WebSocket
  const initializeHume = useCallback(async () => {
    if (!wsManagerRef.current) {
      wsManagerRef.current = new HumeWebSocketManager();
      
      wsManagerRef.current.onEmotion((frame: EmotionFrame) => {
        updateAuraFromEmotions(frame);
      });

      wsManagerRef.current.onStatus((status: string) => {
        setConnectionStatus(status);
      });
    }

    await wsManagerRef.current.connect();
  }, []);

  // Initialize video segmentation
  const initializeSegmentation = useCallback(async () => {
    if (!segmentationRef.current) {
      segmentationRef.current = new VideoSegmentation();
      await segmentationRef.current.initialize({
        modelSelection: 0, // Light model for better performance
        smoothing: 0.7,
        flipHorizontal: true,
      });
    }
  }, []);

  // Update aura based on emotions
  const updateAuraFromEmotions = useCallback((frame: EmotionFrame) => {
    const emotions = frame.face?.emotions || frame.prosody?.emotions || [];
    
    if (emotions.length === 0) return;

    const primary = emotions[0];
    const intensity = primary.score;
    const colors = emotions
      .slice(0, 3)
      .map(e => EMOTION_COLORS[e.name] || EMOTION_COLORS.neutral);

    // Generate particles
    const particles = Array.from({ length: Math.floor(intensity * 20) }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setAuraState({
      primaryEmotion: primary.name,
      intensity,
      colors,
      particles,
    });

    // Update segmentation color
    if (segmentationRef.current) {
      segmentationRef.current.setEmotionColor(colors[0]);
    }
  }, []);

  // Process video frame
  const processVideoFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !segmentationRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // Process frame with segmentation
      const processedCanvas = await segmentationRef.current.processFrame(
        video,
        auraState.colors
      );

      // Draw to main canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(processedCanvas, 0, 0, canvas.width, canvas.height);
      }

      // Send frame to Hume for emotion detection
      if (wsManagerRef.current && animationFrameRef.current % 10 === 0) {
        canvas.toBlob((blob) => {
          if (blob) {
            wsManagerRef.current?.sendVideo(blob);
          }
        }, 'image/jpeg', 0.8);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processVideoFrame);
  }, [auraState.colors]);

  // Initialize everything
  useEffect(() => {
    const initialize = async () => {
      const cameraReady = await initializeCamera();
      if (cameraReady) {
        await initializeHume();
        await initializeSegmentation();
        processVideoFrame();
      }
    };

    initialize();

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      wsManagerRef.current?.disconnect();
      segmentationRef.current?.destroy();
      
      // Stop camera
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    isActive,
    auraState,
    connectionStatus,
    voiceMessages: messages,
    voiceStatus,
  };
}
```

### 7. Updated Main Page Component

Create `app/page.tsx`:
```typescript
'use client';

import { useAuraMirror } from '@/hooks/use-aura-mirror';
import { VoiceInterface } from '@/components/voice/voice-interface';
import { Card } from '@/components/ui/card';
import { HumeVoiceProvider } from '@/components/providers/voice-provider';

function AuraMirrorContent() {
  const {
    videoRef,
    canvasRef,
    isActive,
    auraState,
    connectionStatus,
    voiceMessages,
    voiceStatus,
  } = useAuraMirror();

  const getMirrorMessage = (emotion: string): string => {
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
    };
    
    return messages[emotion] || "Your unique essence is beautiful! ✨";
  };

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
              animationDe