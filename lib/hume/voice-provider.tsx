'use client';

/**
 * EVI2 Voice Provider for Hume AI
 * Manages voice interaction context and audio streaming
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { HumeWebSocketManager } from './websocket-manager';
import { EmotionProcessor } from './emotion-processor';
import { getClientHumeConfig, validateConfig } from './config';
import {
  HumeConfig,
  ConnectionStatus,
  ConnectionState,
  EmotionData,
  ProsodyData,
  VocalBurst,
  SpeechData,
  AssistantMessage,
  UserMessage,
  AudioOutputMessage,
  EVI2SessionConfig,
  HumeEventHandlers,
} from './types';

// Voice Context Interface
interface VoiceContextValue {
  // Connection state
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  
  // Audio state
  isRecording: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  
  // Conversation state
  messages: Array<UserMessage | AssistantMessage>;
  currentTranscript: string;
  
  // Emotion state
  currentEmotion: EmotionData | null;
  prosodyData: ProsodyData | null;
  vocalBursts: VocalBurst[];
  
  // Actions
  connect: (sessionConfig?: EVI2SessionConfig) => Promise<void>;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendMessage: (text: string) => void;
  clearConversation: () => void;
  
  // Audio controls
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  
  // WebSocket manager (for advanced use)
  wsManager: HumeWebSocketManager | null;
}

// Create context
const VoiceContext = createContext<VoiceContextValue | null>(null);

// Voice Provider Props
interface VoiceProviderProps {
  children: React.ReactNode;
  config?: Partial<HumeConfig>;
  sessionConfig?: EVI2SessionConfig;
  onEmotionChange?: (emotion: EmotionData) => void;
  onProsodyChange?: (prosody: ProsodyData) => void;
  onVocalBurst?: (burst: VocalBurst) => void;
  onMessage?: (message: UserMessage | AssistantMessage) => void;
  autoConnect?: boolean;
}

/**
 * EVI2 Voice Provider Component
 */
