/**
 * Wake Word Detector for "Mirror Mirror on the Wall"
 * Uses Web Speech API for continuous listening and detection
 */

export interface WakeWordConfig {
  // Wake phrase configuration
  wakePhrase?: string;
  alternativePhrases?: string[];
  fuzzyMatchThreshold?: number; // 0-1, how similar the phrase needs to be
  
  // Detection settings
  cooldownPeriod?: number; // ms to wait before detecting again
  timeout?: number; // ms to wait for complete phrase
  continuous?: boolean; // Keep listening after detection
  
  // Audio feedback
  playSound?: boolean;
  soundUrl?: string;
  
  // Visual feedback
  visualFeedback?: boolean;
  
  // Language
  language?: string;
}

export interface WakeWordDetectionResult {
  detected: boolean;
  phrase: string;
  confidence: number;
  timestamp: number;
  alternativeMatches?: string[];
}

export type WakeWordState = 'idle' | 'listening' | 'detected' | 'cooldown' | 'error';

export interface WakeWordCallbacks {
  onWakeWordDetected?: (result: WakeWordDetectionResult) => void;
  onStateChange?: (state: WakeWordState) => void;
  onError?: (error: Error) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onPartialResult?: (transcript: string) => void;
}

/**
 * Wake Word Detector Class
 */
export class WakeWordDetector {
  private config: Required<WakeWordConfig>;
  private callbacks: WakeWordCallbacks;
  private recognition: any; // SpeechRecognition type varies by browser
  private state: WakeWordState = 'idle';
  private lastDetectionTime: number = 0;
  private isListening: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private partialTranscript: string = '';
  private detectionTimeout: NodeJS.Timeout | null = null;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<WakeWordConfig> = {
    wakePhrase: 'mirror mirror on the wall',
    alternativePhrases: [
      'mirror mirror',
      'hey mirror',
      'ok mirror',
      'mirror on the wall',
    ],
    fuzzyMatchThreshold: 0.7,
    cooldownPeriod: 3000,
    timeout: 5000,
    continuous: true,
    playSound: true,
    soundUrl: '/sounds/wake-detected.mp3',
    visualFeedback: true,
    language: 'en-US',
  };

  constructor(config: WakeWordConfig = {}, callbacks: WakeWordCallbacks = {}) {
    this.config = { ...WakeWordDetector.DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    
    // Initialize speech recognition
    this.initializeSpeechRecognition();
    
    // Preload audio if enabled
    if (this.config.playSound && this.config.soundUrl) {
      this.preloadAudio();
    }
  }

  /**
   * Initialize Web Speech API
   */
  private initializeSpeechRecognition(): void {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = this.config.language;

    // Set up event handlers
    this.setupRecognitionHandlers();
  }

  /**
   * Set up speech recognition event handlers
   */
  private setupRecognitionHandlers(): void {
    // Handle recognition results
    this.recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      // Get transcript
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      const isFinal = lastResult.isFinal;
      
      if (!isFinal) {
        // Partial result
        this.partialTranscript = transcript;
        this.callbacks.onPartialResult?.(transcript);
        
        // Check for partial wake word match
        if (this.checkPartialMatch(transcript)) {
          this.startDetectionTimeout();
        }
      } else {
        // Final result
        this.checkForWakeWord(transcript, lastResult);
        this.partialTranscript = '';
        this.clearDetectionTimeout();
      }
    };

    // Handle speech start
    this.recognition.onspeechstart = () => {
      this.callbacks.onSpeechStart?.();
    };

    // Handle speech end
    this.recognition.onspeechend = () => {
      this.callbacks.onSpeechEnd?.();
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'no-speech') {
        // No speech detected, continue listening
        return;
      }
      
      this.setState('error');
      this.callbacks.onError?.(new Error(`Speech recognition error: ${event.error}`));
      
      // Restart if continuous mode
      if (this.config.continuous && this.isListening) {
        setTimeout(() => this.restart(), 1000);
      }
    };

