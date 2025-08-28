#!/bin/bash

# Aura Mirror System Testing Script
# Comprehensive testing of all components

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TEST_REPORT=""

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="$PROJECT_DIR/test-report-$(date +%Y%m%d-%H%M%S).txt"
ENV_FILE="$PROJECT_DIR/.env.local"

# Functions
print_test_header() {
    echo
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Testing: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    TEST_REPORT+="\n\n=== Testing: $1 ===\n"
}

test_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
    TEST_REPORT+="[PASS] $1\n"
}

test_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    if [ -n "$2" ]; then
        echo -e "       ${YELLOW}→ $2${NC}"
        TEST_REPORT+="[FAIL] $1 - $2\n"
    else
        TEST_REPORT+="[FAIL] $1\n"
    fi
    ((TESTS_FAILED++))
}

test_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    TEST_REPORT+="[INFO] $1\n"
}

test_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    TEST_REPORT+="[WARN] $1\n"
}

# System Information
gather_system_info() {
    print_test_header "System Information"
    
    test_info "Hostname: $(hostname)"
    test_info "OS: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    test_info "Kernel: $(uname -r)"
    test_info "Architecture: $(uname -m)"
    test_info "CPU: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)"
    test_info "Memory: $(free -h | grep Mem | awk '{print $2}')"
    test_info "Disk: $(df -h "$PROJECT_DIR" | awk 'NR==2 {print $4 " available"}')"
    
    # Check if running on Jetson
    if [ -f /etc/nv_tegra_release ]; then
        test_info "Platform: Jetson Nano"
        test_info "JetPack: $(head -n 1 /etc/nv_tegra_release)"
    fi
}

# Test Node.js and npm
test_nodejs() {
    print_test_header "Node.js Environment"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        test_pass "Node.js installed: $NODE_VERSION"
        
        # Check minimum version (v18)
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1 | cut -d'v' -f2)
        if [ "$NODE_MAJOR" -ge 18 ]; then
            test_pass "Node.js version meets requirements (≥18)"
        else
            test_fail "Node.js version too old" "Required: ≥18, Found: $NODE_VERSION"
        fi
    else
        test_fail "Node.js not installed"
    fi
    
    if command -v npm &> /dev/null; then
        test_pass "npm installed: $(npm -v)"
    else
        test_fail "npm not installed"
    fi
    
    if command -v pnpm &> /dev/null; then
        test_pass "pnpm installed: $(pnpm -v)"
    else
        test_warning "pnpm not installed (recommended)"
    fi
}

# Test environment configuration
test_environment() {
    print_test_header "Environment Configuration"
    
    if [ -f "$ENV_FILE" ]; then
        test_pass "Environment file exists (.env.local)"
        
        # Check for required API keys
        if grep -q "NEXT_PUBLIC_HUME_API_KEY=" "$ENV_FILE"; then
            if grep -q "NEXT_PUBLIC_HUME_API_KEY=your_api_key_here" "$ENV_FILE"; then
                test_fail "Hume API key not configured" "Still using placeholder value"
            else
                test_pass "Hume API key configured"
            fi
        else
            test_fail "Hume API key missing from .env.local"
        fi
        
        if grep -q "NEXT_PUBLIC_HUME_SECRET_KEY=" "$ENV_FILE"; then
            if grep -q "NEXT_PUBLIC_HUME_SECRET_KEY=your_secret_key_here" "$ENV_FILE"; then
                test_fail "Hume secret key not configured" "Still using placeholder value"
            else
                test_pass "Hume secret key configured"
            fi
        else
            test_fail "Hume secret key missing from .env.local"
        fi
        
        # Check wake word configuration
        if grep -q "NEXT_PUBLIC_WAKE_WORD=" "$ENV_FILE"; then
            WAKE_WORD=$(grep "NEXT_PUBLIC_WAKE_WORD=" "$ENV_FILE" | cut -d'=' -f2)
            test_pass "Wake word configured: $WAKE_WORD"
        else
            test_warning "Wake word not configured (using default)"
        fi
    else
        test_fail "Environment file not found" "Create .env.local from .env.example"
    fi
}

