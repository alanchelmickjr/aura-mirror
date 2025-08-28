'use client';

/**
 * Custom React Hook for Hume Voice Integration
 * Connects voice interface to Hume WebSocket and manages voice session state
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { HumeWebSocketManager } from '@/lib/hume/websocket-manager';
import { EmotionProcessor } from '@/lib/hume/emotion-processor';
import { getHumeConfig, validateConfig } from '@/lib/hume/config';
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
  EmotionStatistics,
  AuraColor,
} from '@/lib/hume/types';

export interface UseHumeVoiceOptions {
  config?: Partial<HumeConfig>;
  sessionConfig?: EVI2SessionConfig;
  autoConnect?: boolean;
  enableEmotionTracking?: boolean;
  enableAudioPlayback?: boolean;
  maxMessageHistory?: number;
  emotionHistorySize?: number;
}

export interface UseHumeVoiceReturn {
  // Connection state
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  
  // Session state
  sessionId: string | null;
  sessionStartTime: Date | null;
  sessionDuration: number;
  
  // Audio state
  isRecording: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  volume: number;
  isMuted: boolean;
  
  // Conversation state
  messages: Array<UserMessage | AssistantMessage>;
  currentTranscript: string;
  lastUserMessage: string | null;
  lastAssistantMessage: string | null;
  
  // Emotion state
  currentEmotion: EmotionData | null;
  emotionHistory: EmotionData[];
  emotionStatistics: EmotionStatistics | null;
  auraColor: AuraColor | null;
  prosodyData: ProsodyData | null;
  vocalBursts: VocalBurst[];
  
  // Actions
  connect: (customConfig?: EVI2SessionConfig) => Promise<void>;
  disconnect: () => void;
  startConversation: () => Promise<void>;
  stopConversation: () => void;
  sendMessage: (text: string) => void;
  sendAudio: (audioData: ArrayBuffer | Blob | string) => void;
  clearHistory: () => void;
  
  // Audio controls
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  
  // Emotion controls
  resetEmotionTracking: () => void;
  getEmotionTrend: () => 'positive' | 'negative' | 'neutral';
  
  // Utilities
  exportConversation: () => string;
  exportEmotionData: () => object;
}

/**
 * Custom hook for Hume voice integration
 */
