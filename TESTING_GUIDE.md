
# Aura Mirror - Testing Guide 🧪

## Table of Contents
- [Pre-Deployment Testing Checklist](#pre-deployment-testing-checklist)
- [Wake Word Detection Testing](#wake-word-detection-testing)
- [Hume.ai Integration Testing](#humeai-integration-testing)
- [Conversation Flow Testing](#conversation-flow-testing)
- [Performance Benchmarks](#performance-benchmarks)
- [Multi-Modal Emotion Testing](#multi-modal-emotion-testing)
- [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)
- [User Acceptance Testing](#user-acceptance-testing)
- [Automated Testing Suite](#automated-testing-suite)
- [Load Testing](#load-testing)
- [Debugging Tools](#debugging-tools)

## Pre-Deployment Testing Checklist

### System Requirements Verification

```bash
# Check Node.js version
node --version  # Should be 18.0.0 or higher

# Check npm version
npm --version  # Should be 9.0.0 or higher

# Check available memory
free -h  # Minimum 4GB RAM recommended

# Check GPU availability (Jetson Nano)
nvidia-smi  # Should show GPU info

# Check camera devices
ls /dev/video*  # Should list camera devices

# Check audio devices
arecord -l  # Should list recording devices
aplay -l    # Should list playback devices
```

### Environment Configuration Test

```bash
# Test environment variables
npm run test:env

# Create test script
cat > test-env.js << 'EOF'
const required = [
  'HUME_API_KEY',
  'HUME_SECRET_KEY',
  'NEXT_PUBLIC_HUME_API_KEY',
  'ANTHROPIC_API_KEY'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing environment variables:', missing);
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
}
EOF

node test-env.js
```

### Build Verification

```bash
# Clean build test
rm -rf .next node_modules/.cache
npm run build

# Check build output
du -sh .next  # Should be under 100MB
ls -la .next/static/chunks  # Verify chunk generation
```

## Wake Word Detection Testing

### 1. Basic Wake Word Test

```javascript
// test/wake-word.test.js
import { WakeWordDetector } from '@/lib/wake-word/detector';

describe('Wake Word Detection', () => {
  let detector;

  beforeEach(() => {
    detector = new WakeWordDetector({
      wakeWord: 'mirror mirror on the wall',
      sensitivity: 0.7,
      timeout: 30000
    });
  });

  test('should detect exact wake word', async () => {
    const result = await detector.detectPhrase('mirror mirror on the wall');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should handle variations', async () => {
    const variations = [
      'Mirror Mirror on the wall',
      'mirror, mirror on the wall',
      'mirror mirror, on the wall'
    ];

    for (const phrase of variations) {
      const result = await detector.detectPhrase(phrase);
      expect(result.detected).toBe(true);
    }
  });

  test('should reject incorrect phrases', async () => {
    const incorrect = [
      'hello world',
      'mirror on the wall',
      'mirror mirror'
    ];

    for (const phrase of incorrect) {
      const result = await detector.detectPhrase(phrase);
      expect(result.detected).toBe(false);
    }
  });
});
```

### 2. Manual Wake Word Testing

```bash
# Create wake word test script
cat > test-wake-word.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Wake Word Test</title>
</head>
<body>
  <h1>Wake Word Detection Test</h1>
  <button id="start">Start Listening</button>
  <div id="status">Ready</div>
  <div id="transcript"></div>
  
  <script>
    const wakeWord = 'mirror mirror on the wall';
    let recognition;

    document.getElementById('start').onclick = () => {
      recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ')
          .toLowerCase();
        
        document.getElementById('transcript').innerText = transcript;
        
        if (transcript.includes(wakeWord)) {
          document.getElementById('status').innerText = '✅ Wake word detected!';
          document.getElementById('status').style.color = 'green';
        }
      };
      
      recognition.start();
      document.getElementById('status').innerText = 'Listening...';
    };
  </script>
</body>
</html>
EOF

# Open in browser for testing
python3 -m http.server 8080
# Navigate to http://localhost:8080/test-wake-word.html
```

### 3. Wake Word Performance Metrics

| Test Case | Expected Result | Acceptable Range |
|-----------|----------------|------------------|
| Detection Latency | <500ms | 300-500ms |
| False Positive Rate | <5% | 0-5% |
| True Positive Rate | >95% | 95-100% |
| Background Noise Tolerance | 60dB | 50-70dB |
| Distance from Microphone | 3 meters | 1-5 meters |

## Hume.ai Integration Testing

### 1. API Connection Test

```javascript
// test/hume-connection.test.js
import { HumeClient } from 'hume';

describe('Hume AI Connection', () => {
  let client;

  beforeAll(() => {
    client = new HumeClient({
      apiKey: process.env.HUME_API_KEY,
      secretKey: process.env.HUME_SECRET_KEY
    });
  });

  test('should authenticate successfully', async () => {
    const token = await client.getAccessToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(0);
  });

  test('should connect to WebSocket', async () => {
    const socket = await client.expressionMeasurement.stream.connect({
      config: {
        face: { fps: 3 },
        prosody: { granularity: 'utterance' }
      }
    });

    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.close();
  });
});
```

### 2. Facial Expression Testing

```bash
# Create facial expression test
cat > test-facial.js << 'EOF'
const { HumeWebSocketManager } = require('./lib/hume/websocket-manager');

async function testFacialDetection() {
  const manager = new HumeWebSocketManager();
  
  manager.onEmotion((frame) => {
    console.log('Detected emotions:', frame.face?.emotions);
    console.log('Top emotion:', frame.face?.emotions[0]);
  });

  await manager.connect();
  
  // Send test video frame
  const testVideo = document.createElement('video');
  testVideo.src = 'test-video.mp4';
  
  setTimeout(async () => {
    const blob = await captureFrame(testVideo);
    await manager.sendVideo(blob);
  }, 1000);
}

testFacialDetection();
EOF
```

### 3. EVI2 Voice Testing

```javascript
// test/evi-voice.test.js
describe('EVI2 Voice Interface', () => {
  test('should initialize voice provider', () => {
    const { status } = useVoice();
    expect(['connecting', 'connected']).toContain(status.value);
  });

  test('should process audio input', async () => {
    const { sendAudioInput } = useVoice();
    const audioData = new Uint8Array(1024);
    
    await sendAudioInput(audioData);
    // Check for response
  });

  test('should handle prosody analysis', async () => {
    const { messages } = useVoice();
    
    // Send test audio
    await sendTestAudio();
    
    // Wait for prosody results
    await waitFor(() => {
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.models?.prosody).toBeDefined();
    });
  });
});
```

### 4. Vocal Burst Detection Test

```bash
# Test vocal burst detection
cat > test-vocal-bursts.js << 'EOF'
const vocalBursts = [
  { file: 'laugh.wav', expected: 'amusement' },
  { file: 'gasp.wav', expected: 'surprise' },
  { file: 'sigh.wav', expected: 'tiredness' },
  { file: 'hmm.wav', expected: 'thinking' }
];

async function testVocalBursts() {
  for (const burst of vocalBursts) {
    const audio = await loadAudioFile(burst.file);
    const result = await analyzeVocalBurst(audio);
    
    console.log(`Testing ${burst.file}:`);
    console.log(`  Expected: ${burst.expected}`);
    console.log(`  Detected: ${result.emotion}`);
    console.log(`  Confidence: ${result.confidence}`);
  }
}
EOF
```

## Conversation Flow Testing

### 1. Claude Integration Test

```javascript
// test/claude-conversation.test.js
import Anthropic from '@anthropic-ai/sdk';

describe('Claude Conversation Flow', () => {
  let anthropic;

  beforeAll(() => {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  });

  test('should respond to emotional context', async () => {
    const emotionalContext = {
      primary: 'sadness',
      intensity: 0.7,
      secondary: ['loneliness', 'tiredness']
    };

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      messages: [{
        role: 'user',
        content: `Emotional context: ${JSON.stringify(emotionalContext)}. User says: "I'm not feeling great today."`
      }],
      system: 'You are an empathetic AI assistant responding to emotional cues.'
    });

    expect(response.content[0].text).toContain('understand');
    expect(response.content[0].text.length).toBeGreaterThan(50);
  });
});
```

### 2. Conversation State Machine Test

```javascript
// test/conversation-state.test.js
describe('Conversation State Machine', () => {
  const states = {
    IDLE: 'idle',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    RESPONDING: 'responding',
    ERROR: 'error'
  };

  test('should transition through states correctly', () => {
    let currentState = states.IDLE;
    
    // Wake word detected
    currentState = states.LISTENING;
    expect(currentState).toBe(states.LISTENING);
    
    // User speaks
    currentState = states.PROCESSING;
    expect(currentState).toBe(states.PROCESSING);
    
    // AI responds
    currentState = states.RESPONDING;
    expect(currentState).toBe(states.RESPONDING);
    
    // Complete
    currentState = states.IDLE;
    expect(currentState).toBe(states.IDLE);
  });
});
```

### 3. End-to-End Conversation Test

```bash
# Create E2E conversation test
cat > test-conversation-e2e.sh << 'EOF'
#!/bin/bash

echo "Starting E2E Conversation Test..."

# Test scenarios
scenarios=(
  "Hello, how are you today?"
  "Tell me a joke"
  "I'm feeling happy"
  "What's the weather like?"
  "Goodbye"
)

for scenario in "${scenarios[@]}"; do
  echo "Testing: $scenario"
  
  # Trigger wake word
  echo "Saying: Mirror mirror on the wall"
  sleep 2
  
  # Send user input
  curl -X POST http://localhost:3000/api/conversation \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$scenario\", \"emotion\": \"neutral\"}"
  
  echo "---"
  sleep 3
done
EOF

chmod +x test-conversation-e2e.sh
```

## Performance Benchmarks

### 1. FPS Testing

```javascript
// test/performance-fps.js
class FPSMonitor {
  constructor() {
    this.frames = 0;
    this.startTime = performance.now();
    this.fps = 0;
  }

  tick() {
    this.frames++;
    const elapsed = performance.now() - this.startTime;
    
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.startTime = performance.now();
      return this.fps;
    }
    return null;
  }
}

// Usage in render loop
const fpsMonitor = new FPSMonitor();

function renderLoop() {
  const fps = fpsMonitor.tick();
  if (fps !== null) {
    console.log(`FPS: ${fps}`);
    
    // Assert minimum FPS
    if (fps < 25) {
      console.warn('⚠️ FPS below threshold:', fps);
    }
  }
  
  requestAnimationFrame(renderLoop);
}
```

### 2. Latency Testing

```javascript
// test/latency.test.js
describe('System Latency', () => {
  test('emotion detection latency', async () => {
    const start = performance.now();
    
    // Send frame for analysis
    await sendVideoFrame(testFrame);
    
    // Wait for emotion result
    const result = await waitForEmotionResult();
    
    const latency = performance.now() - start;
    console.log(`Emotion detection latency: ${latency}ms`);
    
    expect(latency).toBeLessThan(100);
  });

  test('voice response latency', async () => {
    const start = performance.now();
    
    // Send audio
    await sendAudioChunk(testAudio);
    
    // Wait for response
    const response = await waitForVoiceResponse();
    
    const latency = performance.now() - start;
    console.log(`Voice response latency: ${latency}ms`);
    
    expect(latency).toBeLessThan(200);
  });
});
```

### 3. Memory Usage Testing

```bash
# Monitor memory usage
cat > monitor-memory.sh << 'EOF'
#!/bin/bash

echo "Monitoring memory usage..."
echo "Time,RSS,VSZ,CPU" > memory-log.csv

while true; do
  STATS=$(ps aux | grep "node.*next" | grep -v grep | awk '{print $6","$5","$3}')
  TIMESTAMP=$(date +%s)
  echo "$TIMESTAMP,$STATS" >> memory-log.csv
  
  # Check if memory exceeds threshold
  RSS=$(echo $STATS | cut -d',' -f1)
  if [ "$RSS" -gt "2097152" ]; then  # 2GB in KB
    echo "⚠️ High memory usage: ${RSS}KB"
  fi
  
  sleep 5
done
EOF

chmod +x monitor-memory.sh
```

### 4. GPU Utilization (Jetson Nano)

```bash
# Monitor GPU usage
nvidia-smi dmon -s pucvmet -d 5 > gpu-usage.log &

# Parse results
cat > parse-gpu.py << 'EOF'
import pandas as pd

df = pd.read_csv('gpu-usage.log', sep='\s+', skiprows=1)
print(f"Average GPU Utilization: {df['gpu'].mean():.2f}%")
print(f"Average Memory Usage: {df['mem'].mean():.2f}%")
print(f"Peak Temperature: {df['temp'].max()}°C")
EOF

python3 parse-gpu.py
```

## Multi-Modal Emotion Testing

### 1. Emotion Fusion Test

```javascript
// test/emotion-fusion.test.js
describe('Multi-Modal Emotion Fusion', () => {
  test('should combine facial and voice emotions', () => {
    const facialEmotions = [
      { name: 'joy', score: 0.7 },
      { name: 'surprise', score: 0.3 }
    ];
    
    const voiceEmotions = [
      { name: 'excitement', score: 0.8 },
      { name: 'joy', score: 0.2 }
    ];
    
    const fused = fuseEmotions(facialEmotions, voiceEmotions);
    
    // Joy should be reinforced
    expect(fused[0].name).toBe('joy');
    expect(fused[0].score).toBeGreaterThan(0.7);
  });

  test('should handle conflicting emotions', () => {
    const facialEmotions = [
      { name: 'sadness', score: 0.8 }
    ];
    
    const voiceEmotions = [
      { name: 'joy', score: 0.7 }
    ];
    
    const fused = fuseEmotions(facialEmotions, voiceEmotions);
    
    // Should identify conflict
    expect(fused.conflict).toBe(true);
    expect(fused.confidence).toBeLessThan(0.5);
  });
});
```

### 2. Emotion Accuracy Test

```bash
# Create emotion accuracy test
cat > test-emotion-accuracy.js << 'EOF'
const testCases = [
  {
    video: 'happy-face.mp4',
    audio: 'happy-voice.wav',
    expected: 'joy',
    minConfidence: 0.7
  },
  {
    video: 'sad-face.mp4',
    audio: 'sad-voice.wav',
    expected: 'sadness',
    minConfidence: 0.6
  },
  {
    video: 'angry-face.mp4',
    audio: 'angry-voice.wav',
    expected: 'anger',
    minConfidence: 0.65
  }
];

async function testEmotionAccuracy() {
  let correct = 0;
  
  for (const testCase of testCases) {
    const result = await analyzeMultiModal(
      testCase.video,
      testCase.audio
    );
    
    const detected = result.emotions[0];
    
    console.log(`Test: ${testCase.expected}`);
    console.log(`  Detected: ${detected.name} (${detected.score})`);
    
    if (detected.name === testCase.expected && 
        detected.score >= testCase.minConfidence) {
      correct++;
      console.log('  ✅ PASS');
    } else {
      console.log('  ❌ FAIL');
    }
  }
  
  const accuracy = (correct / testCases.length) * 100;
  console.log(`\nOverall Accuracy: ${accuracy}%`);
}
EOF
```

## Edge Cases & Error Scenarios

### 1. Network Failure Recovery

```javascript
// test/network-recovery.test.js
describe('Network Recovery', () => {
  test('should reconnect after network failure', async () => {
    const manager = new HumeWebSocketManager();
    await manager.connect();
    
    // Simulate network failure
    manager.socket.close();
    
    // Wait for reconnection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Should be reconnected
    expect(manager.socket.readyState).toBe(WebSocket.OPEN);
  });

  test('should queue messages during disconnection', async () => {
    const queue = [];
    
    // Disconnect
    mockNetworkFailure();
    
    // Try to send messages
    queue.push(sendMessage('test1'));
    queue.push(sendMessage('test2'));
    
    // Reconnect
    mockNetworkRestore();
    
    // Messages should be sent
    const results = await Promise.all(queue);
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

### 2. Camera/Microphone Failure

```javascript
// test/media-failure.test.js
describe('Media Device Failures', () => {
  test('should handle camera disconnection', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
    // Simulate camera disconnection
    stream.getTracks().forEach(track => track.stop());
    
    // Should detect and attempt recovery
    const recovered = await attemptCameraRecovery();
    expect(recovered).toBe(true);
  });

  test('should fallback to audio-only mode', async () => {
    // Simulate camera failure
    mockCameraFailure();
    
    // System should continue with audio only
    const mode = await getOperatingMode();
    expect(mode).toBe('audio-only');
  });
});
```

### 3. API Rate Limiting

```javascript
// test/rate-limiting.test.js
describe('API Rate Limiting', () => {
  test('should handle rate limit errors', async () => {
    // Send many requests quickly
    const requests = Array(100).fill(null).map(() => 
      sendEmotionData(testData)
    );
    
    const results = await Promise.allSettled(requests);
    
    // Some should be rate limited
    const rateLimited = results.filter(r => 
      r.status === 'rejected' && 
      r.reason.code === 429
    );
    
    expect(rateLimited.length).toBeGreaterThan(0);
    
    // Should implement backoff
    await sleep(1000);
    const retry = await sendEmotionData(testData);
    expect(retry.success).toBe(true);
  });
});
```

### 4. Memory Leak Detection

```javascript
// test/memory-leak.test.js
describe('Memory Leak Detection', () => {
  test('should not leak memory over time', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Run intensive operations
    for (let i = 0; i < 1000; i++) {
      await processVideoFrame(testFrame);
      await processAudioChunk(testAudio);
      
      // Force garbage collection if available
      if (global.gc) global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const increase = finalMemory - initialMemory;
    
    // Memory increase should be minimal
    expect(increase).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
});
```

## User Acceptance Testing

### 1. User Experience Checklist

```markdown
## UX Testing Checklist

### Initial Setup
- [ ] Clear instructions displayed
- [ ] Permission prompts are understandable
- [ ] Loading indicators work correctly
- [ ] Error messages are helpful

### Wake Word Interaction
- [ ] Wake word is clearly indicated
- [ ] Visual feedback when listening
- [ ] Audio feedback when detected
- [ ] Timeout handling is smooth

### Emotion Display
- [ ] Aura colors are visually appealing
- [ ] Transitions are smooth
- [ ] Particle effects render correctly
- [ ] Mirror frame displays properly

### Voice Interaction
- [ ] Voice is clear and natural
- [ ] Response time feels immediate
- [ ] Conversation flows naturally
- [ ] Interruption handling works

### Error Handling
- [ ] Graceful degradation when camera fails
- [ ] Clear messages for network issues
- [ ] Recovery is automatic when possible
- [ ] Manual recovery options available
```

### 2. Accessibility Testing

```javascript
// test/accessibility.test.js
describe('Accessibility', () => {
  test('should support screen readers', () => {
    const elements = document.querySelectorAll('[aria-label]');
    expect(elements.length).toBeGreaterThan(0);
    
    // Check ARIA roles
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      expect(button.getAttribute('role')).toBeDefined();
    });
  });

  test('should support keyboard navigation', () => {
    // Tab through interface
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    expect(focusableElements.length).toBeGreaterThan(0);
    
    // Check tab order
    focusableElements.forEach(element => {
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex) {
        expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
```

### 3. User Testing Scenarios

```markdown
## User Testing Scenarios

### Scenario 1: First Time User
1. User approaches the mirror
2. System displays welcome message
3. User says wake word
4. System responds and guides through features
5. User explores different emotions
6. System provides appropriate feedback

### Scenario 2: Daily Check-in
1. User greets the mirror
2. Mirror recognizes returning user
3. User shares how they're feeling
4. Mirror provides empathetic response
5. Conversation continues naturally
6. User ends interaction positively

### Scenario 3: Technical Difficulties
1. Camera fails to initialize
2. System provides clear error message
3. User follows troubleshooting steps
4. System recovers or provides alternatives
5. User can still interact via voice

### Scenario 4: Multiple Users
1. First user interacts with mirror
2. Second user approaches
3. System handles transition smoothly
4. Each user gets personalized experience
5. Privacy is maintained
```

## Automated Testing Suite

### 1. Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### 2. Test Runner Script

```bash
# Create test runner
cat > run-tests.sh << 'EOF'
#!/bin/bash

echo "🧪 Running Aura Mirror Test Suite"
echo "================================"

# Unit tests
echo "Running unit tests..."
npm run test:unit

# Integration tests
echo "Running integration tests..."
npm run test:integration

# E2E tests
echo "Running E2E tests..."
npm run test:e2e

# Performance tests
echo "Running performance tests..."
npm run test:performance

# Generate coverage report
echo "Generating coverage report..."
npm run test:coverage

# Check coverage thresholds
if [ $? -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed. Check the output above."
  exit 1
fi
EOF

chmod +x run-tests.sh
```

### 3. CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run tests
      run: npm test
      env:
        HUME_API_KEY: ${{ secrets.HUME_API_KEY }}
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Load Testing

### 1. Stress Test Configuration

```javascript
// test/load-test.js
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp to 20
    { duration: '5m', target: 20 },  // Stay at 20
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  // Test emotion detection endpoint
  const emotionData = {
    image: 'base64_encoded_image',
    timestamp: Date.now(),
  };
  
  const response = http.post(
    'http://localhost:3000/api/emotion',
    JSON.stringify(emotionData),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has emotion data': (r) => JSON.parse(r.body).emotions !== undefined,
  });
}
```

### 2. Concurrent User Testing

```bash
# Test concurrent connections
cat > test-concurrent.sh << 'EOF'
#!/bin/bash

echo "Testing concurrent connections..."

# Start multiple client connections
for i in {1..10}; do
  (
    echo "Client $i connecting..."
    node test-client.js --id=$i &
  )
done

# Monitor for 5 minutes
sleep 300

# Check results
echo "Checking results..."
grep "ERROR" test-client-*.log && echo "❌ Errors found" || echo "✅ No errors"
grep "SUCCESS" test-client-*.log | wc -l | xargs echo "Successful connections:"
EOF

chmod +x test-concurrent.sh
```

## Debugging Tools

### 1. Debug Mode Configuration

```javascript
// lib/debug