# Test Hume API connection
test_hume_api() {
    print_test_header "Hume AI API Connection"
    
    if [ -f "$ENV_FILE" ]; then
        # Extract API key
        API_KEY=$(grep "NEXT_PUBLIC_HUME_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
        
        if [ -n "$API_KEY" ] && [ "$API_KEY" != "your_api_key_here" ]; then
            # Test API connection
            test_info "Testing Hume API connection..."
            
            # Test models endpoint
            RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "X-Hume-Api-Key: $API_KEY" \
                "https://api.hume.ai/v0/batch/models")
            
            if [ "$RESPONSE" = "200" ]; then
                test_pass "Hume API connection successful"
            elif [ "$RESPONSE" = "401" ]; then
                test_fail "Hume API authentication failed" "Invalid API key"
            elif [ "$RESPONSE" = "000" ]; then
                test_fail "Cannot connect to Hume API" "Check internet connection"
            else
                test_fail "Hume API returned error" "HTTP $RESPONSE"
            fi
        else
            test_warning "Skipping API test - API key not configured"
        fi
    else
        test_warning "Skipping API test - Environment file not found"
    fi
}

# Test camera access
test_camera() {
    print_test_header "Camera Access"
    
    # Check for video devices
    if [ -e /dev/video0 ]; then
        test_pass "Camera device found: /dev/video0"
        
        # Check camera permissions
        if [ -r /dev/video0 ]; then
            test_pass "Camera device readable"
        else
            test_fail "Camera device not readable" "Check permissions"
        fi
        
        # Test with v4l2
        if command -v v4l2-ctl &> /dev/null; then
            # Get camera info
            CAMERA_INFO=$(v4l2-ctl --device=/dev/video0 --info 2>&1)
            if [ $? -eq 0 ]; then
                test_pass "Camera accessible via v4l2"
                
                # Get supported formats
                FORMATS=$(v4l2-ctl --device=/dev/video0 --list-formats 2>&1 | grep -c "MJPG\|YUYV")
                if [ "$FORMATS" -gt 0 ]; then
                    test_pass "Camera supports compatible formats"
                else
                    test_warning "Camera format compatibility uncertain"
                fi
            else
                test_fail "Cannot access camera via v4l2"
            fi
        else
            test_warning "v4l2-utils not installed - cannot verify camera"
        fi
        
        # Check for multiple cameras
        CAMERA_COUNT=$(ls /dev/video* 2>/dev/null | wc -l)
        if [ "$CAMERA_COUNT" -gt 1 ]; then
            test_info "Multiple cameras detected: $CAMERA_COUNT devices"
        fi
    else
        test_fail "No camera device found" "Check if camera is connected"
    fi
}

# Test microphone input
test_microphone() {
    print_test_header "Microphone Input"
    
    if command -v arecord &> /dev/null; then
        # List audio capture devices
        CAPTURE_DEVICES=$(arecord -l 2>/dev/null | grep -c "card")
        
        if [ "$CAPTURE_DEVICES" -gt 0 ]; then
            test_pass "Audio capture devices found: $CAPTURE_DEVICES"
            
            # Test default microphone
            test_info "Testing microphone capture (3 seconds)..."
            
            # Try to record 3 seconds of audio
            timeout 3 arecord -d 3 -f cd /tmp/test-audio.wav &> /dev/null
            
            if [ -f /tmp/test-audio.wav ]; then
                FILE_SIZE=$(stat -c%s /tmp/test-audio.wav)
                if [ "$FILE_SIZE" -gt 1000 ]; then
                    test_pass "Microphone capture successful"
                else
                    test_fail "Microphone capture produced empty file"
                fi
                rm -f /tmp/test-audio.wav
            else
                test_fail "Microphone capture failed"
            fi
            
            # Check audio levels
            if command -v amixer &> /dev/null; then
                CAPTURE_LEVEL=$(amixer get Capture 2>/dev/null | grep -o '[0-9]*%' | head -1)
                if [ -n "$CAPTURE_LEVEL" ]; then
                    test_info "Capture level: $CAPTURE_LEVEL"
                    
                    # Check if muted
                    if amixer get Capture 2>/dev/null | grep -q '\[off\]'; then
                        test_warning "Microphone is muted"
                    fi
                fi
            fi
        else
            test_fail "No audio capture devices found"
        fi
    else
        test_fail "alsa-utils not installed" "Install with: sudo apt-get install alsa-utils"
    fi
}

