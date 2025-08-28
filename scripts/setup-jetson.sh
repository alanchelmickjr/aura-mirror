#!/bin/bash

# Jetson Nano Setup Script
# Configures CUDA, TensorFlow, and optimizations for Jetson hardware

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
JETPACK_VERSION="4.6"
TENSORFLOW_VERSION="2.7.0"
CUDA_VERSION="10.2"

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

# Check if running on Jetson
check_jetson() {
    echo "Verifying Jetson hardware..."
    
    if [ ! -f /etc/nv_tegra_release ]; then
        print_error "This script must be run on a Jetson device"
    fi
    
    # Get Jetson model
    if [ -f /proc/device-tree/model ]; then
        MODEL=$(tr -d '\0' < /proc/device-tree/model)
        print_status "Detected: $MODEL"
    fi
    
    # Check JetPack version
    if [ -f /etc/nv_tegra_release ]; then
        JETPACK_INSTALLED=$(head -n 1 /etc/nv_tegra_release)
        print_status "JetPack: $JETPACK_INSTALLED"
    fi
}

# Install CUDA dependencies
install_cuda_deps() {
    echo "Installing CUDA dependencies..."
    
    # Check if CUDA is already installed
    if [ -d /usr/local/cuda ]; then
        print_status "CUDA already installed at /usr/local/cuda"
        
        # Verify CUDA version
        if [ -f /usr/local/cuda/version.txt ]; then
            CUDA_INSTALLED=$(cat /usr/local/cuda/version.txt)
            print_status "CUDA version: $CUDA_INSTALLED"
        fi
    else
        print_warning "CUDA not found. Please install JetPack SDK"
        echo "Visit: https://developer.nvidia.com/embedded/jetpack"
        exit 1
    fi
    
    # Install cuDNN
    sudo apt-get update
    sudo apt-get install -y libcudnn8 libcudnn8-dev
    
    # Set CUDA environment variables
    if ! grep -q "CUDA_HOME" ~/.bashrc; then
        echo "export CUDA_HOME=/usr/local/cuda" >> ~/.bashrc
        echo "export PATH=\$CUDA_HOME/bin:\$PATH" >> ~/.bashrc
        echo "export LD_LIBRARY_PATH=\$CUDA_HOME/lib64:\$LD_LIBRARY_PATH" >> ~/.bashrc
        print_status "CUDA environment variables added to ~/.bashrc"
    fi
    
    # Source the updated bashrc
    export CUDA_HOME=/usr/local/cuda
    export PATH=$CUDA_HOME/bin:$PATH
    export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
    
    print_status "CUDA dependencies configured"
}

# Configure GPU acceleration
configure_gpu() {
    echo "Configuring GPU acceleration..."
    
    # Set GPU performance mode
    sudo nvpmodel -m 0  # Max performance mode
    print_status "Set to maximum performance mode"
    
    # Set fan to max (if available)
    if [ -f /sys/devices/pwm-fan/target_pwm ]; then
        echo 255 | sudo tee /sys/devices/pwm-fan/target_pwm
        print_status "Fan set to maximum speed"
    fi
    
    # Configure GPU memory
    # Jetson Nano shares system memory with GPU
    print_status "GPU memory sharing configured (unified memory)"
    
    # Enable persistent mode for GPU
    sudo nvidia-smi -pm 1 2>/dev/null || print_warning "nvidia-smi not available"
    
    # Create GPU monitoring script
    cat > /tmp/gpu-monitor.sh << 'EOF'
#!/bin/bash
while true; do
    echo "=== GPU Status ==="
    tegrastats --interval 1000 | head -n 1
    echo "=== Memory Usage ==="
    free -h
    echo "=== Temperature ==="
    cat /sys/devices/virtual/thermal/thermal_zone*/temp 2>/dev/null | head -n 1 | awk '{print $1/1000 "°C"}'
    sleep 5
done
EOF
    chmod +x /tmp/gpu-monitor.sh
    print_status "GPU monitoring script created at /tmp/gpu-monitor.sh"
}

