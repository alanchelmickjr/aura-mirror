/**
 * Facial Expression Analyzer
 * Captures video frames and sends them to Hume's facial expression API
 * Processes facial emotion data in real-time with WebSocket streaming
 */

import { 
  FacialExpression, 
  EmotionScore,
  FacialExpressionMessage,
  WebSocketMessage 
} from '../hume/types';
import { HumeWebSocketManager } from '../hume/websocket-manager';
import { EmotionProcessor } from '../hume/emotion-processor';

export interface FaceDetectionResult {
  faceId: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  emotions: EmotionScore[];
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    mouth: { x: number; y: number };
  };
  headPose?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  gazeDirection?: {
    x: number;
    y: number;
  };
}

export interface FacialAnalyzerConfig {
  apiKey: string;
  frameRate?: number; // Frames per second to analyze (default: 10)
  maxFaces?: number; // Maximum number of faces to track (default: 5)
  minConfidence?: number; // Minimum confidence threshold (default: 0.5)
  enableLandmarks?: boolean;
  enableHeadPose?: boolean;
  enableGaze?: boolean;
  smoothingFactor?: number; // Emotion smoothing factor (default: 0.3)
}

export class FacialAnalyzer {
  private config: FacialAnalyzerConfig;
  private wsManager: HumeWebSocketManager | null = null;
  private emotionProcessor: EmotionProcessor;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private isAnalyzing: boolean = false;
  private analyzeInterval: ReturnType<typeof setInterval> | null = null;
  private faceCache: Map<string, FaceDetectionResult> = new Map();
  private frameCounter: number = 0;
  private lastAnalysisTime: number = 0;
  private onFacesDetected?: (faces: FaceDetectionResult[]) => void;
  private onEmotionUpdate?: (emotions: FacialExpression) => void;
  private onError?: (error: Error) => void;

  constructor(config: FacialAnalyzerConfig) {
    this.config = {
      frameRate: 10,
      maxFaces: 5,
      minConfidence: 0.5,
      enableLandmarks: true,
      enableHeadPose: true,
      enableGaze: true,
      smoothingFactor: 0.3,
      ...config
    };

    this.emotionProcessor = new EmotionProcessor(100, 30000); // 30 second window
  }

