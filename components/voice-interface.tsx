'use client';

/**
 * Voice Interface UI Component
 * Displays microphone status, conversation transcript, and emotion visualization
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { Card } from '@/components/ui/card';
import { useVoice } from '@/lib/hume/voice-provider';
import { ConnectionState, EmotionScore, VocalBurst } from '@/lib/hume/types';
import { cn } from '@/lib/utils';

interface VoiceInterfaceProps {
  className?: string;
  showWaveform?: boolean;
  showEmotions?: boolean;
  showTranscript?: boolean;
  showVocalBursts?: boolean;
  maxMessages?: number;
  wakeWordActive?: boolean;
  onWakeWordDetected?: () => void;
}

/**
 * Voice Interface Component
 */
export function VoiceInterface({
  className,
  showWaveform = true,
  showEmotions = true,
  showTranscript = true,
  showVocalBursts = true,
  maxMessages = 50,
  wakeWordActive = false,
  onWakeWordDetected,
}: VoiceInterfaceProps) {
  const {
    connectionStatus,
    isConnected,
    isRecording,
    isSpeaking,
    audioLevel,
    messages,
    currentTranscript,
    currentEmotion,
    prosodyData,
    vocalBursts,
    startRecording,
    stopRecording,
    mute,
    unmute,
  } = useVoice();

  const [isMuted, setIsMuted] = useState(false);
  const [isWakeWordListening, setIsWakeWordListening] = useState(wakeWordActive);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!showWaveform || !waveformRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#6366f1',
      progressColor: '#818cf8',
      cursorColor: '#4f46e5',
      barWidth: 3,
      barRadius: 3,
      cursorWidth: 1,
      height: 100,
      barGap: 3,
      normalize: true,
      backend: 'WebAudio',
      interact: false,
    });

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, [showWaveform]);

  // Update waveform with audio level
  useEffect(() => {
    if (!wavesurferRef.current || !isRecording) return;

    // Create visualization based on audio level
    const visualizationData = new Float32Array(128);
    for (let i = 0; i < visualizationData.length; i++) {
      visualizationData[i] = Math.random() * audioLevel;
    }

    // Update waveform display
    // Note: This is a simplified visualization
    // In production, you'd want to use actual audio data
  }, [audioLevel, isRecording]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle microphone toggle
  const handleMicToggle = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    if (isMuted) {
      unmute();
      setIsMuted(false);
    } else {
      mute();
      setIsMuted(true);
    }
  }, [isMuted, mute, unmute]);

  // Get connection status color
  const getStatusColor = () => {
    switch (connectionStatus.state) {
      case ConnectionState.CONNECTED:
        return 'text-green-500';
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return 'text-yellow-500';
      case ConnectionState.ERROR:
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  // Get connection status text
  const getStatusText = () => {
    switch (connectionStatus.state) {
      case ConnectionState.CONNECTED:
        return 'Connected';
      case ConnectionState.CONNECTING:
        return 'Connecting...';
      case ConnectionState.RECONNECTING:
        return `Reconnecting... (${connectionStatus.reconnectAttempt || 0})`;
      case ConnectionState.ERROR:
        return 'Connection Error';
      case ConnectionState.DISCONNECTED:
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  // Format emotion scores for display
  const getTopEmotions = (emotions: EmotionScore[], limit = 3) => {
    return [...emotions]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(e => e.score > 0.1);
  };

  // Get vocal burst emoji
  const getVocalBurstEmoji = (type: string) => {
    switch (type) {
      case 'laughter':
        return '😄';
      case 'sigh':
        return '😔';
      case 'gasp':
        return '😮';
      case 'cry':
        return '😢';
      case 'scream':
        return '😱';
      default:
        return '🎵';
    }
  };

  return (
    <Card className={cn('p-6 space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={cn('w-2 h-2 rounded-full', getStatusColor())} />
          <span className="text-sm font-medium">{getStatusText()}</span>
          {connectionStatus.sessionId && (
            <span className="text-xs text-muted-foreground">
              Session: {connectionStatus.sessionId.slice(0, 8)}...
            </span>
          )}
        </div>

        {/* Wake Word Indicator */}
        {isWakeWordListening && (
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
            <span className="text-sm text-purple-500">Listening for &quot;Mirror Mirror&quot;</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        {/* Microphone Button */}
        <button
          onClick={handleMicToggle}
          disabled={!isConnected}
          className={cn(
            'p-4 rounded-full transition-all',
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
            !isConnected && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isRecording ? (
            <Mic className="w-6 h-6" />
          ) : (
            <MicOff className="w-6 h-6" />
          )}
        </button>

        {/* Volume Button */}
        <button
          onClick={handleMuteToggle}
          className="p-3 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Audio Level Indicator */}
        {isRecording && (
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1 h-4 bg-gray-300 rounded-full transition-all',
                  audioLevel > (i + 1) * 0.2 && 'bg-green-500'
                )}
                style={{
                  height: `${Math.max(16, audioLevel * 100 * (i + 1) / 5)}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Speaking Indicator */}
        {isSpeaking && (
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-500">Speaking...</span>
          </div>
        )}
      </div>

      {/* Waveform Visualization */}
      {showWaveform && (
        <div className="border rounded-lg p-2 bg-gray-50">
          <div ref={waveformRef} className="w-full" />
        </div>
      )}

      {/* Current Transcript */}
      {currentTranscript && showTranscript && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <span className="font-medium">You: </span>
            {currentTranscript}
          </p>
        </div>
      )}

      {/* Emotions Display */}
      {showEmotions && currentEmotion && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Detected Emotions</h3>
          <div className="flex flex-wrap gap-2">
            {getTopEmotions(currentEmotion.emotions).map((emotion) => (
              <div
                key={emotion.name}
                className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full"
              >
                <span className="text-xs font-medium text-purple-700">
                  {emotion.name}
                </span>
                <span className="ml-1 text-xs text-purple-600">
                  {(emotion.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
          
          {/* Prosody Data */}
          {prosodyData && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500">Pitch</p>
                <p className="text-sm font-medium">
                  {prosodyData.pitch.mean.toFixed(1)} Hz
                </p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500">Energy</p>
                <p className="text-sm font-medium">
                  {prosodyData.energy.mean.toFixed(1)}
                </p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500">Speaking Rate</p>
                <p className="text-sm font-medium">
                  {prosodyData.speaking_rate.toFixed(1)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vocal Bursts */}
      {showVocalBursts && vocalBursts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Vocal Bursts</h3>
          <div className="flex flex-wrap gap-2">
            {vocalBursts.map((burst, index) => (
              <div
                key={`${burst.type}-${index}`}
                className="flex items-center space-x-1 px-2 py-1 bg-yellow-50 rounded-full"
              >
                <span className="text-lg">{getVocalBurstEmoji(burst.type)}</span>
                <span className="text-xs text-yellow-700">{burst.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Transcript */}
      {showTranscript && messages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Conversation</h3>
          <div className="max-h-64 overflow-y-auto space-y-2 p-3 bg-gray-50 rounded-lg">
            {messages.slice(-maxMessages).map((msg, index) => (
              <div
                key={index}
                className={cn(
                  'p-2 rounded-lg',
                  msg.message.role === 'user'
                    ? 'bg-blue-100 ml-auto max-w-[80%]'
                    : 'bg-white max-w-[80%]'
                )}
              >
                <p className="text-sm">
                  <span className="font-medium">
                    {msg.message.role === 'user' ? 'You: ' : 'Assistant: '}
                  </span>
                  {msg.message.content}
                </p>
                
                {/* Show emotions for assistant messages */}
                {msg.message.role === 'assistant' && 'emotions' in msg && msg.emotions && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {getTopEmotions(msg.emotions, 2).map((emotion) => (
                      <span
                        key={emotion.name}
                        className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded"
                      >
                        {emotion.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Error Display */}
      {connectionStatus.lastError && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">Connection Error</p>
            <p className="text-xs text-red-600 mt-1">
              {connectionStatus.lastError.message}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// Export additional components for customization
export function MicrophoneButton({
  isRecording,
  onClick,
  disabled,
  className,
}: {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-4 rounded-full transition-all',
        isRecording
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
          : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isRecording ? (
        <Mic className="w-6 h-6" />
      ) : (
        <MicOff className="w-6 h-6" />
      )}
    </button>
  );
}

export function AudioLevelIndicator({
  level,
  bars = 5,
  className,
}: {
  level: number;
  bars?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center space-x-1', className)}>
      {[...Array(bars)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 bg-gray-300 rounded-full transition-all',
            level > (i + 1) / bars && 'bg-green-500'
          )}
          style={{
            height: `${Math.max(12, level * 32 * ((i + 1) / bars))}px`,
          }}
        />
      ))}
    </div>
  );
}