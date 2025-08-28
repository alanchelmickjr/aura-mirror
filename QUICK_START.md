# Aura Mirror - Quick Start Guide ⚡

**Get Aura Mirror running in 5 minutes or less!**

## Prerequisites Check (30 seconds)

```bash
# Check Node.js (need v18+)
node --version

# Check npm (need v9+)
npm --version

# Check Git
git --version
```

**Missing Node.js?** Install from [nodejs.org](https://nodejs.org/) (2 minutes)

## Step 1: Clone & Install (1 minute)

```bash
# Clone the repository
git clone https://github.com/your-org/aura-mirror.git
cd aura-mirror

# Install dependencies
npm install
```

## Step 2: Configure API Keys (1 minute)

```bash
# Copy example environment file
cp .env.example .env.local

# Edit with your favorite editor
nano .env.local  # or vim, code, etc.
```

**Add your API keys:**
```env
HUME_API_KEY=your_hume_api_key_here
HUME_SECRET_KEY=your_hume_secret_key_here
NEXT_PUBLIC_HUME_API_KEY=your_hume_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Need API Keys?**
- Hume AI: [Sign up here](https://beta.hume.ai/sign-up) (2 minutes)
- Anthropic: [Get API key](https://console.anthropic.com/) (1 minute)

## Step 3: Start the Application (30 seconds)

```bash
# Development mode (fastest)
npm run dev

# OR Production mode (optimized)
npm run build && npm start
```

## Step 4: Open in Browser (10 seconds)

Navigate to: **http://localhost:3000**

✅ **That's it! You're running!**

---

## Quick Test Commands

### Test Wake Word
```bash
# Say into your microphone:
"Mirror Mirror on the Wall"
```

### Test Emotion Detection
1. Allow camera access when prompted
2. Smile at the camera
3. Watch your aura change to golden yellow!

### Test Voice Interaction
1. Click the microphone button
2. Say "Hello, how are you?"
3. Listen for the AI response

---

## Essential Configuration

### For Jetson Nano
```bash
# Enable maximum performance
sudo nvpmodel -m 0
sudo jetson_clocks

# Start with optimized settings
NEXT_PUBLIC_VIDEO_FPS=15 npm run dev
```

### For Coofun MicroPC
```bash
# Use hardware acceleration
NEXT_PUBLIC_ENABLE_GPU=true npm run dev
```

### For 90-inch Display
```bash
# Full screen kiosk mode
npm run build
npm start &
chromium-browser --kiosk http://localhost:3000
```

---

## Common Commands Reference

### Development
```bash
npm run dev              # Start development server
npm run build           # Build for production
npm start               # Start production server
npm run lint            # Check code quality
npm test                # Run tests
```

### Process Management
```bash
# Using PM2 (recommended for production)
npm install -g pm2
pm2 start npm --name aura-mirror -- start
pm2 status              # Check status
pm2 logs aura-mirror    # View logs
pm2 restart aura-mirror # Restart
pm2 stop aura-mirror    # Stop
```

### Quick Debugging
```bash
# Check if running
curl http://localhost:3000/api/health

# View logs
tail -f ~/.pm2/logs/aura-mirror-out.log

# Test Hume connection
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.hume.ai/v0/batch/jobs

# Test camera
ls /dev/video*

# Test audio
arecord -l  # List recording devices
aplay -l    # List playback devices
```

---

## Troubleshooting Quick Fixes

### 🔴 "Cannot find module" Error
```bash
rm -rf node_modules package-lock.json
npm install
```

### 🔴 "Port 3000 already in use"
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### 🔴 Camera Not Working
```bash
# Check permissions (Linux/Mac)
ls -la /dev/video*

# Grant permission
sudo chmod 666 /dev/video0

# Browser: Allow camera in site settings
```

### 🔴 Microphone Not Working
```bash
# Test microphone
arecord -d 5 test.wav && aplay test.wav

# Check browser permissions
# Chrome: chrome://settings/content/microphone
```

### 🔴 API Connection Failed
```bash
# Test API keys
node -e "console.log(process.env.HUME_API_KEY)"

# Check network
ping api.hume.ai
ping api.anthropic.com

# Verify .env.local file
cat .env.local | grep -E "HUME|ANTHROPIC"
```

---

## Performance Quick Settings

### Low-End Hardware (< 4GB RAM)
```env
# Add to .env.local
NEXT_PUBLIC_VIDEO_FPS=15
NEXT_PUBLIC_VIDEO_RESOLUTION=720p
NEXT_PUBLIC_EMOTION_SAMPLE_RATE=1
NEXT_PUBLIC_DISABLE_PARTICLES=true
```

### High-End Hardware (> 8GB RAM)
```env
# Add to .env.local
NEXT_PUBLIC_VIDEO_FPS=30
NEXT_PUBLIC_VIDEO_RESOLUTION=1080p
NEXT_PUBLIC_EMOTION_SAMPLE_RATE=5
NEXT_PUBLIC_ENABLE_GPU=true
NEXT_PUBLIC_ENABLE_ADVANCED_EFFECTS=true
```

---

## Quick Deployment Options

### Option 1: Local Network (LAN)
```bash
# Find your IP
ip addr show  # Linux
ipconfig      # Windows

# Start with network access
npm run dev -- -H 0.0.0.0

# Access from other devices
http://YOUR_IP:3000
```

### Option 2: Vercel (Cloud)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts, add environment variables
```

### Option 3: Docker (Container)
```bash
# Build image
docker build -t aura-mirror .

# Run container
docker run -p 3000:3000 \
  --device /dev/video0 \
  --device /dev/snd \
  -e HUME_API_KEY=your_key \
  aura-mirror
```

---

## Quick Feature Toggle

### Enable/Disable Features
```javascript
// config/features.js
export const features = {
  wakeWord: true,          // Voice activation
  facialEmotions: true,    // Camera emotions
  voiceEmotions: true,     // Voice emotions
  backgroundEffects: true,  // Video effects
  particles: true,         // Particle system
  claude: true,           // AI conversation
  debug: false            // Debug mode
};
```

### Quick Mode Switches
```bash
# Demo mode (no API calls)
NEXT_PUBLIC_DEMO_MODE=true npm run dev

# Audio-only mode
NEXT_PUBLIC_VIDEO_DISABLED=true npm run dev

# Silent mode (no audio)
NEXT_PUBLIC_AUDIO_DISABLED=true npm run dev
```

---

## 5-Minute Setup Checklist

- [ ] **0:30** - Check prerequisites
- [ ] **1:00** - Clone and install
- [ ] **2:00** - Get API keys
- [ ] **3:00** - Configure environment
- [ ] **4:00** - Start application
- [ ] **4:30** - Test in browser
- [ ] **5:00** - Verify wake word

**🎉 Congratulations! Aura Mirror is running!**

---

## Next Steps

📖 **Full Documentation:**
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production setup
- [Testing Guide](TESTING_GUIDE.md) - Quality assurance
- [Implementation Guide](IMPLEMENTATION_GUIDE.md) - Technical details

💬 **Get Help:**
- GitHub Issues: [Report bugs](https://github.com/your-org/aura-mirror/issues)
- Discord: [Join community](https://discord.gg/aura-mirror)
- Email: support@aura-mirror.com

🚀 **Enhance Your Setup:**
1. Configure kiosk mode for displays
2. Set up auto-start on boot
3. Enable performance monitoring
4. Add custom wake words
5. Customize emotion colors

---

## Emergency Commands

```bash
# Complete reset
rm -rf node_modules .next package-lock.json
npm install
npm run build
npm start

# Kill all Node processes
pkill -f node

# Clear all caches
rm -rf ~/.npm ~/.cache
npm cache clean --force

# System restart (Linux)
sudo systemctl restart
```

---

**Remember:** The magic is in the mirror! ✨🪞

*Quick Start Guide v1.0.0 - Setup time: 5 minutes or less*