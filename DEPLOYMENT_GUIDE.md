# Aura Mirror - Deployment Guide 🚀

## Table of Contents
- [System Requirements](#system-requirements)
- [Hardware Setup](#hardware-setup)
- [Software Installation](#software-installation)
- [Environment Configuration](#environment-configuration)
- [Building the Application](#building-the-application)
- [Kiosk Mode Setup](#kiosk-mode-setup)
- [Performance Optimization](#performance-optimization)
- [Auto-Start Configuration](#auto-start-configuration)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Jetson Nano Requirements
- **Model**: NVIDIA Jetson Nano Developer Kit (4GB recommended)
- **Storage**: Minimum 32GB microSD card (64GB recommended)
- **Power**: 5V⎓4A power adapter (barrel jack)
- **Cooling**: Active cooling fan required
- **Network**: Ethernet or WiFi adapter
- **Camera**: USB webcam or CSI camera module
- **Audio**: USB audio interface or 3.5mm jack

### Coofun MicroPC Requirements
- **Model**: Coofun Mini PC with Intel N100/N5105 or better
- **RAM**: Minimum 8GB DDR4
- **Storage**: 128GB SSD minimum
- **OS**: Ubuntu 22.04 LTS or Windows 11
- **GPU**: Intel UHD Graphics (hardware acceleration support)
- **Ports**: USB 3.0 for camera, HDMI 2.0 for display
- **Network**: Gigabit Ethernet or WiFi 6

### 90-inch Display Requirements
- **Resolution**: 4K (3840x2160) recommended, 1080p minimum
- **Input**: HDMI 2.0 or DisplayPort 1.4
- **Refresh Rate**: 60Hz minimum
- **Response Time**: <5ms for real-time interaction
- **Mounting**: Commercial-grade wall mount or stand

## Hardware Setup

### 1. Jetson Nano Setup

```bash
# Flash JetPack OS to microSD card
# Download from: https://developer.nvidia.com/embedded/jetpack

# Initial boot configuration
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm git build-essential cmake

# Install Node.js 18+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Enable maximum performance mode
sudo nvpmodel -m 0
sudo jetson_clocks

# Install camera drivers (if using CSI camera)
sudo apt install -y v4l-utils
v4l2-ctl --list-devices
```

### 2. Coofun MicroPC Setup

```bash
# For Ubuntu 22.04 LTS
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome/Chromium for kiosk mode
sudo snap install chromium

# For Windows 11
# Install Node.js from https://nodejs.org
# Install Git from https://git-scm.com
# Install Chrome from https://google.com/chrome
```

### 3. Display Configuration

```bash
# Set display resolution (Ubuntu/Jetson)
xrandr --output HDMI-1 --mode 3840x2160 --rate 60

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Configure overscan if needed
xrandr --output HDMI-1 --set underscan on --set "underscan hborder" 40 --set "underscan vborder" 25
```

## Software Installation

### 1. Clone Repository

```bash
# Create deployment directory
mkdir -p ~/aura-mirror-deployment
cd ~/aura-mirror-deployment

# Clone the repository
git clone https://github.com/your-org/aura-mirror.git
cd aura-mirror

# Install dependencies
npm install --production
```

### 2. Install Additional Dependencies

```bash
# Install PM2 for process management
sudo npm install -g pm2

# Install system dependencies for camera/audio
sudo apt install -y \
  libgstreamer1.0-0 \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  libgstrtspserver-1.0-0 \
  v4l-utils \
  pulseaudio \
  alsa-utils
```

### 3. TensorFlow.js GPU Support

```bash
# For Jetson Nano - Install CUDA support
sudo apt install -y nvidia-cuda-toolkit

# Set environment variables
echo 'export CUDA_HOME=/usr/local/cuda' >> ~/.bashrc
echo 'export PATH=$PATH:$CUDA_HOME/bin' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$CUDA_HOME/lib64' >> ~/.bashrc
source ~/.bashrc

# Verify CUDA installation
nvcc --version
```

## Environment Configuration

### 1. Create Production Environment File

```bash
# Create .env.production.local
cat > .env.production.local << 'EOF'
# Hume AI Configuration
HUME_API_KEY=your_production_api_key
HUME_SECRET_KEY=your_production_secret_key
NEXT_PUBLIC_HUME_API_KEY=your_production_api_key
NEXT_PUBLIC_HUME_CONFIG_ID=your_config_id

# Claude API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key

# Application Settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_MOCK_MODE=false

# Performance Settings
NEXT_PUBLIC_VIDEO_FPS=30
NEXT_PUBLIC_EMOTION_SAMPLE_RATE=3
NEXT_PUBLIC_ENABLE_GPU=true
NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS=10

# Wake Word Configuration
NEXT_PUBLIC_WAKE_WORD="mirror mirror on the wall"
NEXT_PUBLIC_WAKE_WORD_SENSITIVITY=0.7
NEXT_PUBLIC_WAKE_WORD_TIMEOUT=30000

# Display Settings
NEXT_PUBLIC_DISPLAY_WIDTH=3840
NEXT_PUBLIC_DISPLAY_HEIGHT=2160
NEXT_PUBLIC_FULLSCREEN=true
NEXT_PUBLIC_CURSOR_HIDDEN=true
EOF
```

### 2. Configure API Keys

```bash
# Secure the environment file
chmod 600 .env.production.local

# Create backup
cp .env.production.local .env.production.backup
```

## Building the Application

### 1. Production Build

```bash
# Clean previous builds
rm -rf .next node_modules/.cache

# Install dependencies
npm ci --production=false

# Build for production
npm run build

# Optimize build for specific hardware
# For Jetson Nano
NEXT_PUBLIC_TARGET_DEVICE=jetson npm run build

# For Coofun MicroPC
NEXT_PUBLIC_TARGET_DEVICE=x86_64 npm run build
```

### 2. Static Asset Optimization

```bash
# Compress static assets
find .next/static -type f \( -name "*.js" -o -name "*.css" \) -exec gzip -9 -k {} \;

# Generate WebP images for faster loading
for img in public/*.{jpg,png}; do
  cwebp -q 80 "$img" -o "${img%.*}.webp"
done
```

## Kiosk Mode Setup

### 1. Create Kiosk Script

```bash
# Create kiosk launcher script
cat > ~/aura-mirror-kiosk.sh << 'EOF'
#!/bin/bash

# Kill any existing Chrome instances
pkill -f chromium

# Wait for network
while ! ping -c 1 google.com &> /dev/null; do
  sleep 1
done

# Start the Next.js application
cd ~/aura-mirror-deployment/aura-mirror
pm2 start npm --name "aura-mirror" -- start

# Wait for application to start
sleep 10

# Launch in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --check-for-update-interval=604800 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-translate \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-features=TranslateUI \
  --disk-cache-dir=/tmp/chromium-cache \
  --password-store=basic \
  --use-gl=egl \
  --enable-features=VaapiVideoDecoder \
  --ignore-gpu-blocklist \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  http://localhost:3000
EOF

chmod +x ~/aura-mirror-kiosk.sh
```

### 2. Configure Display Manager

```bash
# For LightDM (Ubuntu/Jetson)
sudo tee /etc/lightdm/lightdm.conf.d/50-aura-mirror.conf << EOF
[Seat:*]
autologin-user=aura
autologin-user-timeout=0
user-session=aura-mirror
EOF

# Create custom session
sudo tee /usr/share/xsessions/aura-mirror.desktop << EOF
[Desktop Entry]
Name=Aura Mirror Kiosk
Comment=Start Aura Mirror in kiosk mode
Exec=/home/aura/aura-mirror-kiosk.sh
Type=Application
EOF
```

## Performance Optimization

### 1. Jetson Nano Optimization

```bash
# Enable maximum performance
sudo nvpmodel -m 0
sudo jetson_clocks --fan

# Configure swap for better memory management
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize kernel parameters
sudo tee -a /etc/sysctl.conf << EOF
vm.swappiness=10
vm.vfs_cache_pressure=50
net.core.rmem_max=134217728
net.core.wmem_max=134217728
EOF
sudo sysctl -p
```

### 2. Application Performance Settings

```javascript
// next.config.mjs - Production optimizations
export default {
  reactStrictMode: false, // Disable in production for performance
  swcMinify: true,
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/*'],
  },
  images: {
    unoptimized: true, // For kiosk mode with local assets
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test(module) {
              return module.size() > 160000;
            },
            name(module) {
              const hash = crypto.createHash('sha1');
              hash.update(module.identifier());
              return hash.digest('hex').substring(0, 8);
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
};
```

### 3. Browser Performance Flags

```bash
# Additional Chrome flags for performance
--enable-accelerated-2d-canvas
--enable-accelerated-video-decode
--enable-native-gpu-memory-buffers
--enable-features=CanvasOopRasterization
--disable-background-timer-throttling
--disable-renderer-backgrounding
--disable-features=TranslateUI,BlinkGenPropertyTrees
--max-active-webgl-contexts=16
--webgl-antialiasing-mode=none
--disable-two-dimensional-scrolling
```

## Auto-Start Configuration

### 1. PM2 Startup Configuration

```bash
# Configure PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER
# Copy and run the command output

# Save PM2 configuration
cd ~/aura-mirror-deployment/aura-mirror
pm2 start ecosystem.config.js
pm2 save

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'aura-mirror',
    script: 'npm',
    args: 'start',
    cwd: '/home/aura/aura-mirror-deployment/aura-mirror',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/aura-mirror/error.log',
    out_file: '/var/log/aura-mirror/out.log',
    log_file: '/var/log/aura-mirror/combined.log',
    time: true,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    kill_timeout: 5000
  }]
};
EOF
```

### 2. Systemd Service (Alternative)

```bash
# Create systemd service
sudo tee /etc/systemd/system/aura-mirror.service << EOF
[Unit]
Description=Aura Mirror Application
After=network.target

[Service]
Type=simple
User=aura
WorkingDirectory=/home/aura/aura-mirror-deployment/aura-mirror
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:/var/log/aura-mirror/output.log
StandardError=append:/var/log/aura-mirror/error.log
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable aura-mirror.service
sudo systemctl start aura-mirror.service
```

### 3. Auto-Login Configuration

```bash
# For Ubuntu/Jetson with GDM3
sudo tee /etc/gdm3/custom.conf << EOF
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=aura
EOF

# Create dedicated user for kiosk
sudo useradd -m -s /bin/bash aura
sudo usermod -aG video,audio,input aura
sudo passwd aura  # Set a secure password
```

## Monitoring & Maintenance

### 1. Health Check Script

```bash
# Create health check script
cat > ~/aura-mirror-health.sh << 'EOF'
#!/bin/bash

# Check if application is running
if ! pm2 status aura-mirror | grep -q "online"; then
  echo "Application not running, restarting..."
  pm2 restart aura-mirror
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
if (( $(echo "$MEM_USAGE > 90" | bc -l) )); then
  echo "High memory usage: ${MEM_USAGE}%"
  pm2 restart aura-mirror
fi

# Check if display is connected
if ! xrandr | grep -q " connected"; then
  echo "Display not connected!"
  # Send alert or take action
fi

# Check camera availability
if ! ls /dev/video* 2>/dev/null; then
  echo "No camera detected!"
fi

# Check network connectivity
if ! ping -c 1 api.hume.ai &> /dev/null; then
  echo "Cannot reach Hume AI API"
fi

# Log status
echo "$(date): Health check completed" >> /var/log/aura-mirror/health.log
EOF

chmod +x ~/aura-mirror-health.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/aura/aura-mirror-health.sh") | crontab -
```

### 2. Log Rotation

```bash
# Configure log rotation
sudo tee /etc/logrotate.d/aura-mirror << EOF
/var/log/aura-mirror/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 aura aura
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### 3. Remote Monitoring

```bash
# Install monitoring agent (optional)
npm install --save @sentry/nextjs

# Configure Sentry for error tracking
cat > sentry.client.config.js << 'EOF'
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
EOF
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Application Won't Start

```bash
# Check logs
pm2 logs aura-mirror --lines 100

# Check port availability
sudo lsof -i :3000

# Verify environment variables
npm run env:check

# Rebuild application
rm -rf .next node_modules
npm install
npm run build
```

#### 2. Camera Not Working

```bash
# List available cameras
v4l2-ctl --list-devices

# Test camera
ffmpeg -f v4l2 -i /dev/video0 -frames 1 test.jpg

# Check permissions
ls -la /dev/video*
sudo usermod -aG video $USER

# Reset camera module
sudo modprobe -r uvcvideo
sudo modprobe uvcvideo
```

#### 3. Poor Performance

```bash
# Check system resources
htop
nvidia-smi  # For Jetson

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable cups

# Clear cache
rm -rf /tmp/chromium-cache
pm2 flush

# Reduce video quality in .env
NEXT_PUBLIC_VIDEO_FPS=15
NEXT_PUBLIC_VIDEO_RESOLUTION=720p
```

#### 4. Display Issues

```bash
# Reset display settings
xrandr --auto

# Check HDMI connection
for i in /sys/class/drm/*/status; do 
  echo "$i: $(cat $i)"
done

# Force resolution
xrandr --output HDMI-1 --mode 1920x1080 --rate 60

# Disable compositing
gsettings set org.gnome.desktop.interface enable-animations false
```

#### 5. Network Connectivity

```bash
# Test API endpoints
curl -I https://api.hume.ai/v0/health
curl -I https://api.anthropic.com/health

# Check DNS
nslookup api.hume.ai
nslookup api.anthropic.com

# Restart network
sudo systemctl restart NetworkManager

# Configure static IP (optional)
sudo nmcli con mod "Wired connection 1" ipv4.addresses 192.168.1.100/24
sudo nmcli con mod "Wired connection 1" ipv4.gateway 192.168.1.1
sudo nmcli con mod "Wired connection 1" ipv4.dns "8.8.8.8 8.8.4.4"
sudo nmcli con mod "Wired connection 1" ipv4.method manual
```

#### 6. Audio Issues

```bash
# List audio devices
aplay -l
arecord -l

# Test audio output
speaker-test -c 2

# Test microphone
arecord -d 5 test.wav && aplay test.wav

# Set default audio device
pacmd list-sinks
pacmd set-default-sink <sink_name>

# Adjust volume
amixer set Master 80%
amixer set Capture 70%
```

### Emergency Recovery

```bash
# Create recovery script
cat > ~/emergency-recovery.sh << 'EOF'
#!/bin/bash

echo "Starting emergency recovery..."

# Stop all services
pm2 kill
pkill -f chromium
pkill -f node

# Clear all caches
rm -rf ~/.cache/chromium
rm -rf /tmp/*
rm -rf .next

# Reset environment
cd ~/aura-mirror-deployment/aura-mirror
git reset --hard HEAD
git pull origin main

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild application
npm run build

# Restart services
pm2 start ecosystem.config.js
sleep 10
~/aura-mirror-kiosk.sh

echo "Recovery complete!"
EOF

chmod +x ~/emergency-recovery.sh
```

### Performance Benchmarks

Expected performance metrics on different hardware:

| Hardware | FPS | Latency | CPU Usage | RAM Usage | GPU Usage |
|----------|-----|---------|-----------|-----------|-----------|
| Jetson Nano 4GB | 25-30 | 120ms | 60-70% | 2.5GB | 40-50% |
| Coofun N100 | 30-35 | 80ms | 40-50% | 3GB | 30-40% |
| Coofun N5105 | 35-40 | 60ms | 30-40% | 2.8GB | 25-35% |

### Support Resources

- **Hume AI Documentation**: https://dev.hume.ai
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Jetson Forums**: https://forums.developer.nvidia.com/c/agx-autonomous-machines/jetson-embedded-systems
- **PM2 Documentation**: https://pm2.keymetrics.io/docs

---

## Quick Deployment Checklist

- [ ] Hardware connected and powered
- [ ] Operating system updated
- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Application built successfully
- [ ] Camera and audio tested
- [ ] Display configured correctly
- [ ] Kiosk mode script created
- [ ] Auto-start configured
- [ ] Health monitoring active
- [ ] Performance optimized
- [ ] Backup created

---

*Last Updated: 2024*
*Version: 1.0.0*