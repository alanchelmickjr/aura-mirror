#!/bin/bash

# Aura Mirror Deployment Script
# Supports both Jetson Nano and Coofun microPC deployment

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_VERSION="20"
PLATFORM=""

# Functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Detect platform
detect_platform() {
    echo "Detecting platform..."
    
    if [ -f /etc/nv_tegra_release ]; then
        PLATFORM="jetson"
        print_status "Detected Jetson Nano platform"
    elif [ -f /proc/device-tree/model ] && grep -q "Coofun" /proc/device-tree/model 2>/dev/null; then
        PLATFORM="coofun"
        print_status "Detected Coofun microPC platform"
    else
        # Default to generic Linux
        PLATFORM="generic"
        print_status "Detected generic Linux platform"
    fi
}

# Check system requirements
check_requirements() {
    echo "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "This script requires Linux. Current OS: $OSTYPE"
    fi
    
    # Check memory
    MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_GB=$((MEM_TOTAL / 1024 / 1024))
    if [ $MEM_GB -lt 2 ]; then
        print_warning "Low memory detected: ${MEM_GB}GB. Minimum 4GB recommended."
    else
        print_status "Memory check passed: ${MEM_GB}GB"
    fi
    
    # Check disk space
    DISK_AVAILABLE=$(df "$PROJECT_DIR" | awk 'NR==2 {print $4}')
    DISK_GB=$((DISK_AVAILABLE / 1024 / 1024))
    if [ $DISK_GB -lt 5 ]; then
        print_error "Insufficient disk space: ${DISK_GB}GB. Minimum 5GB required."
    else
        print_status "Disk space check passed: ${DISK_GB}GB available"
    fi
    
    # Check internet connection
    if ping -c 1 google.com &> /dev/null; then
        print_status "Internet connection verified"
    else
        print_error "No internet connection detected"
    fi
}

# Install system dependencies
install_system_deps() {
    echo "Installing system dependencies..."
    
    # Update package lists
    sudo apt-get update
    
    # Install common dependencies
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        v4l-utils \
        alsa-utils \
        chromium-browser \
        unclutter \
        xdotool \
        x11-xserver-utils
    
    # Platform-specific dependencies
    if [ "$PLATFORM" == "jetson" ]; then
        print_status "Installing Jetson-specific dependencies..."
        # CUDA and TensorFlow dependencies handled in setup-jetson.sh
    fi
    
    print_status "System dependencies installed"
}

# Install Node.js
install_nodejs() {
    echo "Installing Node.js..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
            print_status "Node.js v$NODE_CURRENT already installed"
            return
        fi
    fi
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Install pnpm
    npm install -g pnpm
    
    print_status "Node.js $(node -v) and pnpm installed"
}

# Setup environment variables
setup_environment() {
    echo "Setting up environment variables..."
    
    ENV_FILE="$PROJECT_DIR/.env.local"
    
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env.local not found. Creating from template..."
        
        cat > "$ENV_FILE" << EOF
# Hume AI Configuration
NEXT_PUBLIC_HUME_API_KEY=your_api_key_here
NEXT_PUBLIC_HUME_SECRET_KEY=your_secret_key_here

# Wake Word Configuration
NEXT_PUBLIC_WAKE_WORD=mirror
NEXT_PUBLIC_WAKE_WORD_THRESHOLD=0.5

# Display Configuration
NEXT_PUBLIC_DISPLAY_WIDTH=1920
NEXT_PUBLIC_DISPLAY_HEIGHT=1080
NEXT_PUBLIC_FULLSCREEN=true

# Performance Configuration
NEXT_PUBLIC_USE_GPU=${USE_GPU:-false}
NEXT_PUBLIC_VIDEO_FPS=30
NEXT_PUBLIC_EMOTION_UPDATE_INTERVAL=100

# Debug Configuration
NEXT_PUBLIC_DEBUG_MODE=false
EOF
        
        print_warning "Please edit $ENV_FILE and add your API keys"
        read -p "Press Enter after adding API keys to continue..."
    else
        print_status "Environment file found"
    fi
    
    # Verify API keys are set
    if grep -q "your_api_key_here" "$ENV_FILE"; then
        print_error "API keys not configured in .env.local"
    fi
}

