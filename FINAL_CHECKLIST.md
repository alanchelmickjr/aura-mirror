# Aura Mirror - Final Deployment Checklist

## 📋 Pre-Deployment Verification

### 1. Hardware Requirements
- [ ] **Display**: 90-inch display connected and tested
  - [ ] Display supports 4K resolution (3840x2160)
  - [ ] HDMI or DisplayPort cable connected
  - [ ] Display powered on and input selected
- [ ] **Camera**: USB camera connected
  - [ ] Camera positioned at appropriate height
  - [ ] Camera has clear view of standing area
  - [ ] Camera tested with `ls /dev/video*`
- [ ] **Microphone**: Audio input device connected
  - [ ] Microphone positioned for optimal voice capture
  - [ ] Microphone tested with `arecord -l`
- [ ] **Computing Device**: 
  - [ ] Jetson Nano OR Coofun microPC prepared
  - [ ] Minimum 4GB RAM available
  - [ ] Minimum 16GB storage available
  - [ ] Adequate cooling/ventilation provided

### 2. Software Requirements
- [ ] **Operating System**:
  - [ ] Ubuntu 20.04 LTS or newer installed
  - [ ] System fully updated: `sudo apt update && sudo apt upgrade`
- [ ] **Node.js Environment**:
  - [ ] Node.js v18+ installed
  - [ ] pnpm package manager installed
  - [ ] Verified with: `node -v && pnpm -v`
- [ ] **System Packages**:
  - [ ] Chromium browser installed
  - [ ] Audio/video utilities installed (v4l-utils, alsa-utils)
  - [ ] Git installed for updates

### 3. Network Requirements
- [ ] **Internet Connection**:
  - [ ] Stable broadband connection (minimum 10 Mbps)
  - [ ] Low latency connection (<100ms to api.hume.ai)
  - [ ] Firewall allows HTTPS traffic
- [ ] **Network Configuration**:
  - [ ] Static IP configured (optional but recommended)
  - [ ] Port 3000 available for application
  - [ ] WebSocket connections allowed

## 🔑 API Key Configuration

### 1. Hume AI Credentials
- [ ] **Obtain API Keys**:
  - [ ] Sign up at https://www.hume.ai
  - [ ] Create new project in Hume dashboard
  - [ ] Generate API key and secret key
  - [ ] Copy keys to secure location

### 2. Configure Environment
- [ ] **Create .env.local file**:
  ```bash
  cp .env.example .env.local
  ```
- [ ] **Add API Keys**:
  ```env
  NEXT_PUBLIC_HUME_API_KEY=your_actual_api_key_here
  NEXT_PUBLIC_HUME_SECRET_KEY=your_actual_secret_key_here
  ```
- [ ] **Configure Wake Word**:
  ```env
  NEXT_PUBLIC_WAKE_WORD=mirror
  NEXT_PUBLIC_WAKE_WORD_THRESHOLD=0.5
  ```
- [ ] **Set Display Configuration**:
  ```env
  NEXT_PUBLIC_DISPLAY_WIDTH=3840
  NEXT_PUBLIC_DISPLAY_HEIGHT=2160
  NEXT_PUBLIC_FULLSCREEN=true
  ```
- [ ] **Verify no placeholder values remain**

## 🚀 Deployment Steps

### 1. Initial Setup
- [ ] **Clone Repository** (if not already done):
  ```bash
  git clone https://github.com/your-repo/aura-mirror.git
  cd aura-mirror
  ```
- [ ] **Install Dependencies**:
  ```bash
  pnpm install
  ```
- [ ] **Build Application**:
  ```bash
  pnpm build
  ```

### 2. Run Deployment Script
- [ ] **Make scripts executable**:
  ```bash
  chmod +x scripts/*.sh
  ```
- [ ] **Run main deployment**:
  ```bash
  sudo ./scripts/deploy.sh
  ```
- [ ] **Platform-specific setup** (if applicable):
  - [ ] Jetson Nano: `sudo ./scripts/setup-jetson.sh`
  - [ ] Generic Linux: Continue with standard setup

### 3. Configure Kiosk Mode
- [ ] **Run kiosk setup**:
  ```bash
  sudo ./scripts/setup-kiosk.sh
  ```
- [ ] **Verify kiosk configuration**:
  - [ ] Auto-login enabled
  - [ ] Chromium starts in full-screen
  - [ ] Cursor hidden
  - [ ] Screen saver disabled
  - [ ] Keyboard shortcuts disabled

## 🧪 Testing Procedures

### 1. Component Testing
- [ ] **Run system test suite**:
  ```bash
  ./scripts/test-system.sh
  ```
- [ ] **Review test report**:
  - [ ] All critical tests pass
  - [ ] Note any warnings for future attention
  - [ ] Save test report for documentation

### 2. Manual Testing
- [ ] **Camera Test**:
  - [ ] Stand in front of mirror
  - [ ] Verify face detection works
  - [ ] Check emotion detection updates
- [ ] **Voice Test**:
  - [ ] Say wake word "Hey Mirror" (or configured word)
  - [ ] Verify wake word detection indicator
  - [ ] Test voice interaction
- [ ] **Display Test**:
  - [ ] Verify full-screen display
  - [ ] Check visualization renders correctly
  - [ ] Confirm no UI elements visible
- [ ] **Performance Test**:
  - [ ] Monitor CPU usage: `top`
  - [ ] Check memory usage: `free -h`
  - [ ] Verify smooth operation

### 3. Integration Testing
- [ ] **End-to-End Test**:
  - [ ] Approach mirror
  - [ ] Verify face detection triggers
  - [ ] Say wake word
  - [ ] Interact with voice commands
  - [ ] Verify emotion visualization updates
  - [ ] Step away and verify idle state