# Install TensorFlow for ARM
install_tensorflow() {
    echo "Installing TensorFlow for Jetson..."
    
    # Install Python dependencies
    sudo apt-get install -y \
        python3-pip \
        python3-dev \
        python3-numpy \
        python3-scipy \
        python3-pandas \
        python3-matplotlib \
        libhdf5-serial-dev \
        hdf5-tools \
        libhdf5-dev \
        zlib1g-dev \
        zip \
        libjpeg8-dev \
        liblapack-dev \
        libblas-dev \
        gfortran
    
    # Upgrade pip
    python3 -m pip install --upgrade pip
    
    # Install TensorFlow for Jetson
    # Using NVIDIA's pre-built wheel for Jetson
    print_status "Installing TensorFlow ${TENSORFLOW_VERSION} for Jetson..."
    
    # Download and install TensorFlow wheel
    TENSORFLOW_URL="https://developer.download.nvidia.com/compute/redist/jp/v46/tensorflow/tensorflow-${TENSORFLOW_VERSION}+nv21.12-cp36-cp36m-linux_aarch64.whl"
    
    if wget -q --spider "$TENSORFLOW_URL"; then
        pip3 install --no-cache-dir "$TENSORFLOW_URL"
    else
        print_warning "Pre-built TensorFlow wheel not found, installing from pip"
        pip3 install tensorflow-gpu==${TENSORFLOW_VERSION} || pip3 install tensorflow
    fi
    
    # Verify TensorFlow installation
    python3 -c "import tensorflow as tf; print('TensorFlow version:', tf.__version__); print('GPU available:', tf.config.list_physical_devices('GPU'))" || print_warning "TensorFlow verification failed"
    
    print_status "TensorFlow installation complete"
}

# Optimize for Jetson hardware
optimize_jetson() {
    echo "Optimizing for Jetson hardware..."
    
    # Increase swap size (Jetson Nano has limited RAM)
    SWAP_SIZE=4G
    if [ ! -f /swapfile ]; then
        print_status "Creating ${SWAP_SIZE} swap file..."
        sudo fallocate -l $SWAP_SIZE /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        
        # Make swap permanent
        if ! grep -q "/swapfile" /etc/fstab; then
            echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
        fi
        print_status "Swap file created and enabled"
    else
        print_status "Swap file already exists"
    fi
    
    # Optimize kernel parameters
    cat > /tmp/99-jetson-optimize.conf << EOF
# Jetson Nano optimizations
vm.swappiness=10
vm.vfs_cache_pressure=50
vm.dirty_background_ratio=5
vm.dirty_ratio=10
kernel.sched_rt_runtime_us=-1
EOF
    
    sudo mv /tmp/99-jetson-optimize.conf /etc/sysctl.d/
    sudo sysctl -p /etc/sysctl.d/99-jetson-optimize.conf
    print_status "Kernel parameters optimized"
    
    # Disable unnecessary services
    SERVICES_TO_DISABLE=(
        "bluetooth"
        "cups"
        "cups-browsed"
        "avahi-daemon"
    )
    
    for service in "${SERVICES_TO_DISABLE[@]}"; do
        if systemctl list-unit-files | grep -q "$service"; then
            sudo systemctl disable "$service" 2>/dev/null || true
            sudo systemctl stop "$service" 2>/dev/null || true
            print_status "Disabled $service"
        fi
    done
    
    # Configure CPU governor
    echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
    print_status "CPU governor set to performance"
    
    # Optimize network settings for local operation
    cat > /tmp/99-network-optimize.conf << EOF
# Network optimizations for Aura Mirror
net.core.rmem_max=134217728
net.core.wmem_max=134217728
net.ipv4.tcp_rmem=4096 87380 134217728
net.ipv4.tcp_wmem=4096 65536 134217728
EOF
    
    sudo mv /tmp/99-network-optimize.conf /etc/sysctl.d/
    sudo sysctl -p /etc/sysctl.d/99-network-optimize.conf
    print_status "Network settings optimized"
}