# Install project dependencies
install_dependencies() {
    echo "Installing project dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Clean install
    rm -rf node_modules .next
    
    # Install dependencies
    pnpm install
    
    print_status "Project dependencies installed"
}

# Build application
build_application() {
    echo "Building application..."
    
    cd "$PROJECT_DIR"
    
    # Set build environment based on platform
    if [ "$PLATFORM" == "jetson" ]; then
        export NEXT_PUBLIC_USE_GPU=true
    fi
    
    # Build Next.js application
    pnpm build
    
    print_status "Application built successfully"
}

# Configure auto-start
configure_autostart() {
    echo "Configuring auto-start..."
    
    # Create systemd service
    sudo tee /etc/systemd/system/aura-mirror.service > /dev/null << EOF
[Unit]
Description=Aura Mirror Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="NODE_ENV=production"
Environment="DISPLAY=:0"
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable service
    sudo systemctl daemon-reload
    sudo systemctl enable aura-mirror.service
    
    print_status "Auto-start configured"
}

# Setup kiosk mode
setup_kiosk() {
    echo "Setting up kiosk mode..."
    
    # Run kiosk setup script
    if [ -f "$PROJECT_DIR/scripts/setup-kiosk.sh" ]; then
        bash "$PROJECT_DIR/scripts/setup-kiosk.sh"
    else
        print_warning "Kiosk setup script not found"
    fi
}

# Platform-specific setup
platform_setup() {
    if [ "$PLATFORM" == "jetson" ]; then
        echo "Running Jetson-specific setup..."
        if [ -f "$PROJECT_DIR/scripts/setup-jetson.sh" ]; then
            bash "$PROJECT_DIR/scripts/setup-jetson.sh"
        fi
    elif [ "$PLATFORM" == "coofun" ]; then
        echo "Configuring Coofun microPC..."
        # Coofun-specific optimizations
        
        # Enable hardware acceleration
        export CHROMIUM_FLAGS="--enable-features=VaapiVideoDecoder --use-gl=egl"
        
        # Set performance governor
        echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
    fi
}

# Start application
start_application() {
    echo "Starting Aura Mirror application..."
    
    # Stop any existing instance
    sudo systemctl stop aura-mirror.service 2>/dev/null || true
    
    # Start service
    sudo systemctl start aura-mirror.service
    
    # Check status
    sleep 5
    if sudo systemctl is-active --quiet aura-mirror.service; then
        print_status "Aura Mirror is running"
        print_status "Access the application at http://localhost:3000"
    else
        print_error "Failed to start Aura Mirror"
        sudo journalctl -u aura-mirror.service -n 50
    fi
}

# Main deployment flow
main() {
    echo "======================================"
    echo "   Aura Mirror Deployment Script     "
    echo "======================================"
    echo
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --skip-kiosk)
                SKIP_KIOSK=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --platform [jetson|coofun|generic]  Specify platform"
                echo "  --skip-kiosk                        Skip kiosk mode setup"
                echo "  --help                              Show this help"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run deployment steps
    detect_platform
    check_requirements
    install_system_deps
    install_nodejs
    setup_environment
    install_dependencies
    build_application
    platform_setup
    configure_autostart
    
    if [ "$SKIP_KIOSK" != "true" ]; then
        setup_kiosk
    fi
    
    start_application
    
    echo
    echo "======================================"
    echo "   Deployment Complete!               "
    echo "======================================"
    echo
    print_status "Aura Mirror has been successfully deployed"
    print_status "The application will start automatically on boot"
    echo
    echo "Next steps:"
    echo "1. Run ./scripts/test-system.sh to verify all components"
    echo "2. Reboot the system to test auto-start"
    echo "3. Check logs: sudo journalctl -u aura-mirror.service -f"
    echo
}

# Run main function
main "$@"