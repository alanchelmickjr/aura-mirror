'use client';

/**
 * Custom React Hook for Wake Word Detection
 * Manages "Mirror Mirror on the Wall" wake word detection
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  WakeWordDetector,
  WakeWordConfig,
  WakeWordState,
  WakeWordDetectionResult,
  WakeWordCallbacks,
  createWakeWordDetector,
} from '@/lib/wake-word/detector';

export interface UseWakeWordOptions extends Partial<WakeWordConfig> {
  // Auto-start listening on mount
  autoStart?: boolean;
  
  // Trigger conversation start when wake word detected
  onWakeWordDetected?: (result: WakeWordDetectionResult) => void;
  
  // State change callback
  onStateChange?: (state: WakeWordState) => void;
  
  // Error callback
  onError?: (error: Error) => void;
  
  // Speech callbacks
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  
  // Partial result callback
  onPartialResult?: (transcript: string) => void;
  
  // Visual feedback options
  showVisualFeedback?: boolean;
  visualFeedbackDuration?: number;
  
  // Audio feedback options
  playSound?: boolean;
  soundUrl?: string;
  soundVolume?: number;
  
  // Detection settings
  cooldownPeriod?: number;
  fuzzyMatchThreshold?: number;
  
  // Alternative wake phrases
  alternativePhrases?: string[];
}

export interface UseWakeWordReturn {
  // State
  isListening: boolean;
  state: WakeWordState;
  lastDetection: WakeWordDetectionResult | null;
  detectionCount: number;
  error: Error | null;
  detected: boolean; // Added for compatibility
  
  // Visual feedback state
  showVisualFeedback: boolean;
  
  // Partial transcript
  partialTranscript: string;
  
  // Browser support
  isSupported: boolean;
  permissionStatus: PermissionState | null;
  
  // Actions
  start: () => Promise<void>;
  stop: () => void;
  restart: () => Promise<void>;
  reset: () => void;
  
  // Configuration
  updateConfig: (config: Partial<WakeWordConfig>) => void;
  
  // Utilities
  checkPermission: () => Promise<PermissionState>;
  requestPermission: () => Promise<void>;
}

/**
 * Custom hook for wake word detection
 */
