/**
 * Hume AI WebSocket Manager
 * Handles WebSocket connections, reconnection logic, and message handling
 */

import {
  WebSocketMessage,
  WebSocketMessageType,
  ConnectionState,
  ConnectionStatus,
  HumeConfig,
  HumeEventHandlers,
  AudioInputMessage,
  UserMessage,
  ToolResponseMessage,
  EVI2SessionConfig,
} from './types';
import { buildWebSocketUrl, getAuthHeaders, fetchHumeToken } from './config';

export class HumeWebSocketManager {
  private ws: WebSocket | null = null;
  private config: HumeConfig;
  private eventHandlers: HumeEventHandlers;
  private connectionStatus: ConnectionStatus;
  private reconnectAttempt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isReconnecting: boolean = false;
  private sessionId: string | null = null;
  private audioContext: AudioContext | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;

  constructor(config: HumeConfig, handlers: HumeEventHandlers = {}) {
    this.config = config;
    this.eventHandlers = handlers;
    this.connectionStatus = {
      state: ConnectionState.DISCONNECTED,
    };
  }

  /**
   * Connect to Hume WebSocket API
   */
  public async connect(sessionConfig?: EVI2SessionConfig): Promise<void> {
    if (this.connectionStatus.state === ConnectionState.CONNECTED) {
      console.warn('Already connected to Hume WebSocket');
      return;
    }

    if (this.connectionStatus.state === ConnectionState.CONNECTING) {
      console.warn('Connection already in progress');
      return;
    }

    this.updateConnectionStatus(ConnectionState.CONNECTING);

    try {
      // Fetch API key from server for WebSocket authentication
      const authData = await fetchHumeToken();
      if (!authData) {
        throw new Error('Failed to fetch authentication credentials');
      }

      const wsUrl = buildWebSocketUrl(this.config, authData.apiKey);
      this.ws = new WebSocket(wsUrl);

      this.setupWebSocketHandlers();

      // Wait for connection to be established
      await this.waitForConnection();

      // Send session configuration if using EVI2
      if (this.config.enabledFeatures.evi2 && sessionConfig) {
        await this.startEVI2Session(sessionConfig);
      }
    } catch (error) {
      this.handleConnectionError(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from Hume WebSocket API
   */
  public disconnect(): void {
    this.isReconnecting = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.stopAudioCapture();
    this.updateConnectionStatus(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message through the WebSocket
   */
  public send(message: Partial<WebSocketMessage>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queueing message');
      this.messageQueue.push(message as WebSocketMessage);
      return;
    }

    try {
      // For Hume API, send the message as-is without adding extra fields
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      this.eventHandlers.onError?.(error as Error);
    }
  }

  /**
   * Send audio data to Hume
   */
  public sendAudio(audioData: ArrayBuffer | Blob | string): void {
    const message: Partial<AudioInputMessage> = {
      type: 'audio_input',
      data: typeof audioData === 'string' ? audioData : this.arrayBufferToBase64(audioData),
      encoding: this.config.audio?.encoding || 'linear16',
      sample_rate: this.config.audio?.sampleRate || 16000,
    };

    this.send(message);
  }

  /**
   * Send a text message (for EVI2)
   */
  public sendTextMessage(text: string): void {
    const message: Partial<UserMessage> = {
      type: 'user_message',
      message: {
        role: 'user',
        content: text,
        timestamp: Date.now(),
      },
    };

    this.send(message);
  }

  /**
   * Send a tool response (for EVI2 function calling)
   */
  public sendToolResponse(callId: string, response: any): void {
    const message: Partial<ToolResponseMessage> = {
      type: 'tool_response',
      tool: {
        call_id: callId,
        response,
      },
    };

    this.send(message);
  }

  /**
   * Start audio capture from microphone
   */
  public async startAudioCapture(): Promise<void> {
    try {
      // Get user media
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.audio?.channels || 1,
          sampleRate: this.config.audio?.sampleRate || 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.audio?.sampleRate || 16000,
      });

      // Create source from media stream
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for capturing audio
      const bufferSize = 4096;
      this.audioProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.audioProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const audioData = this.encodeAudio(inputData);
        this.sendAudio(audioData);
      };

      // Connect nodes
      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error starting audio capture:', error);
      this.eventHandlers.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  public stopAudioCapture(): void {
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionStatus.state === ConnectionState.CONNECTED;
  }

  // ============= Private Methods =============

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onerror = (event) => this.handleError(event);
    this.ws.onclose = (event) => this.handleClose(event);
  }

  private handleOpen(): void {
    console.log('WebSocket connected to Hume');
    this.reconnectAttempt = 0;
    this.updateConnectionStatus(ConnectionState.CONNECTED);
    this.startHeartbeat();
    this.flushMessageQueue();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('WebSocket message received:', message);
      
      // Update session ID if provided
      if (message.session_id) {
        this.sessionId = message.session_id;
      }

      // Route message to appropriate handler
      this.routeMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.eventHandlers.onError?.(error as Error);
    }
  }

  private routeMessage(message: any): void {
    // Handle empty or invalid messages
    if (!message || typeof message !== 'object') {
      console.warn('Received invalid WebSocket message:', message);
      return;
    }
    
    // Handle empty objects
    if (Object.keys(message).length === 0) {
      console.debug('Received empty WebSocket message, ignoring');
      return;
    }
    
    // Handle Hume error format which doesn't have a type field
    if ('error' in message && !message.type) {
      const error = new Error(`Hume API Error: ${message.error}`);
      (error as any).code = (message as any).code;
      console.error('Hume WebSocket error:', message);
      this.eventHandlers.onError?.(error);
      return;
    }
    
    // Handle Hume facial emotion response format: {face: {...}}
    if ('face' in message && message.face) {
      console.log('Processing facial emotion data:', message.face);
      this.eventHandlers.onFacialExpression?.(message.face);
      return;
    }
    
    // Handle messages with type field (standard format)
    if (!message.type) {
      console.warn('Received message without type or face data:', message);
      return;
    }
    
    switch (message.type) {
      case 'emotion':
        if ('emotions' in message) {
          this.eventHandlers.onEmotion?.(message.emotions);
        }
        break;

      case 'prosody':
        if ('prosody' in message) {
          this.eventHandlers.onProsody?.(message.prosody);
        }
        break;

      case 'facial_expression':
        if ('facial' in message) {
          this.eventHandlers.onFacialExpression?.(message.facial);
        }
        break;

      case 'vocal_burst':
        if ('burst' in message) {
          this.eventHandlers.onVocalBurst?.(message.burst);
        }
        break;

      case 'speech':
        if ('speech' in message) {
          this.eventHandlers.onSpeech?.(message.speech);
        }
        break;

      case 'assistant_message':
        this.eventHandlers.onAssistantMessage?.(message as any);
        break;

      case 'user_message':
        this.eventHandlers.onUserMessage?.(message as any);
        break;

      case 'audio_output':
        this.eventHandlers.onAudioOutput?.(message as any);
        break;

      case 'session_begin':
        this.eventHandlers.onSessionBegin?.(message as any);
        break;

      case 'session_end':
        this.eventHandlers.onSessionEnd?.(message as any);
        break;

      case 'tool_call':
        this.eventHandlers.onToolCall?.(message as any);
        break;

      case 'error':
        if ('error' in message) {
          const error = new Error(message.error.message);
          (error as any).code = message.error.code;
          (error as any).details = message.error.details;
          this.eventHandlers.onError?.(error);
        }
        break;

      case 'heartbeat':
        // Heartbeat received, connection is alive
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    const error = new Error('WebSocket error occurred');
    this.connectionStatus.lastError = error;
    this.eventHandlers.onError?.(error);
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket closed:', event.code, event.reason);
    
    this.clearTimers();
    this.ws = null;
    this.sessionId = null;

    if (event.code === 1000) {
      // Normal closure
      this.updateConnectionStatus(ConnectionState.CLOSED);
    } else {
      // Abnormal closure, attempt reconnection
      this.updateConnectionStatus(ConnectionState.ERROR);
      
      if (this.config.reconnect.enabled && !this.isReconnecting) {
        this.attemptReconnection();
      }
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('Connection error:', error);
    this.connectionStatus.lastError = error;
    this.updateConnectionStatus(ConnectionState.ERROR);
    this.eventHandlers.onError?.(error);
  }

  private attemptReconnection(): void {
    if (this.isReconnecting) return;
    
    if (this.reconnectAttempt >= this.config.reconnect.maxAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateConnectionStatus(ConnectionState.CLOSED);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempt++;
    this.updateConnectionStatus(ConnectionState.RECONNECTING);

    const delay = Math.min(
      this.config.reconnect.initialDelay * Math.pow(this.config.reconnect.backoffMultiplier, this.reconnectAttempt - 1),
      this.config.reconnect.maxDelay
    );

    console.log(`Attempting reconnection ${this.reconnectAttempt}/${this.config.reconnect.maxAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.isReconnecting = false;
      } catch (error) {
        this.isReconnecting = false;
        this.attemptReconnection();
      }
    }, delay);
  }

  private updateConnectionStatus(state: ConnectionState): void {
    const previousState = this.connectionStatus.state;
    
    this.connectionStatus = {
      ...this.connectionStatus,
      state,
      connectedAt: state === ConnectionState.CONNECTED ? new Date() : this.connectionStatus.connectedAt,
      sessionId: this.sessionId || undefined,
      reconnectAttempt: this.reconnectAttempt,
    };

    if (previousState !== state) {
      this.eventHandlers.onConnectionStateChange?.(this.connectionStatus);
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000); // 30 second timeout

      const checkConnection = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else if (this.ws?.readyState === WebSocket.CLOSED || this.ws?.readyState === WebSocket.CLOSING) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  private startEVI2Session(config: EVI2SessionConfig): Promise<void> {
    return new Promise((resolve) => {
      this.send({
        type: 'session_begin',
        session: {
          id: this.generateSessionId(),
          config,
        },
      } as any);
      
      // Wait a bit for session to be established
      setTimeout(resolve, 500);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat' });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private encodeAudio(audioData: Float32Array): string {
    // Convert Float32Array to Int16Array for linear16 encoding
    const int16Data = new Int16Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    // Convert to base64
    return this.arrayBufferToBase64(int16Data.buffer);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Blob): string {
    if (buffer instanceof Blob) {
      // For Blob, we'd need to read it asynchronously
      console.warn('Blob to base64 conversion not implemented');
      return '';
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export a singleton instance for convenience
let defaultManager: HumeWebSocketManager | null = null;

export function getDefaultWebSocketManager(
  config?: HumeConfig,
  handlers?: HumeEventHandlers
): HumeWebSocketManager {
  if (!defaultManager && config) {
    defaultManager = new HumeWebSocketManager(config, handlers);
  } else if (!defaultManager) {
    throw new Error('WebSocket manager not initialized. Please provide configuration.');
  }
  
  return defaultManager;
}

export function resetDefaultWebSocketManager(): void {
  if (defaultManager) {
    defaultManager.disconnect();
    defaultManager = null;
  }
}