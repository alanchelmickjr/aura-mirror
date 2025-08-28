/**
 * Hume AI TypeScript Type Definitions
 * Comprehensive types for all Hume streaming features including EVI2
 */

// ============= Core Emotion Types =============

export interface EmotionScore {
  name: string;
  score: number;
}

export interface EmotionData {
  emotions: EmotionScore[];
  timestamp: number;
  dominantEmotion?: string;
  confidence?: number;
}

// ============= Prosody (Voice Emotion) Types =============

export interface ProsodyData {
  pitch: {
    mean: number;
    variance: number;
    range: [number, number];
  };
  energy: {
    mean: number;
    variance: number;
  };
  speaking_rate: number;
  voice_quality: {
    breathiness: number;
    creakiness: number;
    roughness: number;
  };
  emotions: EmotionScore[];
  timestamp: number;
}

// ============= Facial Expression Types =============

export interface FacialExpression {
  emotions: EmotionScore[];
  action_units: {
    [key: string]: number; // AU codes and intensities
  };
  head_pose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  gaze_direction: {
    x: number;
    y: number;
  };
  timestamp: number;
}

// ============= Vocal Burst Types =============

export interface VocalBurst {
  type: 'laughter' | 'sigh' | 'gasp' | 'cry' | 'scream' | 'other';
  confidence: number;
  emotions: EmotionScore[];
  duration: number;
  timestamp: number;
}

// ============= Speech Types =============