export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const {
    autoStart = false,
    onWakeWordDetected,
    onStateChange,
    onError,
    onSpeechStart,
    onSpeechEnd,
    onPartialResult,
    showVisualFeedback: enableVisualFeedback = true,
    visualFeedbackDuration = 2000,
    playSound = true,
    soundUrl = '/sounds/wake-detected.mp3',
    soundVolume = 0.5,
    cooldownPeriod = 3000,
    fuzzyMatchThreshold = 0.7,
    alternativePhrases = [
      'mirror mirror',
      'hey mirror',
      'ok mirror',
      'mirror on the wall',
    ],
    ...configOptions
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [state, setState] = useState<WakeWordState>('idle');
  const [lastDetection, setLastDetection] = useState<WakeWordDetectionResult | null>(null);
  const [detectionCount, setDetectionCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [showVisualFeedback, setShowVisualFeedback] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);

  // Refs
  const detectorRef = useRef<WakeWordDetector | null>(null);
  const visualFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // Preload audio feedback sound
  useEffect(() => {
    if (!playSound || !soundUrl) return;

    const loadAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const response = await fetch(soundUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.error('Failed to preload wake word audio:', err);
      }
    };

    loadAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [playSound, soundUrl]);

  // Play feedback sound
  const playFeedbackSound = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    try {
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();
      
      source.buffer = audioBufferRef.current;
      gainNode.gain.value = soundVolume;
      
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (err) {
      console.error('Failed to play feedback sound:', err);
    }
  }, [soundVolume]);

  // Handle wake word detection
  const handleWakeWordDetected = useCallback((result: WakeWordDetectionResult) => {
    setLastDetection(result);
    setDetectionCount(prev => prev + 1);
    
    // Play sound feedback
    if (playSound) {
      playFeedbackSound();
    }
    
    // Show visual feedback
    if (enableVisualFeedback) {
      setShowVisualFeedback(true);
      
      // Clear existing timer
      if (visualFeedbackTimerRef.current) {
        clearTimeout(visualFeedbackTimerRef.current);
      }
      
      // Hide visual feedback after duration
      visualFeedbackTimerRef.current = setTimeout(() => {
        setShowVisualFeedback(false);
      }, visualFeedbackDuration);
    }
    
    // Call user callback
    onWakeWordDetected?.(result);
  }, [playSound, playFeedbackSound, enableVisualFeedback, visualFeedbackDuration, onWakeWordDetected]);

  // Handle state change
  const handleStateChange = useCallback((newState: WakeWordState) => {
    setState(newState);
    setIsListening(newState === 'listening' || newState === 'detected');
    onStateChange?.(newState);
  }, [onStateChange]);

  // Handle error
  const handleError = useCallback((err: Error) => {
    setError(err);
    onError?.(err);
  }, [onError]);

  // Handle partial result
  const handlePartialResult = useCallback((transcript: string) => {
    setPartialTranscript(transcript);
    onPartialResult?.(transcript);
  }, [onPartialResult]);

  // Create detector callbacks
  const callbacks: WakeWordCallbacks = {
    onWakeWordDetected: handleWakeWordDetected,
    onStateChange: handleStateChange,
    onError: handleError,
    onSpeechStart,
    onSpeechEnd,
    onPartialResult: handlePartialResult,
  };

  // Initialize detector
  useEffect(() => {
    if (!isSupported) return;

    const config: WakeWordConfig = {
      wakePhrase: 'mirror mirror on the wall',
      alternativePhrases,
      fuzzyMatchThreshold,
      cooldownPeriod,
      playSound: false, // We handle sound ourselves
      visualFeedback: false, // We handle visual feedback ourselves
      ...configOptions,
    };

    try {
      detectorRef.current = createWakeWordDetector(config, callbacks);
    } catch (err) {
      setError(err as Error);
      handleError(err as Error);
    }

    return () => {
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
    };
  }, [
    isSupported,
    alternativePhrases,
    fuzzyMatchThreshold,
    cooldownPeriod,
    configOptions,
    callbacks,
  ]);

  // Check microphone permission
  const checkPermission = useCallback(async (): Promise<PermissionState> => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionStatus(result.state);
      return result.state;
    } catch (err) {
      // Fallback for browsers that don't support permissions API
      console.warn('Permissions API not supported:', err);
      setPermissionStatus('prompt');
      return 'prompt';
    }
  }, []);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
    } catch (err) {
      setPermissionStatus('denied');
      throw new Error('Microphone permission denied');
    }
  }, []);

  // Start listening
  const start = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Speech recognition not supported in this browser');
    }

    if (!detectorRef.current) {
      throw new Error('Wake word detector not initialized');
    }

    try {
      setError(null);
      
      // Check permission first
      const permission = await checkPermission();
      if (permission === 'denied') {
        throw new Error('Microphone permission denied');
      }
      
      if (permission === 'prompt') {
        await requestPermission();
      }
      
      detectorRef.current.start();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [isSupported, checkPermission, requestPermission]);

  // Stop listening
  const stop = useCallback(() => {
    if (!detectorRef.current) return;
    
    detectorRef.current.stop();
    setPartialTranscript('');
    
    // Clear visual feedback
    if (visualFeedbackTimerRef.current) {
      clearTimeout(visualFeedbackTimerRef.current);
      visualFeedbackTimerRef.current = null;
    }
    setShowVisualFeedback(false);
  }, []);

  // Restart listening
  const restart = useCallback(async () => {
    stop();
    await new Promise(resolve => setTimeout(resolve, 100));
    await start();
  }, [stop, start]);

  // Reset state
  const reset = useCallback(() => {
    stop();
    setLastDetection(null);
    setDetectionCount(0);
    setError(null);
    setPartialTranscript('');
    setShowVisualFeedback(false);
  }, [stop]);

  // Update configuration
  const updateConfig = useCallback((config: Partial<WakeWordConfig>) => {
    if (!detectorRef.current) return;
    
    detectorRef.current.updateConfig(config);
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && isSupported) {
      start().catch(err => {
        console.error('Failed to auto-start wake word detection:', err);
      });
    }

    return () => {
      if (autoStart) {
        stop();
      }
    };
  }, [autoStart, isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (visualFeedbackTimerRef.current) {
        clearTimeout(visualFeedbackTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    isListening,
    state,
    lastDetection,
    detectionCount,
    error,
    detected: state === 'detected' || !!lastDetection, // Added for compatibility
    
    // Visual feedback state
    showVisualFeedback,
    
    // Partial transcript
    partialTranscript,
    
    // Browser support
    isSupported,
    permissionStatus,
    
    // Actions
    start,
    stop,
    restart,
    reset,
    
    // Configuration
    updateConfig,
    
    // Utilities
    checkPermission,
    requestPermission,
  };
}

/**
 * Hook to combine wake word detection with Hume voice
 */
export function useWakeWordWithVoice(
  wakeWordOptions: UseWakeWordOptions = {},
  onWakeWordTriggered?: () => void
) {
  const [shouldStartConversation, setShouldStartConversation] = useState(false);
  
  const wakeWord = useWakeWord({
    ...wakeWordOptions,
    onWakeWordDetected: (result) => {
      console.log('Wake word detected:', result);
      setShouldStartConversation(true);
      wakeWordOptions.onWakeWordDetected?.(result);
      onWakeWordTriggered?.();
    },
  });

  // Reset conversation trigger
  const resetConversationTrigger = useCallback(() => {
    setShouldStartConversation(false);
  }, []);

  return {
    ...wakeWord,
    shouldStartConversation,
    resetConversationTrigger,
  };
}