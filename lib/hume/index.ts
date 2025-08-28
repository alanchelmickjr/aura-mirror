/**
 * Hume AI Integration - Main Export File
 * Re-exports all modules for easy importing
 */

// Export all types
export * from './types';

// Export configuration utilities
export {
  getHumeConfig,
  validateConfig,
  getAuthHeaders,
  buildWebSocketUrl,
  createDefaultConfig,
  defaultConfig,
  HUME_WEBSOCKET_URL,
  HUME_EVI2_WEBSOCKET_URL,
  HUME_REST_API_URL,
  DEFAULT_EVI2_CONFIG,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_RECONNECT_CONFIG,
} from './config';

// Export WebSocket manager
export {
  HumeWebSocketManager,
  getDefaultWebSocketManager,
  resetDefaultWebSocketManager,
} from './websocket-manager';

// Export emotion processor
export {
  EmotionProcessor,
  defaultEmotionProcessor,
  EMOTION_AURA_MAPPINGS,
} from './emotion-processor';

// Create a convenient default export for quick setup
import { HumeConfig, HumeEventHandlers } from './types';
import { getHumeConfig, validateConfig } from './config';
import { HumeWebSocketManager } from './websocket-manager';
import { EmotionProcessor } from './emotion-processor';

/**
 * Quick setup function for Hume AI integration
 */
export function createHumeClient(
  config?: Partial<HumeConfig>,
  handlers?: HumeEventHandlers
): {
  config: HumeConfig;
  websocket: HumeWebSocketManager;
  emotionProcessor: EmotionProcessor;
  connect: () => Promise<void>;
  disconnect: () => void;
  isValid: boolean;
  errors: string[];
} {
  // Get configuration from environment or use provided config
  const fullConfig = config ? { ...getHumeConfig(), ...config } : getHumeConfig();
  
  // Validate configuration
  const validation = validateConfig(fullConfig);
  
  // Create instances
  const websocket = new HumeWebSocketManager(fullConfig, handlers);
  const emotionProcessor = new EmotionProcessor();
  
  // Create convenience methods
  const connect = async () => {
    if (!validation.valid) {
      throw new Error(`Invalid Hume configuration: ${validation.errors.join(', ')}`);
    }
    await websocket.connect();
  };
  
  const disconnect = () => {
    websocket.disconnect();
  };
  
  return {
    config: fullConfig,
    websocket,
    emotionProcessor,
    connect,
    disconnect,
    isValid: validation.valid,
    errors: validation.errors,
  };
}

/**
 * React hook for using Hume AI (to be implemented in a separate file)
 * This is just the type definition
 */
export interface UseHumeOptions {
  config?: Partial<HumeConfig>;
  handlers?: HumeEventHandlers;
  autoConnect?: boolean;
  processEmotions?: boolean;
}

export interface UseHumeReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  emotions: any | null;
  auraColors: any | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (audio: ArrayBuffer | Blob | string) => void;
  sendMessage: (text: string) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

// Export a default object with all the main utilities
export default {
  createHumeClient,
  HumeWebSocketManager,
  EmotionProcessor,
  getHumeConfig,
  validateConfig,
};