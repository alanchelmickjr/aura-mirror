'use client';

/**
 * Custom Hook for Facial Emotion Tracking
 * Connects to facial analyzer and provides real-time emotion updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FacialAnalyzer, FaceDetectionResult } from '@/lib/video/facial-analyzer';
import { 
  EmotionData, 
  EmotionScore, 
  FacialExpression,
  EmotionStatistics,
  EmotionHistory,
  AuraColor 
} from '@/lib/hume/types';
import { EmotionProcessor } from '@/lib/hume/emotion-processor';
import { HumeWebSocketManager } from '@/lib/hume/websocket-manager';

export interface FacialEmotionState {
  // Current emotion data
  currentEmotions: EmotionScore[];
  dominantEmotion: string | null;
  emotionConfidence: number;
  auraColor: AuraColor | null;
  
  // Face detection data
  detectedFaces: FaceDetectionResult[];
  faceCount: number;
  
  // Historical data
  emotionHistory: EmotionHistory | null;
  emotionStatistics: EmotionStatistics | null;
  emotionTrends: EmotionTrend[];
  
  // Status
  isInitialized: boolean;
  isTracking: boolean;
  isCameraActive: boolean;
  hasPermission: boolean;
  error: string | null;
}

export interface EmotionTrend {
  emotion: string;
  trend: 'rising' | 'falling' | 'stable';
  changeRate: number; // Rate of change per second
  currentValue: number;
  previousValue: number;
}

export interface UseFacialEmotionsConfig {
  apiKey?: string;
  wsManager?: HumeWebSocketManager;
  videoElement?: HTMLVideoElement | null;
  autoStart?: boolean;
  frameRate?: number;
  maxFaces?: number;
  minConfidence?: number;
  historySize?: number;
  trendWindow?: number; // Time window for trend calculation in ms
  smoothingFactor?: number;
  onEmotionChange?: (emotions: EmotionData) => void;
  onFaceDetected?: (faces: FaceDetectionResult[]) => void;
  onError?: (error: Error) => void;
}

export function useFacialEmotions(config: UseFacialEmotionsConfig = {}) {
  const {
    apiKey,
    wsManager,
    videoElement,
    autoStart = true,
    frameRate = 10,
    maxFaces = 5,
    minConfidence = 0.5,
    historySize = 100,
    trendWindow = 5000,
    smoothingFactor = 0.3,
    onEmotionChange,
    onFaceDetected,
    onError
  } = config;

  // State
  const [state, setState] = useState<FacialEmotionState>({
    currentEmotions: [],
    dominantEmotion: null,
    emotionConfidence: 0,
    auraColor: null,
    detectedFaces: [],
    faceCount: 0,
    emotionHistory: null,
    emotionStatistics: null,
    emotionTrends: [],
    isInitialized: false,
    isTracking: false,
    isCameraActive: false,
    hasPermission: false,
    error: null
  });

  // Refs
  const facialAnalyzerRef = useRef<FacialAnalyzer | null>(null);
  const emotionProcessorRef = useRef<EmotionProcessor>(new EmotionProcessor(historySize, trendWindow));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trendHistoryRef = useRef<Map<string, number[]>>(new Map());
  const lastTrendUpdateRef = useRef<number>(0);

  /**
   * Request camera permission
   */
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check if permission API is available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        if (permission.state === 'denied') {
          setState(prev => ({
            ...prev,
            hasPermission: false,
            error: 'Camera permission denied'
          }));
          return false;
        }
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      
      setState(prev => ({
        ...prev,
        hasPermission: true,
        isCameraActive: true,
        error: null
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access camera';
      setState(prev => ({
        ...prev,
        hasPermission: false,
        error: errorMessage
      }));
      
      if (onError) {
        onError(error as Error);
      }
      
      return false;
    }
  }, [onError]);

  /**
   * Initialize facial analyzer
   */
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;

    try {
      // Request camera permission if needed
      if (!state.hasPermission) {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) return;
      }

      // Use provided video element or create one
      let video = videoElement || videoRef.current;
      
      if (!video) {
        video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        videoRef.current = video;
      }

      // Set video source
      if (streamRef.current && video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
        await video.play();
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          video!.onloadedmetadata = () => resolve(undefined);
        });
      }

      // Create facial analyzer
      if (!facialAnalyzerRef.current && (apiKey || wsManager)) {
        facialAnalyzerRef.current = new FacialAnalyzer({
          apiKey: apiKey || '',
          frameRate,
          maxFaces,
          minConfidence,
          enableLandmarks: true,
          enableHeadPose: true,
          enableGaze: true,
          smoothingFactor
        });

        await facialAnalyzerRef.current.initialize(video, wsManager);
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize';
      setState(prev => ({
        ...prev,
        isInitialized: false,
        error: errorMessage
      }));
      
      if (onError) {
        onError(error as Error);
      }
    }
  }, [
    state.isInitialized,
    state.hasPermission,
    videoElement,
    apiKey,
    wsManager,
    frameRate,
    maxFaces,
    minConfidence,
    smoothingFactor,
    requestCameraPermission,
    onError
  ]);

  /**
   * Start tracking emotions
   */
  const startTracking = useCallback(() => {
    if (!state.isInitialized || state.isTracking || !facialAnalyzerRef.current) {
      return;
    }

    facialAnalyzerRef.current.start(
      // On faces detected
      (faces) => {
        setState(prev => ({
          ...prev,
          detectedFaces: faces,
          faceCount: faces.length
        }));
        
        if (onFaceDetected) {
          onFaceDetected(faces);
        }
      },
      // On emotion update
      (facialExpression) => {
        handleEmotionUpdate(facialExpression);
      },
      // On error
      (error) => {
        setState(prev => ({
          ...prev,
          error: error.message
        }));
        
        if (onError) {
          onError(error);
        }
      }
    );

    setState(prev => ({
      ...prev,
      isTracking: true
    }));
  }, [state.isInitialized, state.isTracking, onFaceDetected, onError]);

  /**
   * Stop tracking emotions
   */
  const stopTracking = useCallback(() => {
    if (facialAnalyzerRef.current) {
      facialAnalyzerRef.current.stop();
    }

    setState(prev => ({
      ...prev,
      isTracking: false
    }));
  }, []);

  /**
   * Handle emotion updates
   */
  const handleEmotionUpdate = useCallback((facialExpression: FacialExpression) => {
    const emotionData = emotionProcessorRef.current.processFacialData(facialExpression);
    const auraColor = emotionProcessorRef.current.emotionToAura(emotionData);
    const statistics = emotionProcessorRef.current.getStatistics();
    const history = emotionProcessorRef.current.getHistory();
    
    // Calculate emotion trends
    const trends = calculateEmotionTrends(emotionData.emotions);
    
    setState(prev => ({
      ...prev,
      currentEmotions: emotionData.emotions,
      dominantEmotion: emotionData.dominantEmotion || null,
      emotionConfidence: emotionData.confidence || 0,
      auraColor,
      emotionHistory: history,
      emotionStatistics: statistics,
      emotionTrends: trends
    }));
    
    if (onEmotionChange) {
      onEmotionChange(emotionData);
    }
  }, [onEmotionChange]);

  /**
   * Calculate emotion trends
   */
  const calculateEmotionTrends = useCallback((emotions: EmotionScore[]): EmotionTrend[] => {
    const now = Date.now();
    const trends: EmotionTrend[] = [];
    
    // Update trend history
    emotions.forEach(emotion => {
      const history = trendHistoryRef.current.get(emotion.name) || [];
      history.push(emotion.score);
      
      // Keep only recent history within trend window
      const cutoffIndex = history.findIndex((_, index) => 
        now - lastTrendUpdateRef.current < trendWindow
      );
      
      if (cutoffIndex > 0) {
        history.splice(0, cutoffIndex);
      }
      
      // Limit history size
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }
      
      trendHistoryRef.current.set(emotion.name, history);
      
      // Calculate trend
      if (history.length >= 2) {
        const currentValue = history[history.length - 1];
        const previousValue = history[history.length - 2];
        const avgValue = history.reduce((a, b) => a + b, 0) / history.length;
        
        const changeRate = (currentValue - previousValue) * frameRate; // Change per second
        
        let trend: 'rising' | 'falling' | 'stable';
        if (Math.abs(changeRate) < 0.01) {
          trend = 'stable';
        } else if (changeRate > 0) {
          trend = 'rising';
        } else {
          trend = 'falling';
        }
        
        trends.push({
          emotion: emotion.name,
          trend,
          changeRate,
          currentValue,
          previousValue
        });
      }
    });
    
    lastTrendUpdateRef.current = now;
    return trends;
  }, [frameRate, trendWindow]);

  /**
   * Reset emotion history
   */
  const resetHistory = useCallback(() => {
    emotionProcessorRef.current.clearHistory();
    trendHistoryRef.current.clear();
    
    setState(prev => ({
      ...prev,
      emotionHistory: null,
      emotionStatistics: null,
      emotionTrends: []
    }));
  }, []);

  /**
   * Get top emotions
   */
  const getTopEmotions = useCallback((count: number = 5): EmotionScore[] => {
    return [...state.currentEmotions]
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }, [state.currentEmotions]);

  /**
   * Get emotion by name
   */
  const getEmotionScore = useCallback((emotionName: string): number => {
    const emotion = state.currentEmotions.find(
      e => e.name.toLowerCase() === emotionName.toLowerCase()
    );
    return emotion?.score || 0;
  }, [state.currentEmotions]);

  /**
   * Check if emotion is dominant
   */
  const isEmotionDominant = useCallback((emotionName: string): boolean => {
    return state.dominantEmotion?.toLowerCase() === emotionName.toLowerCase();
  }, [state.dominantEmotion]);

  /**
   * Get emotion trend
   */
  const getEmotionTrend = useCallback((emotionName: string): EmotionTrend | null => {
    return state.emotionTrends.find(
      t => t.emotion.toLowerCase() === emotionName.toLowerCase()
    ) || null;
  }, [state.emotionTrends]);

  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    stopTracking();
    
    if (facialAnalyzerRef.current) {
      facialAnalyzerRef.current.dispose();
      facialAnalyzerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isInitialized: false,
      isCameraActive: false,
      hasPermission: false
    }));
  }, [stopTracking]);

  // Auto-initialize if configured
  useEffect(() => {
    if (autoStart && !state.isInitialized) {
      initialize();
    }
  }, [autoStart, state.isInitialized, initialize]);

  // Auto-start tracking when initialized
  useEffect(() => {
    if (autoStart && state.isInitialized && !state.isTracking) {
      startTracking();
    }
  }, [autoStart, state.isInitialized, state.isTracking, startTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  return {
    // State
    ...state,
    
    // Compatibility aliases
    emotions: state.currentEmotions,
    isProcessing: state.isTracking,
    
    // Actions
    initialize,
    startTracking,
    stopTracking,
    requestCameraPermission,
    resetHistory,
    cleanup,
    
    // Utilities
    getTopEmotions,
    getEmotionScore,
    isEmotionDominant,
    getEmotionTrend
  };
}