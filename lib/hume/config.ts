/**
 * Hume AI Configuration
 * Manages API keys, endpoints, and feature settings
 */

import { HumeConfig, EVI2Config } from './types';

// Default WebSocket endpoints for Hume AI
const HUME_WEBSOCKET_URL = 'wss://api.hume.ai/v0/stream/models';
const HUME_EVI2_WEBSOCKET_URL = 'wss://api.hume.ai/v0/evi/chat';
const HUME_REST_API_URL = 'https://api.hume.ai/v0';

// Default EVI2 configuration
const DEFAULT_EVI2_CONFIG: EVI2Config = {
  model: 'claude', // Use Claude by default as mentioned in requirements
  temperature: 0.7,
  max_tokens: 1000,
  enable_emotions: true,
  enable_interruptions: true,
  language: 'en-US',
};

// Default audio configuration
const DEFAULT_AUDIO_CONFIG = {
  sampleRate: 16000,
  encoding: 'linear16' as const,
  channels: 1,
};

// Default reconnection configuration
const DEFAULT_RECONNECT_CONFIG = {
  enabled: true,
  maxAttempts: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Get Hume configuration from environment variables
 */
export function getHumeConfig(): HumeConfig {
  // Read from environment variables
  const apiKey = process.env.NEXT_PUBLIC_HUME_API_KEY || '';
  const secretKey = process.env.HUME_SECRET_KEY || '';
  const configId = process.env.NEXT_PUBLIC_HUME_CONFIG_ID;
  const configVersion = process.env.NEXT_PUBLIC_HUME_CONFIG_VERSION 
    ? parseInt(process.env.NEXT_PUBLIC_HUME_CONFIG_VERSION, 10) 
    : undefined;

  // Determine which WebSocket URL to use based on features
  const useEVI2 = process.env.NEXT_PUBLIC_HUME_USE_EVI2 === 'true';
  const websocketUrl = useEVI2 
    ? process.env.NEXT_PUBLIC_HUME_WEBSOCKET_URL || HUME_EVI2_WEBSOCKET_URL
    : process.env.NEXT_PUBLIC_HUME_WEBSOCKET_URL || HUME_WEBSOCKET_URL;

  // Parse enabled features from environment
  const enabledFeatures = {
    emotions: process.env.NEXT_PUBLIC_HUME_ENABLE_EMOTIONS !== 'false', // Default true
    prosody: process.env.NEXT_PUBLIC_HUME_ENABLE_PROSODY !== 'false', // Default true
    facial: process.env.NEXT_PUBLIC_HUME_ENABLE_FACIAL !== 'false', // Default true
    vocalBursts: process.env.NEXT_PUBLIC_HUME_ENABLE_VOCAL_BURSTS !== 'false', // Default true
    speech: process.env.NEXT_PUBLIC_HUME_ENABLE_SPEECH !== 'false', // Default true
    evi2: useEVI2, // Based on environment variable
  };

  // Parse EVI2 configuration if enabled
  let evi2Config: EVI2Config | undefined;
  if (enabledFeatures.evi2) {
    evi2Config = {
      ...DEFAULT_EVI2_CONFIG,
      voice_id: process.env.NEXT_PUBLIC_HUME_VOICE_ID,
      language: process.env.NEXT_PUBLIC_HUME_LANGUAGE || DEFAULT_EVI2_CONFIG.language,
      model: (process.env.NEXT_PUBLIC_HUME_AI_MODEL as EVI2Config['model']) || DEFAULT_EVI2_CONFIG.model,
      system_prompt: process.env.NEXT_PUBLIC_HUME_SYSTEM_PROMPT,
      temperature: process.env.NEXT_PUBLIC_HUME_TEMPERATURE 
        ? parseFloat(process.env.NEXT_PUBLIC_HUME_TEMPERATURE)
        : DEFAULT_EVI2_CONFIG.temperature,
      max_tokens: process.env.NEXT_PUBLIC_HUME_MAX_TOKENS
        ? parseInt(process.env.NEXT_PUBLIC_HUME_MAX_TOKENS, 10)
        : DEFAULT_EVI2_CONFIG.max_tokens,
      enable_emotions: process.env.NEXT_PUBLIC_HUME_EVI2_EMOTIONS !== 'false',
      enable_interruptions: process.env.NEXT_PUBLIC_HUME_EVI2_INTERRUPTIONS !== 'false',
    };
  }

  // Parse audio configuration
  const audioConfig = {
    sampleRate: process.env.NEXT_PUBLIC_HUME_SAMPLE_RATE
      ? parseInt(process.env.NEXT_PUBLIC_HUME_SAMPLE_RATE, 10)
      : DEFAULT_AUDIO_CONFIG.sampleRate,
    encoding: (process.env.NEXT_PUBLIC_HUME_AUDIO_ENCODING as 'linear16' | 'mulaw' | 'opus') 
      || DEFAULT_AUDIO_CONFIG.encoding,
    channels: process.env.NEXT_PUBLIC_HUME_AUDIO_CHANNELS
      ? parseInt(process.env.NEXT_PUBLIC_HUME_AUDIO_CHANNELS, 10)
      : DEFAULT_AUDIO_CONFIG.channels,
  };

  // Parse reconnection configuration
  const reconnectConfig = {
    enabled: process.env.NEXT_PUBLIC_HUME_RECONNECT_ENABLED !== 'false',
    maxAttempts: process.env.NEXT_PUBLIC_HUME_RECONNECT_MAX_ATTEMPTS
      ? parseInt(process.env.NEXT_PUBLIC_HUME_RECONNECT_MAX_ATTEMPTS, 10)
      : DEFAULT_RECONNECT_CONFIG.maxAttempts,
    initialDelay: process.env.NEXT_PUBLIC_HUME_RECONNECT_INITIAL_DELAY
      ? parseInt(process.env.NEXT_PUBLIC_HUME_RECONNECT_INITIAL_DELAY, 10)
      : DEFAULT_RECONNECT_CONFIG.initialDelay,
    maxDelay: process.env.NEXT_PUBLIC_HUME_RECONNECT_MAX_DELAY
      ? parseInt(process.env.NEXT_PUBLIC_HUME_RECONNECT_MAX_DELAY, 10)
      : DEFAULT_RECONNECT_CONFIG.maxDelay,
    backoffMultiplier: process.env.NEXT_PUBLIC_HUME_RECONNECT_BACKOFF
      ? parseFloat(process.env.NEXT_PUBLIC_HUME_RECONNECT_BACKOFF)
      : DEFAULT_RECONNECT_CONFIG.backoffMultiplier,
  };

  const config: HumeConfig = {
    apiKey,
    secretKey,
    configId,
    configVersion,
    websocketUrl,
    restApiUrl: process.env.NEXT_PUBLIC_HUME_REST_API_URL || HUME_REST_API_URL,
    enabledFeatures,
    evi2Config,
    reconnect: reconnectConfig,
    audio: audioConfig,
  };

  return config;
}

/**
 * Validate Hume configuration
 */
export function validateConfig(config: HumeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required API key
  if (!config.apiKey) {
    errors.push('Hume API key is required (NEXT_PUBLIC_HUME_API_KEY)');
  }

  // Check secret key for certain operations
  if (config.enabledFeatures.evi2 && !config.secretKey) {
    errors.push('Hume secret key is required for EVI2 features (HUME_SECRET_KEY)');
  }

  // Validate WebSocket URL
  if (!config.websocketUrl) {
    errors.push('WebSocket URL is required');
  } else if (!config.websocketUrl.startsWith('wss://') && !config.websocketUrl.startsWith('ws://')) {
    errors.push('WebSocket URL must start with ws:// or wss://');
  }

  // Validate audio configuration
  if (config.audio) {
    if (config.audio.sampleRate < 8000 || config.audio.sampleRate > 48000) {
      errors.push('Audio sample rate must be between 8000 and 48000 Hz');
    }
    if (config.audio.channels < 1 || config.audio.channels > 2) {
      errors.push('Audio channels must be 1 (mono) or 2 (stereo)');
    }
  }

  // Validate EVI2 configuration if enabled
  if (config.enabledFeatures.evi2 && config.evi2Config) {
    if (config.evi2Config.temperature !== undefined) {
      if (config.evi2Config.temperature < 0 || config.evi2Config.temperature > 2) {
        errors.push('EVI2 temperature must be between 0 and 2');
      }
    }
    if (config.evi2Config.max_tokens !== undefined) {
      if (config.evi2Config.max_tokens < 1 || config.evi2Config.max_tokens > 100000) {
        errors.push('EVI2 max_tokens must be between 1 and 100000');
      }
    }
  }

  // Validate reconnection configuration
  if (config.reconnect.maxAttempts < 0) {
    errors.push('Reconnect max attempts must be non-negative');
  }
  if (config.reconnect.initialDelay < 0) {
    errors.push('Reconnect initial delay must be non-negative');
  }
  if (config.reconnect.maxDelay < config.reconnect.initialDelay) {
    errors.push('Reconnect max delay must be greater than or equal to initial delay');
  }
  if (config.reconnect.backoffMultiplier < 1) {
    errors.push('Reconnect backoff multiplier must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get authentication headers for Hume API requests
 */
export function getAuthHeaders(config: HumeConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Hume-Api-Key': config.apiKey,
  };

  if (config.secretKey) {
    headers['X-Hume-Secret-Key'] = config.secretKey;
  }

  if (config.configId) {
    headers['X-Hume-Config-Id'] = config.configId;
  }

  if (config.configVersion !== undefined) {
    headers['X-Hume-Config-Version'] = config.configVersion.toString();
  }

  return headers;
}

/**
 * Build WebSocket URL with query parameters
 */
export function buildWebSocketUrl(config: HumeConfig): string {
  const url = new URL(config.websocketUrl || HUME_WEBSOCKET_URL);

  // Add API key as query parameter
  url.searchParams.set('api_key', config.apiKey);

  // Add config ID if provided
  if (config.configId) {
    url.searchParams.set('config_id', config.configId);
  }

  // Add config version if provided
  if (config.configVersion !== undefined) {
    url.searchParams.set('config_version', config.configVersion.toString());
  }

  // Add enabled models based on features
  const models: string[] = [];
  if (config.enabledFeatures.emotions) models.push('emotion');
  if (config.enabledFeatures.prosody) models.push('prosody');
  if (config.enabledFeatures.facial) models.push('facial');
  if (config.enabledFeatures.vocalBursts) models.push('burst');
  if (config.enabledFeatures.speech) models.push('speech');
  
  if (models.length > 0 && !config.enabledFeatures.evi2) {
    url.searchParams.set('models', models.join(','));
  }

  // Add EVI2-specific parameters if enabled
  if (config.enabledFeatures.evi2 && config.evi2Config) {
    if (config.evi2Config.voice_id) {
      url.searchParams.set('voice_id', config.evi2Config.voice_id);
    }
    if (config.evi2Config.language) {
      url.searchParams.set('language', config.evi2Config.language);
    }
  }

  return url.toString();
}

/**
 * Create a default configuration for development/testing
 */
export function createDefaultConfig(apiKey: string, secretKey?: string): HumeConfig {
  return {
    apiKey,
    secretKey,
    websocketUrl: HUME_WEBSOCKET_URL,
    restApiUrl: HUME_REST_API_URL,
    enabledFeatures: {
      emotions: true,
      prosody: true,
      facial: true,
      vocalBursts: true,
      speech: true,
      evi2: false,
    },
    reconnect: DEFAULT_RECONNECT_CONFIG,
    audio: DEFAULT_AUDIO_CONFIG,
  };
}

/**
 * Get Hume access token for server-side API calls
 */
export async function getHumeAccessToken(): Promise<string | null> {
  const apiKey = process.env.HUME_API_KEY;
  const secretKey = process.env.HUME_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.error('Missing Hume API credentials');
    return null;
  }

  try {
    // Create base64 encoded credentials for basic auth
    const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    
    // Request access token from Hume
    const response = await fetch('https://api.hume.ai/oauth2-cc/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      console.error('Failed to get access token:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

// Export default configuration (will use environment variables)
export const defaultConfig = getHumeConfig();

// Export constants for external use
export {
  HUME_WEBSOCKET_URL,
  HUME_EVI2_WEBSOCKET_URL,
  HUME_REST_API_URL,
  DEFAULT_EVI2_CONFIG,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_RECONNECT_CONFIG,
};