    // Handle recognition end
    this.recognition.onend = () => {
      if (this.isListening && this.config.continuous) {
        // Restart recognition if it stopped unexpectedly
        this.restart();
      }
    };
  }

  /**
   * Check for wake word in transcript
   */
  private checkForWakeWord(transcript: string, result: any): void {
    // Check if in cooldown
    if (this.state === 'cooldown') {
      return;
    }

    const now = Date.now();
    if (now - this.lastDetectionTime < this.config.cooldownPeriod) {
      return;
    }

    // Check main wake phrase
    const mainMatch = this.fuzzyMatch(transcript, this.config.wakePhrase);
    
    // Check alternative phrases
    const alternativeMatches: string[] = [];
    let bestMatch = mainMatch;
    let bestPhrase = this.config.wakePhrase;
    
    for (const altPhrase of this.config.alternativePhrases) {
      const match = this.fuzzyMatch(transcript, altPhrase);
      if (match > bestMatch) {
        bestMatch = match;
        bestPhrase = altPhrase;
      }
      if (match >= this.config.fuzzyMatchThreshold) {
        alternativeMatches.push(altPhrase);
      }
    }

    // Check if wake word detected
    if (bestMatch >= this.config.fuzzyMatchThreshold) {
      this.handleWakeWordDetected(transcript, bestPhrase, bestMatch, alternativeMatches);
    }
  }

  /**
   * Check for partial wake word match
   */
  private checkPartialMatch(transcript: string): boolean {
    // Check if transcript starts with beginning of wake phrase
    const wakePhraseStart = this.config.wakePhrase.split(' ')[0];
    if (transcript.includes(wakePhraseStart)) {
      return true;
    }

    // Check alternative phrases
    for (const altPhrase of this.config.alternativePhrases) {
      const altStart = altPhrase.split(' ')[0];
      if (transcript.includes(altStart)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle wake word detection
   */
  private handleWakeWordDetected(
    transcript: string,
    matchedPhrase: string,
    confidence: number,
    alternativeMatches: string[]
  ): void {
    this.lastDetectionTime = Date.now();
    this.setState('detected');

    const result: WakeWordDetectionResult = {
      detected: true,
      phrase: matchedPhrase,
      confidence,
      timestamp: this.lastDetectionTime,
      alternativeMatches,
    };

    // Play sound if enabled
    if (this.config.playSound) {
      this.playDetectionSound();
    }

    // Trigger callback
    this.callbacks.onWakeWordDetected?.(result);

    // Start cooldown
    this.startCooldown();
  }

  /**
   * Fuzzy string matching
   */
  private fuzzyMatch(str1: string, str2: string): number {
    // Normalize strings
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 1.0;

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      return shorter.length / longer.length;
    }

    // Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Start detection timeout
   */
  private startDetectionTimeout(): void {
    this.clearDetectionTimeout();
    
    this.detectionTimeout = setTimeout(() => {
      // Reset partial transcript if timeout
      this.partialTranscript = '';
      this.clearDetectionTimeout();
    }, this.config.timeout);
  }

  /**
   * Clear detection timeout
   */
  private clearDetectionTimeout(): void {
    if (this.detectionTimeout) {
      clearTimeout(this.detectionTimeout);
      this.detectionTimeout = null;
    }
  }

  /**
   * Start cooldown period
   */
  private startCooldown(): void {
    this.setState('cooldown');
    
    setTimeout(() => {
      if (this.state === 'cooldown') {
        this.setState('listening');
      }
    }, this.config.cooldownPeriod);
  }

  /**
   * Preload detection sound
   */
  private async preloadAudio(): Promise<void> {
    if (!this.config.soundUrl) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const response = await fetch(this.config.soundUrl);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Failed to preload audio:', error);
    }
  }

  /**
   * Play detection sound
   */
  private playDetectionSound(): void {
    if (!this.audioContext || !this.audioBuffer) return;

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Failed to play detection sound:', error);
    }
  }

  /**
   * Set detector state
   */
  private setState(state: WakeWordState): void {
    if (this.state !== state) {
      this.state = state;
      this.callbacks.onStateChange?.(state);
    }
  }

  /**
   * Start listening for wake word
   */
  public start(): void {
    if (this.isListening) {
      return;
    }

    try {
      this.isListening = true;
      this.recognition.start();
      this.setState('listening');
    } catch (error) {
      console.error('Failed to start recognition:', error);
      this.setState('error');
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Stop listening
   */
  public stop(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    this.recognition.stop();
    this.clearDetectionTimeout();
    this.setState('idle');
  }

  /**
   * Restart recognition
   */
  private restart(): void {
    if (!this.isListening) return;

    try {
      this.recognition.stop();
      setTimeout(() => {
        if (this.isListening) {
          this.recognition.start();
        }
      }, 100);
    } catch (error) {
      console.error('Failed to restart recognition:', error);
    }
  }

  /**
   * Get current state
   */
  public getState(): WakeWordState {
    return this.state;
  }

  /**
   * Check if listening
   */
  public isActive(): boolean {
    return this.isListening;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<WakeWordConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update recognition language if changed
    if (config.language && this.recognition) {
      this.recognition.lang = config.language;
    }
    
    // Preload new audio if URL changed
    if (config.soundUrl && config.soundUrl !== this.config.soundUrl) {
      this.preloadAudio();
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.audioBuffer = null;
    this.recognition = null;
  }
}

// Export default detector instance factory
export function createWakeWordDetector(
  config?: WakeWordConfig,
  callbacks?: WakeWordCallbacks
): WakeWordDetector {
  return new WakeWordDetector(config, callbacks);
}