export interface SpeechData {
  text: string;
  language: string;
  confidence: number;
  is_final: boolean;
  timestamp: number;
  word_timestamps?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// ============= EVI2 (Conversational AI) Types =============

export interface EVI2Config {
  voice_id?: string;
  language?: string;
  model?: 'claude' | 'gpt-4' | 'custom';
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  enable_emotions?: boolean;
  enable_interruptions?: boolean;
}

export interface EVI2Response {
  type: 'assistant_message' | 'assistant_end' | 'user_interruption';
  message?: string;
  audio_url?: string;
  emotions?: EmotionScore[];
  metadata?: {
    model_used: string;
    tokens_used: number;
    latency_ms: number;
  };
  timestamp: number;
}

export interface EVI2SessionConfig {
  config_id?: string;
  config_version?: number;
  custom_config?: EVI2Config;
}

// ============= WebSocket Message Types =============

export type WebSocketMessageType = 
  | 'audio_input'
  | 'audio_output'
  | 'user_message'
  | 'assistant_message'
  | 'assistant_end'
  | 'user_interruption'
  | 'emotion'
  | 'prosody'
  | 'facial_expression'
  | 'vocal_burst'
  | 'speech'
  | 'error'
  | 'session_begin'
  | 'session_end'
  | 'tool_call'
  | 'tool_response'
  | 'connection_established'
  | 'heartbeat';

export interface BaseWebSocketMessage {
  type: WebSocketMessageType;
  timestamp: number;
  session_id?: string;
}

export interface AudioInputMessage extends BaseWebSocketMessage {
  type: 'audio_input';
  data: string; // Base64 encoded audio
  encoding: 'linear16' | 'mulaw' | 'opus';
  sample_rate: number;
}

export interface AudioOutputMessage extends BaseWebSocketMessage {
  type: 'audio_output';
  data: string; // Base64 encoded audio
  encoding: 'linear16' | 'mulaw' | 'opus';
  sample_rate: number;
}

export interface UserMessage extends BaseWebSocketMessage {
  type: 'user_message';
  message: {
    role: 'user';
    content: string;
    timestamp: number;
  };
}

export interface AssistantMessage extends BaseWebSocketMessage {
  type: 'assistant_message';
  message: {
    role: 'assistant';
    content: string;
    timestamp: number;
  };
  emotions?: EmotionScore[];
}

export interface EmotionMessage extends BaseWebSocketMessage {
  type: 'emotion';
  emotions: EmotionData;
  source: 'voice' | 'face' | 'text' | 'combined';
}

export interface ProsodyMessage extends BaseWebSocketMessage {
  type: 'prosody';
  prosody: ProsodyData;
}

export interface FacialExpressionMessage extends BaseWebSocketMessage {
  type: 'facial_expression';
  facial: FacialExpression;
}

export interface VocalBurstMessage extends BaseWebSocketMessage {
  type: 'vocal_burst';
  burst: VocalBurst;
}

export interface SpeechMessage extends BaseWebSocketMessage {
  type: 'speech';
  speech: SpeechData;
}

export interface ErrorMessage extends BaseWebSocketMessage {
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SessionBeginMessage extends BaseWebSocketMessage {
  type: 'session_begin';
  session: {
    id: string;
    config: EVI2SessionConfig;
  };
}

export interface SessionEndMessage extends BaseWebSocketMessage {
  type: 'session_end';
  session: {
    id: string;
    duration_ms: number;
    messages_count: number;
  };
}

export interface ToolCallMessage extends BaseWebSocketMessage {
  type: 'tool_call';
  tool: {
    name: string;
    arguments: Record<string, any>;
    call_id: string;
  };
}

export interface ToolResponseMessage extends BaseWebSocketMessage {
  type: 'tool_response';
  tool: {
    call_id: string;
    response: any;
  };
}

export type WebSocketMessage =
  | AudioInputMessage
  | AudioOutputMessage
  | UserMessage
  | AssistantMessage
  | EmotionMessage
  | ProsodyMessage
  | FacialExpressionMessage
  | VocalBurstMessage
  | SpeechMessage
  | ErrorMessage
  | SessionBeginMessage
  | SessionEndMessage
  | ToolCallMessage
  | ToolResponseMessage
  | BaseWebSocketMessage;

// ============= Configuration Types =============

export interface HumeConfig {
  apiKey: string;
  secretKey?: string;
  configId?: string;
  configVersion?: number;
  websocketUrl?: string;
  restApiUrl?: string;
  enabledFeatures: {
    emotions: boolean;
    prosody: boolean;
    facial: boolean;
    vocalBursts: boolean;
    speech: boolean;
    evi2: boolean;
  };
  evi2Config?: EVI2Config;
  reconnect: {
    enabled: boolean;
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  audio?: {
    sampleRate: number;
    encoding: 'linear16' | 'mulaw' | 'opus';
    channels: number;
  };
}

// ============= Aura Visualization Types =============

export interface AuraColor {
  primary: string;
  secondary: string;
  accent?: string;
  intensity: number; // 0-1
  pulse_rate?: number; // Hz
}

export interface EmotionToAuraMapping {
  emotion: string;
  colors: AuraColor;
  description: string;
}

// ============= Connection State Types =============

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  CLOSED = 'closed'
}

export interface ConnectionStatus {
  state: ConnectionState;
  sessionId?: string;
  connectedAt?: Date;
  lastError?: Error;
  reconnectAttempt?: number;
}

// ============= Event Types =============

export interface HumeEventHandlers {
  onConnectionStateChange?: (status: ConnectionStatus) => void;
  onEmotion?: (data: EmotionData) => void;
  onProsody?: (data: ProsodyData) => void;
  onFacialExpression?: (data: FacialExpression) => void;
  onVocalBurst?: (data: VocalBurst) => void;
  onSpeech?: (data: SpeechData) => void;
  onAssistantMessage?: (message: AssistantMessage) => void;
  onUserMessage?: (message: UserMessage) => void;
  onAudioOutput?: (audio: AudioOutputMessage) => void;
  onError?: (error: Error) => void;
  onSessionBegin?: (session: SessionBeginMessage) => void;
  onSessionEnd?: (session: SessionEndMessage) => void;
  onToolCall?: (tool: ToolCallMessage) => void;
}

// ============= Utility Types =============

export interface EmotionHistory {
  emotions: EmotionData[];
  maxSize: number;
  timeWindow?: number; // milliseconds
}

export interface EmotionStatistics {
  mean: Record<string, number>;
  variance: Record<string, number>;
  dominant: string;
  stability: number; // 0-1, how stable emotions are
  volatility: number; // 0-1, how much emotions change
}

export interface StreamingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  emotionHistory: EmotionHistory;
  statistics?: EmotionStatistics;
}