# Test wake word detection
test_wake_word() {
    print_test_header "Wake Word Detection"
    
    # Check if wake word libraries are installed
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        if [ -d "$PROJECT_DIR/node_modules/@tensorflow/tfjs" ]; then
            test_pass "TensorFlow.js installed"
        else
            test_fail "TensorFlow.js not found in node_modules"
        fi
        
        # Check wake word configuration
        if [ -f "$ENV_FILE" ]; then
            WAKE_WORD=$(grep "NEXT_PUBLIC_WAKE_WORD=" "$ENV_FILE" | cut -d'=' -f2)
            THRESHOLD=$(grep "NEXT_PUBLIC_WAKE_WORD_THRESHOLD=" "$ENV_FILE" | cut -d'=' -f2)
            
            if [ -n "$WAKE_WORD" ]; then
                test_pass "Wake word configured: '$WAKE_WORD'"
            else
                test_warning "Wake word not configured"
            fi
            
            if [ -n "$THRESHOLD" ]; then
                test_info "Wake word threshold: $THRESHOLD"
            fi
        fi
        
        # Check if wake word detector file exists
        if [ -f "$PROJECT_DIR/lib/wake-word/detector.ts" ]; then
            test_pass "Wake word detector implementation found"
        else
            test_fail "Wake word detector implementation missing"
        fi
    else
        test_warning "Node modules not installed - cannot verify wake word dependencies"
    fi
}

# Test GPU acceleration
test_gpu() {
    print_test_header "GPU Acceleration"
    
    # Check for NVIDIA GPU
    if command -v nvidia-smi &> /dev/null; then
        if nvidia-smi &> /dev/null; then
            test_pass "NVIDIA GPU detected"
            
            # Get GPU info
            GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
            test_info "GPU: $GPU_NAME"
            
            # Check CUDA
            if [ -d /usr/local/cuda ]; then
                test_pass "CUDA installation found"
                if [ -f /usr/local/cuda/version.txt ]; then
                    CUDA_VERSION=$(cat /usr/local/cuda/version.txt)
                    test_info "CUDA version: $CUDA_VERSION"
                fi
            else
                test_warning "CUDA not found"
            fi
        else
            test_fail "NVIDIA GPU not accessible"
        fi
    elif [ -f /etc/nv_tegra_release ]; then
        # Jetson integrated GPU
        test_pass "Jetson integrated GPU detected"
        
        # Check Jetson stats
        if command -v tegrastats &> /dev/null; then
            test_pass "tegrastats available for GPU monitoring"
        fi
        
        # Check performance mode
        if command -v nvpmodel &> /dev/null; then
            POWER_MODE=$(nvpmodel -q 2>/dev/null | grep "NV Power Mode" | cut -d':' -f2)
            test_info "Power mode:$POWER_MODE"
        fi
    else
        test_warning "No GPU acceleration detected"
        
        # Check if GPU is configured in environment
        if [ -f "$ENV_FILE" ]; then
            USE_GPU=$(grep "NEXT_PUBLIC_USE_GPU=" "$ENV_FILE" | cut -d'=' -f2)
            if [ "$USE_GPU" = "true" ]; then
                test_warning "GPU acceleration enabled in config but no GPU found"
            fi
        fi
    fi
}

# Test network connectivity
test_network() {
    print_test_header "Network Connectivity"
    
    # Test local network
    if ip addr show | grep -q "inet "; then
        test_pass "Network interface configured"
        
        # Get IP address
        IP_ADDR=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{print $2}' | cut -d'/' -f1)
        if [ -n "$IP_ADDR" ]; then
            test_info "IP Address: $IP_ADDR"
        fi
    else
        test_fail "No network interface configured"
    fi
    
    # Test internet connectivity
    if ping -c 1 -W 2 8.8.8.8 &> /dev/null; then
        test_pass "Internet connectivity verified"
    else
        test_fail "No internet connectivity"
    fi
    
    # Test DNS resolution
    if nslookup api.hume.ai &> /dev/null; then
        test_pass "DNS resolution working"
    else
        test_fail "DNS resolution failed"
    fi
    
    # Test required ports
    # Port 3000 for Next.js
    if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
        test_info "Port 3000 is in use (application may be running)"
    else
        test_info "Port 3000 is available"
    fi
}