  /**
   * Initialize the facial analyzer with a video element
   */
  public async initialize(
    videoElement: HTMLVideoElement,
    wsManager?: HumeWebSocketManager
  ): Promise<void> {
    this.videoElement = videoElement;
    
    // Create offscreen canvas for frame extraction
    this.canvasElement = document.createElement('canvas');
    this.canvasContext = this.canvasElement.getContext('2d', {
      willReadFrequently: true,
      alpha: false
    });

    if (!this.canvasContext) {
      throw new Error('Failed to create canvas context');
    }

    // Set canvas size to match video
    this.canvasElement.width = videoElement.videoWidth || 640;
    this.canvasElement.height = videoElement.videoHeight || 480;

    // Use provided WebSocket manager or create new one
    if (wsManager) {
      this.wsManager = wsManager;
    } else {
      // Create WebSocket manager with facial expression handlers
      this.wsManager = new HumeWebSocketManager(
        {
          apiKey: this.config.apiKey,
          enabledFeatures: {
            emotions: true,
            prosody: false,
            facial: true,
            vocalBursts: false,
            speech: false,
            evi2: false
          },
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2
          }
        },
        {
          onFacialExpression: (data) => this.handleFacialExpression(data),
          onError: (error) => this.handleError(error)
        }
      );

      await this.wsManager.connect();
    }
  }

  /**
   * Start analyzing facial expressions
   */
  public start(
    onFacesDetected?: (faces: FaceDetectionResult[]) => void,
    onEmotionUpdate?: (emotions: FacialExpression) => void,
    onError?: (error: Error) => void
  ): void {
    if (this.isAnalyzing) {
      console.warn('Facial analysis already in progress');
      return;
    }

    this.onFacesDetected = onFacesDetected;
    this.onEmotionUpdate = onEmotionUpdate;
    this.onError = onError;
    this.isAnalyzing = true;

    // Start frame analysis loop
    const intervalMs = 1000 / (this.config.frameRate || 10);
    this.analyzeInterval = setInterval(() => {
      this.analyzeFrame();
    }, intervalMs);
  }

  /**
   * Stop analyzing facial expressions
   */
  public stop(): void {
    this.isAnalyzing = false;

    if (this.analyzeInterval) {
      clearInterval(this.analyzeInterval);
      this.analyzeInterval = null;
    }

    this.faceCache.clear();
  }

  /**
   * Analyze a single frame
   */
  private async analyzeFrame(): Promise<void> {
    if (!this.isAnalyzing || !this.videoElement || !this.canvasContext) {
      return;
    }

    // Check if video is ready
    if (this.videoElement.readyState < 2) {
      return;
    }

    try {
      const now = Date.now();
      
      // Throttle analysis based on configured frame rate
      if (now - this.lastAnalysisTime < (1000 / (this.config.frameRate || 10))) {
        return;
      }
      
      this.lastAnalysisTime = now;
      this.frameCounter++;

      // Update canvas size if video size changed
      if (this.canvasElement!.width !== this.videoElement.videoWidth ||
          this.canvasElement!.height !== this.videoElement.videoHeight) {
        this.canvasElement!.width = this.videoElement.videoWidth;
        this.canvasElement!.height = this.videoElement.videoHeight;
      }

      // Draw current video frame to canvas
      this.canvasContext.drawImage(
        this.videoElement,
        0, 0,
        this.canvasElement!.width,
        this.canvasElement!.height
      );

      // Extract frame as base64
      const frameData = this.canvasElement!.toDataURL('image/jpeg', 0.8);
      const base64Data = frameData.split(',')[1];

      // Send frame to Hume for analysis
      if (this.wsManager?.isConnected()) {
        const message = {
          data: base64Data,
          models: {
            face: {}
          }
        };

        this.wsManager.send(message);
      }

      // Perform local face detection using browser APIs if available
      if ('FaceDetector' in window) {
        await this.performLocalFaceDetection();
      }
    } catch (error) {
      console.error('Error analyzing frame:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Perform local face detection using browser Face Detection API
   */
  private async performLocalFaceDetection(): Promise<void> {
    try {
      // Check if Face Detection API is available
      const FaceDetector = (window as any).FaceDetector;
      if (!FaceDetector) {
        return;
      }

      const detector = new FaceDetector({
        maxDetectedFaces: this.config.maxFaces,
        fastMode: false
      });

      const faces = await detector.detect(this.canvasElement!);
      
      const detectionResults: FaceDetectionResult[] = faces.map((face: any, index: number) => {
        const faceId = `face_${index}`;
        const cachedFace = this.faceCache.get(faceId);
        
        return {
          faceId,
          boundingBox: {
            x: face.boundingBox.x,
            y: face.boundingBox.y,
            width: face.boundingBox.width,
            height: face.boundingBox.height
          },
          confidence: 0.9, // Browser API doesn't provide confidence
          emotions: cachedFace?.emotions || [],
          landmarks: face.landmarks ? {
            leftEye: face.landmarks.find((l: any) => l.type === 'eye')?.locations[0] || { x: 0, y: 0 },
            rightEye: face.landmarks.find((l: any) => l.type === 'eye')?.locations[1] || { x: 0, y: 0 },
            nose: face.landmarks.find((l: any) => l.type === 'nose')?.locations[0] || { x: 0, y: 0 },
            mouth: face.landmarks.find((l: any) => l.type === 'mouth')?.locations[0] || { x: 0, y: 0 }
          } : undefined
        };
      });

      // Update face cache
      detectionResults.forEach(face => {
        this.faceCache.set(face.faceId, face);
      });

      // Clean up old faces from cache
      const currentFaceIds = new Set(detectionResults.map(f => f.faceId));
      Array.from(this.faceCache.keys()).forEach(faceId => {
        if (!currentFaceIds.has(faceId)) {
          this.faceCache.delete(faceId);
        }
      });

      // Notify listeners
      if (this.onFacesDetected && detectionResults.length > 0) {
        this.onFacesDetected(detectionResults);
      }
    } catch (error) {
      // Face Detection API not available or failed
      // This is okay, we'll rely on Hume's API
    }
  }

  /**
   * Handle facial expression data from Hume
   */
  private handleFacialExpression(data: any): void {
    console.log('Raw facial data from Hume:', JSON.stringify(data, null, 2));
    
    // Extract emotions from Hume's response format
    let emotions: any[] = [];
    if (data.predictions && data.predictions.length > 0) {
      // Hume format: {predictions: [{emotions: [...]}]}
      emotions = data.predictions[0].emotions || [];
    } else if (data.emotions) {
      // Direct emotions format
      emotions = data.emotions;
    }
    
    console.log('Extracted emotions:', emotions);
    
    // Convert to expected format
    const facialData = {
      emotions: emotions,
      timestamp: Date.now(),
      action_units: {},
      head_pose: { pitch: 0, yaw: 0, roll: 0 },
      gaze_direction: { x: 0, y: 0 }
    };
    
    // Process emotions
    const processedEmotions = this.emotionProcessor.processFacialData(facialData);
    console.log('Processed emotions:', processedEmotions);
    
    // Notify emotion update listener
    if (this.onEmotionUpdate) {
      console.log('Calling onEmotionUpdate with facialData');
      this.onEmotionUpdate(facialData);
    }
    
    // Update face cache with emotion data
    if (this.faceCache.size > 0) {
      // Distribute emotions to detected faces
      // In a real implementation, Hume would provide face-specific emotions
      const faces = Array.from(this.faceCache.values());
      faces.forEach(face => {
        face.emotions = processedEmotions.emotions;
        face.headPose = data.head_pose;
        face.gazeDirection = data.gaze_direction;
      });

      if (this.onFacesDetected) {
        this.onFacesDetected(faces);
      }
    }

    // Notify emotion update listener
    if (this.onEmotionUpdate) {
      this.onEmotionUpdate(data);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('Facial analyzer error:', error);
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * Get emotion statistics
   */
  public getEmotionStatistics() {
    return this.emotionProcessor.getStatistics();
  }

  /**
   * Get emotion history
   */
  public getEmotionHistory() {
    return this.emotionProcessor.getHistory();
  }

  /**
   * Clear emotion history
   */
  public clearHistory(): void {
    this.emotionProcessor.clearHistory();
    this.faceCache.clear();
  }

  /**
   * Get current face cache
   */
  public getFaces(): FaceDetectionResult[] {
    return Array.from(this.faceCache.values());
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stop();
    
    if (this.wsManager) {
      this.wsManager.disconnect();
      this.wsManager = null;
    }

    this.videoElement = null;
    this.canvasElement = null;
    this.canvasContext = null;
    this.faceCache.clear();
  }
}

/**
 * Create a facial analyzer instance
 */
export function createFacialAnalyzer(config: FacialAnalyzerConfig): FacialAnalyzer {
  return new FacialAnalyzer(config);
}

/**
 * Utility function to draw face detection results on canvas
 */
export function drawFaceDetections(
  ctx: CanvasRenderingContext2D,
  faces: FaceDetectionResult[],
  options: {
    drawBoundingBox?: boolean;
    drawLandmarks?: boolean;
    drawEmotions?: boolean;
    boxColor?: string;
    landmarkColor?: string;
    textColor?: string;
    fontSize?: number;
  } = {}
): void {
  const {
    drawBoundingBox = true,
    drawLandmarks = true,
    drawEmotions = true,
    boxColor = '#00ff00',
    landmarkColor = '#ff0000',
    textColor = '#ffffff',
    fontSize = 14
  } = options;

  ctx.save();

  faces.forEach(face => {
    // Draw bounding box
    if (drawBoundingBox) {
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        face.boundingBox.x,
        face.boundingBox.y,
        face.boundingBox.width,
        face.boundingBox.height
      );
    }

    // Draw landmarks
    if (drawLandmarks && face.landmarks) {
      ctx.fillStyle = landmarkColor;
      const landmarks = [
        face.landmarks.leftEye,
        face.landmarks.rightEye,
        face.landmarks.nose,
        face.landmarks.mouth
      ];

      landmarks.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw emotions
    if (drawEmotions && face.emotions.length > 0) {
      ctx.fillStyle = textColor;
      ctx.font = `${fontSize}px Arial`;
      
      // Get top 3 emotions
      const topEmotions = [...face.emotions]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      topEmotions.forEach((emotion, index) => {
        const text = `${emotion.name}: ${(emotion.score * 100).toFixed(1)}%`;
        ctx.fillText(
          text,
          face.boundingBox.x,
          face.boundingBox.y - 10 - (index * (fontSize + 2))
        );
      });

      // Draw confidence
      ctx.fillText(
        `Confidence: ${(face.confidence * 100).toFixed(1)}%`,
        face.boundingBox.x,
        face.boundingBox.y + face.boundingBox.height + fontSize + 5
      );
    }
  });

  ctx.restore();
}