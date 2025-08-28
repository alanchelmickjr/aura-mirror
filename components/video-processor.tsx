'use client';

/**
 * Video Processor Component
 * Manages camera access, applies person segmentation, and overlays emotion-based effects
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { FacialAnalyzer, FaceDetectionResult, drawFaceDetections } from '@/lib/video/facial-analyzer';
import { PersonSegmentation, SegmentationResult, PerformanceMetrics } from '@/lib/video/person-segmentation';
import { EmotionData, FacialExpression, AuraColor } from '@/lib/hume/types';
import { HumeWebSocketManager } from '@/lib/hume/websocket-manager';
import { EmotionProcessor } from '@/lib/hume/emotion-processor';

interface VideoProcessorProps {
  wsManager?: HumeWebSocketManager;
  apiKey?: string;
  onEmotionUpdate?: (emotions: EmotionData) => void;
  onFacesDetected?: (faces: FaceDetectionResult[]) => void;
  enableFacialAnalysis?: boolean;
  enableSegmentation?: boolean;
  enableEffects?: boolean;
  showDebugInfo?: boolean;
  className?: string;
}

interface ProcessingState {
  isInitialized: boolean;
  isProcessing: boolean;
  isCameraActive: boolean;
  error: string | null;
  performance: PerformanceMetrics | null;
}

interface EmotionDisplay {
  name: string;
  score: number;
  color: string;
}

export function VideoProcessor({
  wsManager,
  apiKey,
  onEmotionUpdate,
  onFacesDetected,
  enableFacialAnalysis = true,
  enableSegmentation = true,
  enableEffects = true,
  showDebugInfo = false,
  className = ''
}: VideoProcessorProps) {
  // Refs for video and canvas elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Processing modules
  const facialAnalyzerRef = useRef<FacialAnalyzer | null>(null);
  const segmentationRef = useRef<PersonSegmentation | null>(null);
  const emotionProcessorRef = useRef<EmotionProcessor>(new EmotionProcessor());

  // State
  const [state, setState] = useState<ProcessingState>({
    isInitialized: false,
    isProcessing: false,
    isCameraActive: false,
    error: null,
    performance: null
  });

  const [currentEmotions, setCurrentEmotions] = useState<EmotionDisplay[]>([]);
  const [dominantEmotion, setDominantEmotion] = useState<string>('neutral');
  const [auraColor, setAuraColor] = useState<AuraColor | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<FaceDetectionResult[]>([]);

  /**
   * Initialize camera and processing modules
   */
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      streamRef.current = stream;

      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(undefined);
          }
        });

        // Set canvas sizes
        if (canvasRef.current && videoRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }

        if (overlayCanvasRef.current && videoRef.current) {
          overlayCanvasRef.current.width = videoRef.current.videoWidth;
          overlayCanvasRef.current.height = videoRef.current.videoHeight;
        }
      }

      // Initialize facial analyzer
      if (enableFacialAnalysis && (apiKey || wsManager)) {
        facialAnalyzerRef.current = new FacialAnalyzer({
          apiKey: apiKey || '',
          frameRate: 10,
          maxFaces: 5,
          minConfidence: 0.5,
          enableLandmarks: true,
          enableHeadPose: true,
          enableGaze: true
        });

        if (videoRef.current) {
          await facialAnalyzerRef.current.initialize(videoRef.current, wsManager);
        }
      }

      // Initialize person segmentation
      if (enableSegmentation) {
        segmentationRef.current = new PersonSegmentation({
          modelType: 'general',
          smoothSegmentation: true,
          backgroundBlurAmount: 10,
          edgeBlurAmount: 3,
          enableColorization: enableEffects,
          enableWebGL: true,
          targetFPS: 30
        });

        await segmentationRef.current.initialize();
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isCameraActive: true
      }));

    } catch (error) {
      console.error('Failed to initialize video processor:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize'
      }));
    }
  }, [apiKey, wsManager, enableFacialAnalysis, enableSegmentation, enableEffects]);

  /**
   * Start processing video frames
   */
  const startProcessing = useCallback(() => {
    if (!state.isInitialized || state.isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    // Start facial analysis
    if (facialAnalyzerRef.current) {
      facialAnalyzerRef.current.start(
        (faces) => {
          setDetectedFaces(faces);
          if (onFacesDetected) {
            onFacesDetected(faces);
          }
        },
        (emotions) => {
          handleEmotionUpdate(emotions);
        },
        (error) => {
          console.error('Facial analysis error:', error);
        }
      );
    }

    // Start render loop
    const render = async () => {
      if (!state.isProcessing) return;

      try {
        await processFrame();
      } catch (error) {
        console.error('Frame processing error:', error);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, [state.isInitialized, state.isProcessing]);

  /**
   * Process a single video frame
   */
  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Apply person segmentation if enabled
    if (segmentationRef.current && enableSegmentation) {
      try {
        const emotionData: EmotionData = {
          emotions: currentEmotions.map(e => ({ name: e.name, score: e.score })),
          timestamp: Date.now(),
          dominantEmotion,
          confidence: 0.8
        };

        const result = await segmentationRef.current.processFrame(
          videoRef.current,
          emotionData
        );

        // Draw segmented result
        if (result.mask instanceof HTMLCanvasElement) {
          ctx.drawImage(result.mask, 0, 0);
        } else {
          ctx.putImageData(result.mask, 0, 0);
        }

        // Update performance metrics
        if (showDebugInfo) {
          const metrics = segmentationRef.current.getPerformanceMetrics();
          setState(prev => ({ ...prev, performance: metrics }));
        }
      } catch (error) {
        // Fallback to drawing video directly
        ctx.drawImage(videoRef.current, 0, 0);
      }
    } else {
      // Draw video directly
      ctx.drawImage(videoRef.current, 0, 0);
    }

    // Draw overlays
    if (overlayCanvasRef.current) {
      const overlayCtx = overlayCanvasRef.current.getContext('2d');
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        
        // Draw face detection overlays
        if (enableFacialAnalysis && detectedFaces.length > 0) {
          drawFaceDetections(overlayCtx, detectedFaces, {
            drawBoundingBox: showDebugInfo,
            drawLandmarks: showDebugInfo,
            drawEmotions: showDebugInfo,
            boxColor: auraColor?.primary || '#00ff00',
            textColor: '#ffffff',
            fontSize: 16
          });
        }

        // Draw emotion visualization
        if (enableEffects) {
          drawEmotionEffects(overlayCtx);
        }
      }
    }
  };

  /**
   * Handle emotion updates from facial analysis
   */
  const handleEmotionUpdate = (emotions: FacialExpression) => {
    const processedEmotions = emotionProcessorRef.current.processFacialData(emotions);
    
    // Update emotion display
    const topEmotions = processedEmotions.emotions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(e => ({
        name: e.name,
        score: e.score,
        color: getEmotionColor(e.name)
      }));
    
    setCurrentEmotions(topEmotions);
    setDominantEmotion(processedEmotions.dominantEmotion || 'neutral');
    
    // Update aura color
    const newAuraColor = emotionProcessorRef.current.emotionToAura(processedEmotions);
    setAuraColor(newAuraColor);
    
    // Notify parent component
    if (onEmotionUpdate) {
      onEmotionUpdate(processedEmotions);
    }
  };

  /**
   * Draw emotion-based visual effects
   */
  const drawEmotionEffects = (ctx: CanvasRenderingContext2D) => {
    if (!auraColor) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const time = Date.now() / 1000;

    // Create pulsing aura effect around edges
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.3,
      width / 2, height / 2, Math.min(width, height) * 0.5
    );

    const pulseIntensity = (Math.sin(time * (auraColor.pulse_rate || 1)) + 1) / 2;
    const alpha = auraColor.intensity * pulseIntensity * 0.3;

    gradient.addColorStop(0, `${auraColor.primary}00`);
    gradient.addColorStop(0.5, `${auraColor.primary}${Math.floor(alpha * 128).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `${auraColor.secondary}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add particle effects for high-intensity emotions
    if (auraColor.intensity > 0.7) {
      drawParticles(ctx, auraColor, pulseIntensity);
    }
  };

  /**
   * Draw particle effects
   */
  const drawParticles = (ctx: CanvasRenderingContext2D, aura: AuraColor, intensity: number) => {
    const particleCount = Math.floor(intensity * 20);
    const time = Date.now() / 1000;

    ctx.save();
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 0.5;
      const radius = 100 + Math.sin(time * 2 + i) * 50;
      const x = ctx.canvas.width / 2 + Math.cos(angle) * radius;
      const y = ctx.canvas.height / 2 + Math.sin(angle) * radius;
      const size = 2 + Math.sin(time * 3 + i) * 2;
      
      ctx.fillStyle = `${aura.accent || aura.primary}${Math.floor(intensity * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  };

  /**
   * Get color for emotion
   */
  const getEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      joy: '#FFD700',
      sadness: '#4169E1',
      anger: '#DC143C',
      fear: '#8B008B',
      surprise: '#FF69B4',
      disgust: '#228B22',
      contempt: '#8B4513',
      neutral: '#808080'
    };
    return colors[emotion.toLowerCase()] || '#808080';
  };

  /**
   * Stop processing
   */
  const stopProcessing = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: false }));

    if (facialAnalyzerRef.current) {
      facialAnalyzerRef.current.stop();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    stopProcessing();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (facialAnalyzerRef.current) {
      facialAnalyzerRef.current.dispose();
      facialAnalyzerRef.current = null;
    }

    if (segmentationRef.current) {
      segmentationRef.current.dispose();
      segmentationRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isInitialized: false,
      isCameraActive: false
    }));
  }, [stopProcessing]);

  // Initialize on mount
  useEffect(() => {
    initialize();
    return cleanup;
  }, []);

  // Start processing when initialized
  useEffect(() => {
    if (state.isInitialized && !state.isProcessing) {
      startProcessing();
    }
  }, [state.isInitialized, startProcessing]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Video element (hidden) */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />

      {/* Main canvas for processed video */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay canvas for effects and annotations */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Error display */}
      {state.error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{state.error}</p>
        </div>
      )}

      {/* Emotion display */}
      {currentEmotions.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
          <p className="text-sm font-semibold mb-2">Detected Emotions</p>
          <div className="space-y-1">
            {currentEmotions.map((emotion, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: emotion.color }}
                />
                <span className="text-xs capitalize">{emotion.name}</span>
                <span className="text-xs opacity-70">
                  {(emotion.score * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          {dominantEmotion && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-xs">
                Dominant: <span className="font-semibold capitalize">{dominantEmotion}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Performance metrics */}
      {showDebugInfo && state.performance && (
        <div className="absolute top-4 right-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
          <p className="text-sm font-semibold mb-2">Performance</p>
          <div className="space-y-1 text-xs">
            <p>FPS: {state.performance.averageFPS.toFixed(1)}</p>
            <p>Processing: {state.performance.averageProcessingTime.toFixed(1)}ms</p>
            <p>Frames: {state.performance.frameCount}</p>
            <p>Dropped: {state.performance.droppedFrames}</p>
          </div>
        </div>
      )}

      {/* Camera status */}
      {!state.isCameraActive && !state.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p className="text-white">Initializing camera...</p>
          </div>
        </div>
      )}
    </div>
  );
}