# Test application build
test_application() {
    print_test_header "Application Status"
    
    # Check if application is built
    if [ -d "$PROJECT_DIR/.next" ]; then
        test_pass "Application build directory exists"
        
        # Check build timestamp
        if [ -f "$PROJECT_DIR/.next/BUILD_ID" ]; then
            BUILD_ID=$(cat "$PROJECT_DIR/.next/BUILD_ID")
            test_info "Build ID: $BUILD_ID"
        fi
    else
        test_warning "Application not built - run 'pnpm build'"
    fi
    
    # Check if application service is running
    if systemctl is-active --quiet aura-mirror.service 2>/dev/null; then
        test_pass "Aura Mirror service is running"
        
        # Check service health
        UPTIME=$(systemctl show aura-mirror.service --property=ActiveEnterTimestamp --value 2>/dev/null)
        if [ -n "$UPTIME" ]; then
            test_info "Service started: $UPTIME"
        fi
    else
        test_info "Aura Mirror service is not running"
    fi
    
    # Test application endpoint
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|302"; then
        test_pass "Application responding on http://localhost:3000"
    else
        test_info "Application not responding on port 3000"
    fi
}

# Test display configuration
test_display() {
    print_test_header "Display Configuration"
    
    # Check if X server is running
    if [ -n "$DISPLAY" ]; then
        test_pass "Display server running: $DISPLAY"
        
        # Check display resolution
        if command -v xrandr &> /dev/null; then
            RESOLUTION=$(xrandr 2>/dev/null | grep '*' | awk '{print $1}' | head -1)
            if [ -n "$RESOLUTION" ]; then
                test_info "Current resolution: $RESOLUTION"
                
                # Check if 4K is supported
                if xrandr 2>/dev/null | grep -q "3840x2160"; then
                    test_pass "4K resolution supported"
                else
                    test_info "4K resolution not detected"
                fi
            fi
        else
            test_warning "xrandr not available - cannot check display"
        fi
    else
        test_warning "No display server detected"
    fi
    
    # Check kiosk mode configuration
    if [ -f "$HOME/start-kiosk.sh" ]; then
        test_pass "Kiosk mode script found"
    else
        test_info "Kiosk mode not configured"
    fi
}

# Performance test
test_performance() {
    print_test_header "System Performance"
    
    # CPU load
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}')
    test_info "Load average:$LOAD_AVG"
    
    # Memory usage
    MEM_USED=$(free -h | grep Mem | awk '{print $3}')
    MEM_TOTAL=$(free -h | grep Mem | awk '{print $2}')
    test_info "Memory usage: $MEM_USED / $MEM_TOTAL"
    
    # Disk usage
    DISK_USAGE=$(df -h "$PROJECT_DIR" | awk 'NR==2 {print $5}')
    test_info "Disk usage: $DISK_USAGE"
    
    # Temperature (if available)
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
        TEMP_C=$((TEMP / 1000))
        if [ "$TEMP_C" -lt 70 ]; then
            test_pass "System temperature: ${TEMP_C}°C"
        else
            test_warning "System temperature high: ${TEMP_C}°C"
        fi
    fi
}

# Generate test report
generate_report() {
    echo
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test Summary${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
    
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo
        echo -e "${GREEN}✓ All tests passed!${NC}"
        OVERALL_STATUS="PASS"
    else
        echo
        echo -e "${YELLOW}⚠ Some tests failed. Review the report for details.${NC}"
        OVERALL_STATUS="FAIL"
    fi
    
    # Write report to file
    {
        echo "Aura Mirror System Test Report"
        echo "Generated: $(date)"
        echo "========================================"
        echo
        echo "Test Summary:"
        echo "  Total Tests: $TOTAL_TESTS"
        echo "  Passed: $TESTS_PASSED"
        echo "  Failed: $TESTS_FAILED"
        echo "  Overall Status: $OVERALL_STATUS"
        echo
        echo "Detailed Results:"
        echo -e "$TEST_REPORT"
    } > "$REPORT_FILE"
    
    echo
    echo -e "${BLUE}Full report saved to: $REPORT_FILE${NC}"
}

# Main test execution
main() {
    echo "======================================"
    echo "   Aura Mirror System Test Suite     "
    echo "======================================"
    echo "Starting comprehensive system tests..."
    echo
    
    # Run all tests
    gather_system_info
    test_nodejs
    test_environment
    test_hume_api
    test_camera
    test_microphone
    test_wake_word
    test_gpu
    test_network
    test_application
    test_display
    test_performance
    
    # Generate report
    generate_report
    
    echo
    echo "======================================"
    echo "   Testing Complete                   "
    echo "======================================"
    
    # Exit with appropriate code
    if [ "$TESTS_FAILED" -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"