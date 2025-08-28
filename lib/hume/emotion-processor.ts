/**
 * Hume AI Emotion Processor
 * Processes emotion data and converts to aura visualizations
 */

import {
  EmotionData,
  EmotionScore,
  EmotionHistory,
  EmotionStatistics,
  AuraColor,
  EmotionToAuraMapping,
  ProsodyData,
  FacialExpression,
} from './types';

// Emotion to Aura Color Mappings
const EMOTION_AURA_MAPPINGS: EmotionToAuraMapping[] = [
  // Positive emotions
  {
    emotion: 'joy',
    colors: {
      primary: '#FFD700', // Gold
      secondary: '#FFA500', // Orange
      accent: '#FFFF00', // Yellow
      intensity: 0.9,
      pulse_rate: 2.0,
    },
    description: 'Bright, warm, and radiant energy',
  },
  {
    emotion: 'admiration',
    colors: {
      primary: '#9370DB', // Medium Purple
      secondary: '#BA55D3', // Medium Orchid
      accent: '#DDA0DD', // Plum
      intensity: 0.8,
      pulse_rate: 1.5,
    },
    description: 'Respectful and appreciative energy',
  },
  {
    emotion: 'amusement',
    colors: {
      primary: '#FF69B4', // Hot Pink
      secondary: '#FFB6C1', // Light Pink
      accent: '#FFC0CB', // Pink
      intensity: 0.85,
      pulse_rate: 2.5,
    },
    description: 'Playful and light-hearted energy',
  },
  {
    emotion: 'contentment',
    colors: {
      primary: '#87CEEB', // Sky Blue
      secondary: '#B0E0E6', // Powder Blue
      accent: '#ADD8E6', // Light Blue
      intensity: 0.7,
      pulse_rate: 1.0,
    },
    description: 'Peaceful and satisfied energy',
  },
  {
    emotion: 'excitement',
    colors: {
      primary: '#FF4500', // Orange Red
      secondary: '#FF6347', // Tomato
      accent: '#FF7F50', // Coral
      intensity: 0.95,
      pulse_rate: 3.0,
    },
    description: 'Energetic and enthusiastic vibration',
  },
  {
    emotion: 'gratitude',
    colors: {
      primary: '#98FB98', // Pale Green
      secondary: '#90EE90', // Light Green
      accent: '#00FA9A', // Medium Spring Green
      intensity: 0.75,
      pulse_rate: 1.2,
    },
    description: 'Appreciative and thankful energy',
  },
  {
    emotion: 'love',
    colors: {
      primary: '#FF1493', // Deep Pink
      secondary: '#FF69B4', // Hot Pink
      accent: '#FFC0CB', // Pink
      intensity: 0.9,
      pulse_rate: 1.8,
    },
    description: 'Warm, compassionate, and connecting energy',
  },
  {
    emotion: 'pride',
    colors: {
      primary: '#4B0082', // Indigo
      secondary: '#6A0DAD', // Purple
      accent: '#8B008B', // Dark Magenta
      intensity: 0.85,
      pulse_rate: 1.5,
    },
    description: 'Confident and accomplished energy',
  },
  
  // Neutral emotions
  {
    emotion: 'calmness',
    colors: {
      primary: '#E0FFFF', // Light Cyan
      secondary: '#F0FFFF', // Azure
      accent: '#F5FFFA', // Mint Cream
      intensity: 0.5,
      pulse_rate: 0.8,
    },
    description: 'Serene and tranquil energy',
  },
  {
    emotion: 'concentration',
    colors: {
      primary: '#4682B4', // Steel Blue
      secondary: '#5F9EA0', // Cadet Blue
      accent: '#6495ED', // Cornflower Blue
      intensity: 0.7,
      pulse_rate: 1.0,
    },
    description: 'Focused and attentive energy',
  },
  {
    emotion: 'contemplation',
    colors: {
      primary: '#708090', // Slate Gray
      secondary: '#778899', // Light Slate Gray
      accent: '#B0C4DE', // Light Steel Blue
      intensity: 0.6,
      pulse_rate: 0.9,
    },
    description: 'Thoughtful and reflective energy',
  },
  {
    emotion: 'interest',
    colors: {
      primary: '#20B2AA', // Light Sea Green
      secondary: '#48D1CC', // Medium Turquoise
      accent: '#40E0D0', // Turquoise
      intensity: 0.75,
      pulse_rate: 1.3,
    },
    description: 'Curious and engaged energy',
  },
  {
    emotion: 'realization',
    colors: {
      primary: '#00CED1', // Dark Turquoise
      secondary: '#00BFFF', // Deep Sky Blue
      accent: '#87CEFA', // Light Sky Blue
      intensity: 0.8,
      pulse_rate: 1.6,
    },
    description: 'Insightful and understanding energy',
  },
  {
    emotion: 'surprise',
    colors: {
      primary: '#FFFF00', // Yellow
      secondary: '#FFD700', // Gold
      accent: '#FFA500', // Orange
      intensity: 0.9,
      pulse_rate: 2.2,
    },
    description: 'Unexpected and alert energy',
  },
  
  // Negative emotions
  {
    emotion: 'anger',
    colors: {
      primary: '#DC143C', // Crimson
      secondary: '#B22222', // Fire Brick
      accent: '#8B0000', // Dark Red
      intensity: 0.95,
      pulse_rate: 2.8,
    },
    description: 'Intense and fiery energy',
  },
  {
    emotion: 'annoyance',
    colors: {
      primary: '#CD5C5C', // Indian Red
      secondary: '#F08080', // Light Coral
      accent: '#FA8072', // Salmon
      intensity: 0.7,
      pulse_rate: 1.8,
    },
    description: 'Irritated and agitated energy',
  },
  {
    emotion: 'anxiety',
    colors: {
      primary: '#8B4513', // Saddle Brown
      secondary: '#A0522D', // Sienna
      accent: '#D2691E', // Chocolate
      intensity: 0.8,
      pulse_rate: 2.5,
    },
    description: 'Nervous and unsettled energy',
  },
  {
    emotion: 'confusion',
    colors: {
      primary: '#696969', // Dim Gray
      secondary: '#808080', // Gray
      accent: '#A9A9A9', // Dark Gray
      intensity: 0.6,
      pulse_rate: 1.5,
    },
    description: 'Unclear and disoriented energy',
  },
  {
    emotion: 'disappointment',
    colors: {
      primary: '#483D8B', // Dark Slate Blue
      secondary: '#6A5ACD', // Slate Blue
      accent: '#7B68EE', // Medium Slate Blue
      intensity: 0.65,
      pulse_rate: 0.9,
    },
    description: 'Let down and discouraged energy',
  },
  {
    emotion: 'disgust',
    colors: {
      primary: '#556B2F', // Dark Olive Green
      secondary: '#6B8E23', // Olive Drab
      accent: '#808000', // Olive
      intensity: 0.75,
      pulse_rate: 1.2,
    },
    description: 'Repelled and aversive energy',
  },
  {
    emotion: 'distress',
    colors: {
      primary: '#8B008B', // Dark Magenta
      secondary: '#9932CC', // Dark Orchid
      accent: '#BA55D3', // Medium Orchid
      intensity: 0.85,
      pulse_rate: 2.0,
    },
    description: 'Troubled and suffering energy',
  },
  {
    emotion: 'embarrassment',
    colors: {
      primary: '#DC143C', // Crimson
      secondary: '#FF69B4', // Hot Pink
      accent: '#FFB6C1', // Light Pink
      intensity: 0.7,
      pulse_rate: 1.6,
    },
    description: 'Self-conscious and flustered energy',
  },
  {
    emotion: 'fear',
    colors: {
      primary: '#2F4F4F', // Dark Slate Gray
      secondary: '#000000', // Black
      accent: '#191970', // Midnight Blue
      intensity: 0.9,
      pulse_rate: 3.0,
    },
    description: 'Fearful and threatened energy',
  },
  {
    emotion: 'guilt',
    colors: {
      primary: '#800020', // Burgundy
      secondary: '#8B0000', // Dark Red
      accent: '#A52A2A', // Brown
      intensity: 0.75,
      pulse_rate: 1.1,
    },
    description: 'Remorseful and responsible energy',
  },
  {
    emotion: 'sadness',
    colors: {
      primary: '#000080', // Navy
      secondary: '#191970', // Midnight Blue
      accent: '#4169E1', // Royal Blue
      intensity: 0.6,
      pulse_rate: 0.7,
    },
    description: 'Melancholic and sorrowful energy',
  },
  {
    emotion: 'shame',
    colors: {
      primary: '#8B4513', // Saddle Brown
      secondary: '#654321', // Dark Brown
      accent: '#3E2723', // Very Dark Brown
      intensity: 0.65,
      pulse_rate: 0.8,
    },
    description: 'Ashamed and diminished energy',
  },
];