export function VoiceProvider({
  children,
  config: userConfig,
  sessionConfig,
  onEmotionChange,
  onProsodyChange,
  onVocalBurst,
  onMessage,
  autoConnect = false,
}: VoiceProviderProps) {
  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: ConnectionState.DISCONNECTED,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<Array<UserMessage | AssistantMessage>>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null);
  const [prosodyData, setProsodyData] = useState<ProsodyData | null>(null);
  const [vocalBursts, setVocalBursts] = useState<VocalBurst[]>([]);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const wsManagerRef = useRef<HumeWebSocketManager | null>(null);
  const emotionProcessorRef = useRef<EmotionProcessor>(new EmotionProcessor());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Get configuration
  const config = React.useMemo(() => {
    const baseConfig = getClientHumeConfig();
    return {
      ...baseConfig,
      ...userConfig,
      enabledFeatures: {
        ...baseConfig.enabledFeatures,
        ...userConfig?.enabledFeatures,
        evi2: true, // Always enable EVI2 for voice provider
      },
    };
  }, [userConfig]);

  // Validate configuration on mount
  useEffect(() => {
    const validation = validateConfig(config);
    if (!validation.valid) {
      console.error('Invalid Hume configuration:', validation.errors);
    }
  }, [config]);

  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!audioAnalyserRef.current || !isRecording) {
      setAudioLevel(0);
      return;
    }

    const analyser = audioAnalyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);

    // Continue monitoring
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  }, [isRecording]);

  // Play audio queue
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      if (!audioData) continue;

      try {
        // Create audio element
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        audio.volume = isMuted ? 0 : volume;
        audioElementRef.current = audio;

        // Play audio
        await audio.play();
        
        // Wait for audio to finish
        await new Promise((resolve) => {
          audio.onended = resolve;
        });
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }

    isPlayingRef.current = false;
    setIsSpeaking(false);
    audioElementRef.current = null;
  }, [volume, isMuted]);

  // Event handlers
  const eventHandlers: HumeEventHandlers = {
    onConnectionStateChange: (status) => {
      setConnectionStatus(status);
    },
    onEmotion: (data) => {
      const processed = emotionProcessorRef.current.processEmotionData(data.emotions);
      setCurrentEmotion(processed);
      onEmotionChange?.(processed);
    },
    onProsody: (data) => {
      setProsodyData(data);
      onProsodyChange?.(data);
      
      // Also process prosody emotions
      const emotionData = emotionProcessorRef.current.processProsodyData(data);
      setCurrentEmotion(emotionData);
      onEmotionChange?.(emotionData);
    },
    onVocalBurst: (burst) => {
      setVocalBursts(prev => [...prev.slice(-9), burst]); // Keep last 10
      onVocalBurst?.(burst);
    },
    onSpeech: (speech) => {
      if (speech.is_final) {
        setCurrentTranscript('');
      } else {
        setCurrentTranscript(speech.text);
      }
    },
    onUserMessage: (message) => {
      setMessages(prev => [...prev, message]);
      onMessage?.(message);
    },
    onAssistantMessage: (message) => {
      setMessages(prev => [...prev, message]);
      onMessage?.(message);
    },
    onAudioOutput: (audio) => {
      // Queue audio for playback
      audioQueueRef.current.push(audio.data);
      playAudioQueue();
    },
    onError: (error) => {
      console.error('Hume Voice Error:', error);
    },
  };

  // Connect to Hume
  const connect = useCallback(async (customSessionConfig?: EVI2SessionConfig) => {
    try {
      // Create WebSocket manager if not exists
      if (!wsManagerRef.current) {
        wsManagerRef.current = new HumeWebSocketManager(config, eventHandlers);
      }

      // Connect with session config
      await wsManagerRef.current.connect(customSessionConfig || sessionConfig);
    } catch (error) {
      console.error('Failed to connect to Hume:', error);
      throw error;
    }
  }, [config, sessionConfig, eventHandlers]);

  // Disconnect from Hume
  const disconnect = useCallback(() => {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Disconnect WebSocket
    wsManagerRef.current?.disconnect();
    wsManagerRef.current = null;

    // Clear state
    setConnectionStatus({ state: ConnectionState.DISCONNECTED });
    setMessages([]);
    setCurrentTranscript('');
    setCurrentEmotion(null);
    setProsodyData(null);
    setVocalBursts([]);
    audioQueueRef.current = [];
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording || !wsManagerRef.current?.isConnected()) {
      return;
    }

    try {
      // Get user media
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      // Create analyser for audio levels
      audioAnalyserRef.current = audioContextRef.current.createAnalyser();
      audioAnalyserRef.current.fftSize = 256;

      // Create source
      audioSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      audioSourceRef.current.connect(audioAnalyserRef.current);

      // Start audio capture in WebSocket manager
      await wsManagerRef.current.startAudioCapture();
      
      setIsRecording(true);
      
      // Start monitoring audio levels
      monitorAudioLevel();
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [isRecording, monitorAudioLevel]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }

    // Stop audio capture
    wsManagerRef.current?.stopAudioCapture();

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Cleanup audio context
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (audioAnalyserRef.current) {
      audioAnalyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
  }, [isRecording]);

  // Send text message
  const sendMessage = useCallback((text: string) => {
    if (!wsManagerRef.current?.isConnected()) {
      console.warn('Not connected to Hume');
      return;
    }

    wsManagerRef.current.sendTextMessage(text);
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setCurrentTranscript('');
    emotionProcessorRef.current.clearHistory();
  }, []);

  // Volume control
  const handleSetVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    
    if (audioElementRef.current) {
      audioElementRef.current.volume = isMuted ? 0 : clampedVolume;
    }
  }, [isMuted]);

  const mute = useCallback(() => {
    setIsMuted(true);
    if (audioElementRef.current) {
      audioElementRef.current.volume = 0;
    }
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
    if (audioElementRef.current) {
      audioElementRef.current.volume = volume;
    }
  }, [volume]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect]);

  // Context value
  const contextValue: VoiceContextValue = {
    connectionStatus,
    isConnected: connectionStatus.state === ConnectionState.CONNECTED,
    isRecording,
    isSpeaking,
    audioLevel,
    messages,
    currentTranscript,
    currentEmotion,
    prosodyData,
    vocalBursts,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendMessage,
    clearConversation,
    setVolume: handleSetVolume,
    mute,
    unmute,
    wsManager: wsManagerRef.current,
  };

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
}

/**
 * Hook to use voice context
 */
export function useVoice() {
  const context = useContext(VoiceContext);
  
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  
  return context;
}

// Export types
export type { VoiceContextValue, VoiceProviderProps };