## 🎯 Go-Live Steps

### 1. Final Preparations
- [ ] **System Optimization**:
  - [ ] Disable unnecessary services
  - [ ] Set performance CPU governor
  - [ ] Configure swap if needed (especially Jetson)
- [ ] **Security**:
  - [ ] Change default passwords
  - [ ] Disable SSH if not needed
  - [ ] Configure firewall rules
- [ ] **Backup Configuration**:
  - [ ] Backup .env.local file
  - [ ] Document any custom settings
  - [ ] Create system restore point

### 2. Launch Application
- [ ] **Start Services**:
  ```bash
  sudo systemctl start aura-mirror.service
  sudo systemctl start aura-mirror-kiosk.service
  ```
- [ ] **Verify Auto-Start**:
  ```bash
  sudo systemctl enable aura-mirror.service
  sudo systemctl enable aura-mirror-kiosk.service
  ```
- [ ] **Test Reboot**:
  ```bash
  sudo reboot
  ```
- [ ] **Confirm Auto-Launch**:
  - [ ] System boots directly to mirror interface
  - [ ] No manual intervention required
  - [ ] Application starts within 30 seconds

### 3. Final Verification
- [ ] **Check All Services**:
  ```bash
  sudo systemctl status aura-mirror.service
  sudo systemctl status aura-mirror-kiosk.service
  ```
- [ ] **Monitor Logs**:
  ```bash
  sudo journalctl -u aura-mirror.service -f
  ```
- [ ] **Performance Check**:
  - [ ] Run for 30 minutes continuously
  - [ ] Monitor temperature (especially Jetson)
  - [ ] Check for memory leaks
  - [ ] Verify stable operation

## 📊 Post-Deployment Monitoring

### 1. Immediate Monitoring (First 24 Hours)
- [ ] **System Health**:
  - [ ] CPU temperature within limits
  - [ ] Memory usage stable
  - [ ] No service crashes
- [ ] **Application Performance**:
  - [ ] Response time acceptable
  - [ ] Emotion detection accurate
  - [ ] Voice recognition working
- [ ] **User Experience**:
  - [ ] Smooth animations
  - [ ] Quick wake word response
  - [ ] No visual glitches

### 2. Ongoing Monitoring
- [ ] **Daily Checks**:
  - [ ] Review system logs
  - [ ] Check service status
  - [ ] Monitor disk space
- [ ] **Weekly Maintenance**:
  - [ ] Clear temporary files
  - [ ] Check for updates
  - [ ] Review error logs
- [ ] **Monthly Tasks**:
  - [ ] System updates
  - [ ] Performance optimization
  - [ ] Backup configuration

## 🛠️ Troubleshooting Quick Reference

### Common Issues and Solutions

1. **Application Won't Start**
   - Check logs: `sudo journalctl -u aura-mirror.service -n 50`
   - Verify .env.local exists and has valid API keys
   - Ensure port 3000 is not in use

2. **Camera Not Working**
   - Check device: `ls /dev/video*`
   - Test with: `v4l2-ctl --device=/dev/video0 --info`
   - Verify permissions: `sudo usermod -a -G video $USER`

3. **No Audio Input**
   - List devices: `arecord -l`
   - Check mixer: `alsamixer`
   - Test recording: `arecord -d 5 test.wav`

4. **Display Issues**
   - Check resolution: `xrandr`
   - Restart display manager: `sudo systemctl restart lightdm`
   - Verify kiosk script: `~/start-kiosk.sh`

5. **Performance Problems**
   - Check resources: `htop`
   - Monitor GPU (Jetson): `tegrastats`
   - Review logs for errors

## 📝 Documentation

### Required Documentation
- [ ] **System Configuration**:
  - [ ] Hardware specifications documented
  - [ ] Network configuration recorded
  - [ ] Software versions noted
- [ ] **Operational Procedures**:
  - [ ] Startup procedure documented
  - [ ] Shutdown procedure documented
  - [ ] Emergency recovery steps
- [ ] **Maintenance Schedule**:
  - [ ] Daily check procedures
  - [ ] Weekly maintenance tasks
  - [ ] Monthly update schedule

### Support Information
- [ ] **Contact Information**:
  - [ ] Technical support contacts
  - [ ] Hume AI support resources
  - [ ] Hardware vendor contacts
- [ ] **Resources**:
  - [ ] Project repository URL
  - [ ] Documentation links
  - [ ] Community forums

## ✅ Sign-Off

### Deployment Completion
- [ ] All checklist items completed
- [ ] System fully operational
- [ ] Documentation complete
- [ ] Handover completed

**Deployed By**: _______________________  
**Date**: _______________________  
**Version**: _______________________  
**Notes**: _______________________

---

## 🚨 Emergency Procedures

### System Recovery
If the system becomes unresponsive:

1. **Exit Kiosk Mode** (via SSH):
   ```bash
   ~/exit-kiosk.sh
   ```

2. **Restart Services**:
   ```bash
   sudo systemctl restart aura-mirror.service
   sudo systemctl restart aura-mirror-kiosk.service
   ```

3. **Full System Restart**:
   ```bash
   sudo reboot
   ```

4. **Factory Reset** (if needed):
   ```bash
   cd /path/to/aura-mirror
   git reset --hard HEAD
   pnpm install
   pnpm build
   sudo ./scripts/deploy.sh
   ```

### Support Contacts
- GitHub Issues: [your-repo-issues-url]
- Email Support: [support-email]
- Documentation: [docs-url]

---

*This checklist ensures a successful deployment of the Aura Mirror system. Complete each section thoroughly and keep this document for future reference.*