export class EmotionProcessor {
  private emotionHistory: EmotionHistory;
  private readonly emotionMappings: Map<string, EmotionToAuraMapping>;
  private readonly smoothingFactor: number = 0.3; // For exponential smoothing
  private previousEmotions: Map<string, number> = new Map();

  constructor(historySize: number = 100, timeWindow?: number) {
    this.emotionHistory = {
      emotions: [],
      maxSize: historySize,
      timeWindow,
    };

    // Create a map for quick emotion lookup
    this.emotionMappings = new Map();
    EMOTION_AURA_MAPPINGS.forEach(mapping => {
      this.emotionMappings.set(mapping.emotion.toLowerCase(), mapping);
    });
  }

  /**
   * Process raw emotion data from Hume
   */
  public processEmotionData(rawEmotions: EmotionScore[]): EmotionData {
    // Normalize scores
    const normalizedEmotions = this.normalizeEmotions(rawEmotions);
    
    // Apply smoothing to reduce jitter
    const smoothedEmotions = this.applySmoothing(normalizedEmotions);
    
    // Find dominant emotion
    const dominantEmotion = this.findDominantEmotion(smoothedEmotions);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(smoothedEmotions);

    const emotionData: EmotionData = {
      emotions: smoothedEmotions,
      timestamp: Date.now(),
      dominantEmotion: dominantEmotion?.name,
      confidence,
    };

    // Add to history
    this.addToHistory(emotionData);

    return emotionData;
  }