export function useHumeVoice(options: UseHumeVoiceOptions = {}): UseHumeVoiceReturn {
  const {
    config: userConfig,
    sessionConfig,
    autoConnect = false,
    enableEmotionTracking = true,
    enableAudioPlayback = true,
    maxMessageHistory = 100,
    emotionHistorySize = 50,
  } = options;

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: ConnectionState.DISCONNECTED,
  });
  const [error, setError] = useState<Error | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Array<UserMessage | AssistantMessage>>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null);
  const [emotionHistory, setEmotionHistory] = useState<EmotionData[]>([]);
  const [emotionStatistics, setEmotionStatistics] = useState<EmotionStatistics | null>(null);
  const [auraColor, setAuraColor] = useState<AuraColor | null>(null);
  const [prosodyData, setProsodyData] = useState<ProsodyData | null>(null);
  const [vocalBursts, setVocalBursts] = useState<VocalBurst[]>([]);

  // Refs
  const wsManagerRef = useRef<HumeWebSocketManager | null>(null);
  const emotionProcessorRef = useRef<EmotionProcessor>(new EmotionProcessor(emotionHistorySize));
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Get configuration
  const config = useCallback((): HumeConfig => {
    const baseConfig = getHumeConfig();
    return {
      ...baseConfig,
      ...userConfig,
      enabledFeatures: {
        ...baseConfig.enabledFeatures,
        ...userConfig?.enabledFeatures,
        evi2: true,
      },
    };
  }, [userConfig]);

  // Play audio queue
  const playAudioQueue = useCallback(async () => {
    if (!enableAudioPlayback || isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      if (!audioData) continue;

      try {
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        audio.volume = isMuted ? 0 : volume;
        
        await audio.play();
        await new Promise((resolve) => {
          audio.onended = resolve;
        });
      } catch (err) {
        console.error('Error playing audio:', err);
      }
    }

    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, [enableAudioPlayback, volume, isMuted]);

  // Monitor audio levels
  const monitorAudioLevels = useCallback(() => {
    if (!audioAnalyserRef.current || !isRecording) {
      setAudioLevel(0);
      return;
    }

    const analyser = audioAnalyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);

    requestAnimationFrame(monitorAudioLevels);
  }, [isRecording]);

  // Event handlers
  const eventHandlers: HumeEventHandlers = {
    onConnectionStateChange: (status) => {
      setConnectionStatus(status);
      if (status.state === ConnectionState.ERROR && status.lastError) {
        setError(status.lastError);
      }
    },
    onEmotion: (data) => {
      if (!enableEmotionTracking) return;
      
      const processed = emotionProcessorRef.current.processEmotionData(data.emotions);
      setCurrentEmotion(processed);
      
      // Update emotion history
      setEmotionHistory(prev => {
        const updated = [...prev, processed];
        return updated.slice(-emotionHistorySize);
      });
      
      // Update aura color
      const aura = emotionProcessorRef.current.emotionToAura(processed);
      setAuraColor(aura);
      
      // Update statistics
      const stats = emotionProcessorRef.current.getStatistics();
      if (stats) {
        setEmotionStatistics(stats);
      }
    },
    onProsody: (data) => {
      setProsodyData(data);
      
      if (enableEmotionTracking) {
        const emotionData = emotionProcessorRef.current.processProsodyData(data);
        setCurrentEmotion(emotionData);
        
        // Update emotion history
        setEmotionHistory(prev => {
          const updated = [...prev, emotionData];
          return updated.slice(-emotionHistorySize);
        });
      }
    },
    onVocalBurst: (burst) => {
      setVocalBursts(prev => [...prev.slice(-9), burst]);
    },
    onSpeech: (speech) => {
      if (speech.is_final) {
        setCurrentTranscript('');
      } else {
        setCurrentTranscript(speech.text);
      }
    },
    onUserMessage: (message) => {
      setMessages(prev => {
        const updated = [...prev, message];
        return updated.slice(-maxMessageHistory);
      });
      setLastUserMessage(message.message.content);
    },
    onAssistantMessage: (message) => {
      setMessages(prev => {
        const updated = [...prev, message];
        return updated.slice(-maxMessageHistory);
      });
      setLastAssistantMessage(message.message.content);
    },
    onAudioOutput: (audio) => {
      if (enableAudioPlayback) {
        audioQueueRef.current.push(audio.data);
        playAudioQueue();
      }
    },
    onSessionBegin: (session) => {
      setSessionId(session.session.id);
      setSessionStartTime(new Date());
      
      // Start session timer
      sessionTimerRef.current = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    },
    onSessionEnd: () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    },
    onError: (err) => {
      setError(err);
      console.error('Hume Voice Error:', err);
    },
  };

  // Connect to Hume
  const connect = useCallback(async (customConfig?: EVI2SessionConfig) => {
    try {
      setError(null);
      
      const humeConfig = config();
      const validation = validateConfig(humeConfig);
      
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      if (!wsManagerRef.current) {
        wsManagerRef.current = new HumeWebSocketManager(humeConfig, eventHandlers);
      }

      await wsManagerRef.current.connect(customConfig || sessionConfig);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [config, sessionConfig, eventHandlers]);

  // Disconnect from Hume
  const disconnect = useCallback(() => {
    if (isRecording) {
      stopConversation();
    }

    wsManagerRef.current?.disconnect();
    wsManagerRef.current = null;

    // Clear state
    setConnectionStatus({ state: ConnectionState.DISCONNECTED });
    setSessionId(null);
    setSessionStartTime(null);
    setSessionDuration(0);
    setMessages([]);
    setCurrentTranscript('');
    setLastUserMessage(null);
    setLastAssistantMessage(null);
    setError(null);
    audioQueueRef.current = [];

    // Clear session timer
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, [isRecording]);

  // Start conversation (recording)
  const startConversation = useCallback(async () => {
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

      // Create audio context for level monitoring
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioAnalyserRef.current = audioContextRef.current.createAnalyser();
      audioAnalyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      source.connect(audioAnalyserRef.current);

      // Start audio capture
      await wsManagerRef.current.startAudioCapture();
      setIsRecording(true);
      
      // Start monitoring audio levels
      monitorAudioLevels();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [isRecording, monitorAudioLevels]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    if (!isRecording) return;

    wsManagerRef.current?.stopAudioCapture();

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Cleanup audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    audioAnalyserRef.current = null;
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

  // Send audio data
  const sendAudio = useCallback((audioData: ArrayBuffer | Blob | string) => {
    if (!wsManagerRef.current?.isConnected()) {
      console.warn('Not connected to Hume');
      return;
    }

    wsManagerRef.current.sendAudio(audioData);
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setEmotionHistory([]);
    setVocalBursts([]);
    setCurrentTranscript('');
    setLastUserMessage(null);
    setLastAssistantMessage(null);
    emotionProcessorRef.current.clearHistory();
  }, []);

  // Volume controls
  const setVolumeHandler = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  }, []);

  const mute = useCallback(() => {
    setIsMuted(true);
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
  }, []);

  // Emotion controls
  const resetEmotionTracking = useCallback(() => {
    emotionProcessorRef.current.clearHistory();
    setEmotionHistory([]);
    setEmotionStatistics(null);
    setCurrentEmotion(null);
    setAuraColor(null);
  }, []);

  const getEmotionTrend = useCallback((): 'positive' | 'negative' | 'neutral' => {
    if (!emotionStatistics) return 'neutral';

    const positiveEmotions = ['joy', 'love', 'excitement', 'gratitude', 'contentment'];
    const negativeEmotions = ['anger', 'sadness', 'fear', 'disgust', 'anxiety'];

    let positiveScore = 0;
    let negativeScore = 0;

    Object.entries(emotionStatistics.mean).forEach(([emotion, score]) => {
      if (positiveEmotions.includes(emotion)) {
        positiveScore += score;
      } else if (negativeEmotions.includes(emotion)) {
        negativeScore += score;
      }
    });

    if (positiveScore > negativeScore * 1.5) return 'positive';
    if (negativeScore > positiveScore * 1.5) return 'negative';
    return 'neutral';
  }, [emotionStatistics]);

  // Export utilities
  const exportConversation = useCallback((): string => {
    return JSON.stringify({
      sessionId,
      startTime: sessionStartTime,
      duration: sessionDuration,
      messages: messages.map(msg => ({
        role: msg.message.role,
        content: msg.message.content,
        timestamp: msg.message.timestamp,
      })),
    }, null, 2);
  }, [sessionId, sessionStartTime, sessionDuration, messages]);

  const exportEmotionData = useCallback((): object => {
    return {
      currentEmotion,
      emotionHistory,
      statistics: emotionStatistics,
      vocalBursts,
      prosodyData,
    };
  }, [currentEmotion, emotionHistory, emotionStatistics, vocalBursts, prosodyData]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, []);

  return {
    // Connection state
    connectionStatus,
    isConnected: connectionStatus.state === ConnectionState.CONNECTED,
    isConnecting: connectionStatus.state === ConnectionState.CONNECTING,
    error,
    
    // Session state
    sessionId,
    sessionStartTime,
    sessionDuration,
    
    // Audio state
    isRecording,
    isSpeaking,
    audioLevel,
    volume,
    isMuted,
    
    // Conversation state
    messages,
    currentTranscript,
    lastUserMessage,
    lastAssistantMessage,
    
    // Emotion state
    currentEmotion,
    emotionHistory,
    emotionStatistics,
    auraColor,
    prosodyData,
    vocalBursts,
    
    // Actions
    connect,
    disconnect,
    startConversation,
    stopConversation,
    sendMessage,
    sendAudio,
    clearHistory,
    
    // Audio controls
    setVolume: setVolumeHandler,
    mute,
    unmute,
    
    // Emotion controls
    resetEmotionTracking,
    getEmotionTrend,
    
    // Utilities
    exportConversation,
    exportEmotionData,
  };
}