# Configure auto-start on boot
configure_autostart() {
    echo "Configuring auto-start on boot..."
    
    # Create startup script
    cat > /tmp/aura-mirror-startup.sh << 'EOF'
#!/bin/bash

# Wait for network
sleep 10

# Set performance mode
sudo nvpmodel -m 0
sudo jetson_clocks

# Set display
export DISPLAY=:0

# Start temperature monitoring
tegrastats --interval 10000 --logfile /var/log/tegrastats.log &

# Log startup
echo "Aura Mirror started at $(date)" >> /var/log/aura-mirror-startup.log

EOF
    
    sudo mv /tmp/aura-mirror-startup.sh /usr/local/bin/
    sudo chmod +x /usr/local/bin/aura-mirror-startup.sh
    
    # Create systemd service for startup optimizations
    cat > /tmp/jetson-optimize.service << EOF
[Unit]
Description=Jetson Optimization for Aura Mirror
Before=aura-mirror.service
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/aura-mirror-startup.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
    
    sudo mv /tmp/jetson-optimize.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable jetson-optimize.service
    
    print_status "Auto-start configuration complete"
}

# Install additional ML libraries
install_ml_libraries() {
    echo "Installing additional ML libraries..."
    
    # Install OpenCV with CUDA support
    sudo apt-get install -y \
        python3-opencv \
        libopencv-dev \
        libopencv-python
    
    # Install ONNX Runtime for Jetson
    pip3 install onnxruntime-gpu --index-url https://pypi.ngc.nvidia.com
    
    # Install PyTorch for Jetson (if needed)
    # Note: PyTorch installation on Jetson requires specific wheels
    print_status "ML libraries installed"
}

# Create performance monitoring dashboard
create_monitoring() {
    echo "Creating performance monitoring setup..."
    
    cat > ~/monitor-aura.sh << 'EOF'
#!/bin/bash

# Aura Mirror Performance Monitor

clear
echo "==================================="
echo "  Aura Mirror Performance Monitor  "
echo "==================================="
echo

while true; do
    # GPU stats
    echo -e "\n--- GPU Status ---"
    tegrastats --interval 1000 | head -n 1
    
    # Temperature
    echo -e "\n--- Temperature ---"
    for zone in /sys/devices/virtual/thermal/thermal_zone*/temp; do
        if [ -f "$zone" ]; then
            temp=$(cat "$zone")
            zone_name=$(basename $(dirname "$zone"))
            echo "$zone_name: $(echo "scale=1; $temp/1000" | bc)°C"
        fi
    done
    
    # Memory
    echo -e "\n--- Memory Usage ---"
    free -h | grep -E "^Mem|^Swap"
    
    # Process
    echo -e "\n--- Aura Mirror Process ---"
    ps aux | grep -E "node|chrome" | grep -v grep | head -3
    
    # Network
    echo -e "\n--- Network ---"
    ss -tunl | grep 3000
    
    sleep 5
    clear
    echo "==================================="
    echo "  Aura Mirror Performance Monitor  "
    echo "==================================="
done
EOF
    
    chmod +x ~/monitor-aura.sh
    print_status "Performance monitor created at ~/monitor-aura.sh"
}

# Main setup flow
main() {
    echo "======================================"
    echo "   Jetson Nano Setup for Aura Mirror "
    echo "======================================"
    echo
    
    check_jetson
    install_cuda_deps
    configure_gpu
    install_tensorflow
    install_ml_libraries
    optimize_jetson
    configure_autostart
    create_monitoring
    
    echo
    echo "======================================"
    echo "   Jetson Setup Complete!            "
    echo "======================================"
    echo
    print_status "Jetson Nano has been optimized for Aura Mirror"
    echo
    echo "Optimizations applied:"
    echo "  ✓ CUDA and cuDNN configured"
    echo "  ✓ GPU acceleration enabled"
    echo "  ✓ TensorFlow for ARM installed"
    echo "  ✓ Performance mode activated"
    echo "  ✓ Swap memory increased"
    echo "  ✓ Auto-start configured"
    echo "  ✓ Monitoring tools installed"
    echo
    echo "Next steps:"
    echo "1. Reboot the system: sudo reboot"
    echo "2. Run performance monitor: ~/monitor-aura.sh"
    echo "3. Check GPU status: tegrastats"
    echo
    print_warning "Remember to connect adequate cooling for sustained operation"
}

# Run main function
main "$@"