  /**
   * Process prosody data and extract emotions
   */
  public processProsodyData(prosody: ProsodyData): EmotionData {
    return this.processEmotionData(prosody.emotions);
  }

  /**
   * Process facial expression data and extract emotions
   */
  public processFacialData(facial: FacialExpression): EmotionData {
    return this.processEmotionData(facial.emotions);
  }

  /**
   * Combine multiple emotion sources
   */
  public combineEmotionSources(
    sources: Array<{ data: EmotionData; weight: number }>
  ): EmotionData {
    const combinedScores = new Map<string, number>();
    let totalWeight = 0;

    // Combine weighted scores
    sources.forEach(({ data, weight }) => {
      totalWeight += weight;
      data.emotions.forEach(emotion => {
        const current = combinedScores.get(emotion.name) || 0;
        combinedScores.set(emotion.name, current + emotion.score * weight);
      });
    });

    // Normalize by total weight
    const normalizedEmotions: EmotionScore[] = [];
    combinedScores.forEach((score, name) => {
      normalizedEmotions.push({
        name,
        score: score / totalWeight,
      });
    });

    return this.processEmotionData(normalizedEmotions);
  }

  /**
   * Convert emotion to aura colors
   */
  public emotionToAura(emotionData: EmotionData): AuraColor {
    if (!emotionData.dominantEmotion) {
      // Return neutral aura if no dominant emotion
      return {
        primary: '#FFFFFF',
        secondary: '#F0F0F0',
        intensity: 0.3,
        pulse_rate: 1.0,
      };
    }

    const mapping = this.emotionMappings.get(emotionData.dominantEmotion.toLowerCase());
    
    if (!mapping) {
      // Return default aura for unknown emotions
      return {
        primary: '#808080',
        secondary: '#A0A0A0',
        intensity: 0.5,
        pulse_rate: 1.0,
      };
    }

    // Adjust intensity based on confidence
    const adjustedColors = { ...mapping.colors };
    adjustedColors.intensity *= (emotionData.confidence || 1);

    return adjustedColors;
  }

  /**
   * Get emotion statistics from history
   */
  public getStatistics(): EmotionStatistics | null {
    if (this.emotionHistory.emotions.length === 0) {
      return null;
    }

    const emotionSums = new Map<string, number>();
    const emotionCounts = new Map<string, number>();
    const emotionVariances = new Map<string, number[]>();

    // Calculate sums and counts
    this.emotionHistory.emotions.forEach(data => {
      data.emotions.forEach(emotion => {
        const currentSum = emotionSums.get(emotion.name) || 0;
        const currentCount = emotionCounts.get(emotion.name) || 0;
        const variances = emotionVariances.get(emotion.name) || [];
        
        emotionSums.set(emotion.name, currentSum + emotion.score);
        emotionCounts.set(emotion.name, currentCount + 1);
        variances.push(emotion.score);
        emotionVariances.set(emotion.name, variances);
      });
    });

    // Calculate means
    const means: Record<string, number> = {};
    emotionSums.forEach((sum, name) => {
      const count = emotionCounts.get(name) || 1;
      means[name] = sum / count;
    });

    // Calculate variances
    const variances: Record<string, number> = {};
    emotionVariances.forEach((scores, name) => {
      const mean = means[name];
      const variance = scores.reduce((acc, score) => {
        return acc + Math.pow(score - mean, 2);
      }, 0) / scores.length;
      variances[name] = variance;
    });

    // Find dominant emotion
    let dominantEmotion = '';
    let maxMean = 0;
    Object.entries(means).forEach(([name, mean]) => {
      if (mean > maxMean) {
        maxMean = mean;
        dominantEmotion = name;
      }
    });

    // Calculate stability (inverse of average variance)
    const avgVariance = Object.values(variances).reduce((a, b) => a + b, 0) / Object.values(variances).length;
    const stability = 1 / (1 + avgVariance);

    // Calculate volatility (rate of change)
    let volatility = 0;
    if (this.emotionHistory.emotions.length > 1) {
      for (let i = 1; i < this.emotionHistory.emotions.length; i++) {
        const prev = this.emotionHistory.emotions[i - 1];
        const curr = this.emotionHistory.emotions[i];
        
        let change = 0;
        curr.emotions.forEach(emotion => {
          const prevScore = prev.emotions.find(e => e.name === emotion.name)?.score || 0;
          change += Math.abs(emotion.score - prevScore);
        });
        
        volatility += change;
      }
      volatility /= (this.emotionHistory.emotions.length - 1);
    }

    return {
      mean: means,
      variance: variances,
      dominant: dominantEmotion,
      stability,
      volatility,
    };
  }

  /**
   * Clear emotion history
   */
  public clearHistory(): void {
    this.emotionHistory.emotions = [];
    this.previousEmotions.clear();
  }

  /**
   * Get emotion history
   */
  public getHistory(): EmotionHistory {
    return { ...this.emotionHistory };
  }

  // ============= Private Methods =============

  private normalizeEmotions(emotions: EmotionScore[]): EmotionScore[] {
    const total = emotions.reduce((sum, e) => sum + e.score, 0);
    
    if (total === 0) {
      return emotions;
    }

    return emotions.map(e => ({
      name: e.name,
      score: e.score / total,
    }));
  }

  private applySmoothing(emotions: EmotionScore[]): EmotionScore[] {
    return emotions.map(emotion => {
      const previousScore = this.previousEmotions.get(emotion.name) || emotion.score;
      const smoothedScore = this.smoothingFactor * emotion.score + (1 - this.smoothingFactor) * previousScore;
      
      this.previousEmotions.set(emotion.name, smoothedScore);
      
      return {
        name: emotion.name,
        score: smoothedScore,
      };
    });
  }

  private findDominantEmotion(emotions: EmotionScore[]): EmotionScore | null {
    if (emotions.length === 0) {
      return null;
    }

    return emotions.reduce((max, current) => 
      current.score > max.score ? current : max
    );
  }

  private calculateConfidence(emotions: EmotionScore[]): number {
    if (emotions.length === 0) {
      return 0;
    }

    // Confidence is based on how much the dominant emotion stands out
    const sorted = [...emotions].sort((a, b) => b.score - a.score);
    
    if (sorted.length === 1) {
      return sorted[0].score;
    }

    // Calculate the difference between top two emotions
    const difference = sorted[0].score - sorted[1].score;
    
    // Normalize to 0-1 range
    return Math.min(1, difference * 2 + sorted[0].score * 0.5);
  }

  private addToHistory(emotionData: EmotionData): void {
    // Add to history
    this.emotionHistory.emotions.push(emotionData);

    // Remove old entries if exceeding max size
    if (this.emotionHistory.emotions.length > this.emotionHistory.maxSize) {
      this.emotionHistory.emotions.shift();
    }

    // Remove entries outside time window if specified
    if (this.emotionHistory.timeWindow) {
      const cutoffTime = Date.now() - this.emotionHistory.timeWindow;
      this.emotionHistory.emotions = this.emotionHistory.emotions.filter(
        e => e.timestamp >= cutoffTime
      );
    }
  }
}

// Export default processor instance
export const defaultEmotionProcessor = new EmotionProcessor();

// Export emotion mappings for external use
export { EMOTION_AURA_MAPPINGS };