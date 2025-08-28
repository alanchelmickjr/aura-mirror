#!/bin/bash

# Kiosk Mode Setup Script for Aura Mirror
# Configures system for 90-inch display in full kiosk mode

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
USER_HOME="/home/$USER"
DISPLAY_WIDTH=3840  # 4K display width
DISPLAY_HEIGHT=2160 # 4K display height
APP_URL="http://localhost:3000"

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

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if running on Linux with X11
    if [ -z "$DISPLAY" ]; then
        export DISPLAY=:0
        print_warning "DISPLAY not set, using :0"
    fi
    
    # Check for required packages
    REQUIRED_PACKAGES=(
        "chromium-browser"
        "unclutter"
        "xdotool"
        "x11-xserver-utils"
        "lightdm"
    )
    
    for package in "${REQUIRED_PACKAGES[@]}"; do
        if dpkg -l | grep -q "^ii.*$package"; then
            print_status "$package is installed"
        else
            print_warning "$package not found, installing..."
            sudo apt-get update
            sudo apt-get install -y "$package"
        fi
    done
}

# Configure display settings
configure_display() {
    echo "Configuring display settings..."
    
    # Create xorg configuration for 90-inch display
    sudo tee /etc/X11/xorg.conf.d/10-monitor.conf > /dev/null << EOF
Section "Monitor"
    Identifier "HDMI-1"
    Option "PreferredMode" "${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}"
    Option "Position" "0 0"
    Option "Rotate" "normal"
    Option "DPMS" "false"
EndSection

Section "Screen"
    Identifier "Screen0"
    Device "Device0"
    Monitor "HDMI-1"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Modes "${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}"
    EndSubSection
EndSection

Section "ServerFlags"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
    Option "BlankTime" "0"
EndSection
EOF
    
    print_status "Display configuration created"
    
    # Set display resolution
    if command -v xrandr &> /dev/null; then
        xrandr --output HDMI-1 --mode ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT} 2>/dev/null || \
        xrandr --output HDMI-0 --mode ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT} 2>/dev/null || \
        xrandr --output DP-1 --mode ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT} 2>/dev/null || \
        print_warning "Could not set display resolution via xrandr"
    fi
}

# Disable screen saver and power management
disable_screensaver() {
    echo "Disabling screen saver and power management..."
    
    # Disable screen saver for current session
    xset s off
    xset -dpms
    xset s noblank
    
    # Create autostart entry to disable screen saver
    mkdir -p "$USER_HOME/.config/autostart"
    
    cat > "$USER_HOME/.config/autostart/disable-screensaver.desktop" << EOF
[Desktop Entry]
Type=Application
Exec=sh -c "xset s off; xset -dpms; xset s noblank"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Disable Screensaver
Comment=Disable screen saver and power management
EOF
    
    # Disable screen blanking in console
    if [ -f /etc/kbd/config ]; then
        sudo sed -i 's/BLANK_TIME=.*/BLANK_TIME=0/' /etc/kbd/config
        sudo sed -i 's/POWERDOWN_TIME=.*/POWERDOWN_TIME=0/' /etc/kbd/config
    fi
    
    # Disable screensaver in lightdm
    if [ -f /etc/lightdm/lightdm.conf ]; then
        if ! grep -q "xserver-command" /etc/lightdm/lightdm.conf; then
            sudo sed -i '/\[Seat:\*\]/a xserver-command=X -s 0 -dpms' /etc/lightdm/lightdm.conf
        fi
    fi
    
    print_status "Screen saver and power management disabled"
}

# Configure Chromium for kiosk mode
configure_chromium() {
    echo "Configuring Chromium for kiosk mode..."
    
    # Create Chromium preferences directory
    CHROMIUM_DIR="$USER_HOME/.config/chromium"
    mkdir -p "$CHROMIUM_DIR/Default"
    
    # Create Chromium preferences for kiosk mode
    cat > "$CHROMIUM_DIR/Default/Preferences" << EOF
{
    "browser": {
        "show_home_button": false,
        "check_default_browser": false
    },
    "bookmark_bar": {
        "show_on_all_tabs": false
    },
    "sync_promo": {
        "show_on_first_run_allowed": false
    },
    "distribution": {
        "import_bookmarks": false,
        "import_history": false,
        "import_home_page": false,
        "import_search_engine": false,
        "make_chrome_default": false,
        "make_chrome_default_for_user": false,
        "show_welcome_page": false,
        "skip_first_run_ui": true
    },
    "profile": {
        "default_content_setting_values": {
            "notifications": 2
        }
    }
}
EOF
    
    # Create Chromium launch script
    cat > "$USER_HOME/start-kiosk.sh" << 'EOF'
#!/bin/bash

# Kill any existing Chromium instances
pkill -f chromium-browser || true
sleep 2

# Export display
export DISPLAY=:0

# Hide cursor after 0.1 seconds of inactivity
unclutter -idle 0.1 -root &

# Disable energy star features
xset -dpms
xset s off
xset s noblank

# Remove Chromium crash restore
rm -rf ~/.config/chromium/Singleton* 2>/dev/null
rm -rf ~/.config/chromium/Default/Web\ Data 2>/dev/null
rm -rf ~/.config/chromium/Default/Web\ Data-journal 2>/dev/null

# Start Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI \
    --disable-component-update \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-features=Translate \
    --disable-ipc-flooding-protection \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --disable-pull-to-refresh-effect \
    --disable-smooth-scrolling \
    --disable-dev-shm-usage \
    --disable-gpu-sandbox \
    --enable-accelerated-video-decode \
    --enable-gpu-rasterization \
    --enable-oop-rasterization \
    --ignore-gpu-blocklist \
    --use-gl=desktop \
    --enable-features=VaapiVideoDecoder \
    --window-size=DISPLAY_WIDTH,DISPLAY_HEIGHT \
    --window-position=0,0 \
    --autoplay-policy=no-user-gesture-required \
    --no-first-run \
    --disable-translate \
    --no-default-browser-check \
    --check-for-update-interval=604800 \
    --disable-background-networking \
    --disable-sync \
    --disable-web-security \
    --disable-site-isolation-trials \
    --disable-features=IsolateOrigins,site-per-process \
    --app=APP_URL
EOF
    
    # Replace placeholders in script
    sed -i "s|DISPLAY_WIDTH|${DISPLAY_WIDTH}|g" "$USER_HOME/start-kiosk.sh"
    sed -i "s|DISPLAY_HEIGHT|${DISPLAY_HEIGHT}|g" "$USER_HOME/start-kiosk.sh"
    sed -i "s|APP_URL|${APP_URL}|g" "$USER_HOME/start-kiosk.sh"
    
    chmod +x "$USER_HOME/start-kiosk.sh"
    print_status "Chromium kiosk script created"
}

# Hide cursor
configure_cursor() {
    echo "Configuring cursor settings..."
    
    # Install unclutter if not already installed
    if ! command -v unclutter &> /dev/null; then
        sudo apt-get install -y unclutter
    fi
    
    # Create cursor hiding service
    cat > /tmp/hide-cursor.service << EOF
[Unit]
Description=Hide mouse cursor
After=display-manager.service

[Service]
Type=simple
Environment="DISPLAY=:0"
ExecStart=/usr/bin/unclutter -idle 0.1 -root -noevents
Restart=always
User=$USER

[Install]
WantedBy=default.target
EOF
    
    sudo mv /tmp/hide-cursor.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable hide-cursor.service
    
    print_status "Cursor hiding configured"
}

# Configure auto-login
configure_autologin() {
    echo "Configuring auto-login..."
    
    # Configure LightDM for auto-login
    if [ -f /etc/lightdm/lightdm.conf ]; then
        sudo tee /etc/lightdm/lightdm.conf > /dev/null << EOF
[Seat:*]
autologin-user=$USER
autologin-user-timeout=0
user-session=default
xserver-command=X -s 0 -dpms
greeter-hide-users=false
EOF
        print_status "Auto-login configured for LightDM"
    else
        print_warning "LightDM configuration not found"
    fi
    
    # Add user to autologin group
    sudo groupadd -f autologin
    sudo usermod -a -G autologin "$USER"
}

# Configure auto-start
configure_autostart() {
    echo "Configuring auto-start..."
    
    # Create systemd service for kiosk mode
    cat > /tmp/aura-mirror-kiosk.service << EOF
[Unit]
Description=Aura Mirror Kiosk Mode
After=graphical.target aura-mirror.service
Wants=graphical.target aura-mirror.service

[Service]
Type=simple
Environment="DISPLAY=:0"
Environment="XAUTHORITY=$USER_HOME/.Xauthority"
ExecStartPre=/bin/sleep 10
ExecStart=$USER_HOME/start-kiosk.sh
Restart=always
RestartSec=10
User=$USER
Group=$USER

[Install]
WantedBy=default.target
EOF
    
    sudo mv /tmp/aura-mirror-kiosk.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable aura-mirror-kiosk.service
    
    # Create desktop autostart entry as backup
    mkdir -p "$USER_HOME/.config/autostart"
    cat > "$USER_HOME/.config/autostart/aura-mirror-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Aura Mirror Kiosk
Exec=$USER_HOME/start-kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Comment=Start Aura Mirror in kiosk mode
EOF
    
    print_status "Auto-start configured"
}

# Prevent user interaction with OS
lock_down_system() {
    echo "Locking down system for kiosk mode..."
    
    # Disable keyboard shortcuts
    if command -v gsettings &> /dev/null; then
        # Disable Alt+Tab
        gsettings set org.gnome.desktop.wm.keybindings switch-applications "[]"
        gsettings set org.gnome.desktop.wm.keybindings switch-applications-backward "[]"
        
        # Disable Alt+F4
        gsettings set org.gnome.desktop.wm.keybindings close "[]"
        
        # Disable Super key
        gsettings set org.gnome.mutter overlay-key ""
        
        # Disable other shortcuts
        gsettings set org.gnome.desktop.wm.keybindings panel-main-menu "[]"
        gsettings set org.gnome.desktop.wm.keybindings panel-run-dialog "[]"
        
        print_status "GNOME keyboard shortcuts disabled"
    fi
    
    # Disable TTY switching (Ctrl+Alt+F1-F7)
    if [ -f /etc/X11/xorg.conf ]; then
        if ! grep -q "DontVTSwitch" /etc/X11/xorg.conf; then
            sudo bash -c 'echo -e "\nSection \"ServerFlags\"\n    Option \"DontVTSwitch\" \"true\"\nEndSection" >> /etc/X11/xorg.conf'
        fi
    else
        sudo tee /etc/X11/xorg.conf.d/50-novtswitch.conf > /dev/null << EOF
Section "ServerFlags"
    Option "DontVTSwitch" "true"
EndSection
EOF
    fi
    
    # Disable Ctrl+Alt+Backspace
    sudo tee /etc/X11/xorg.conf.d/50-no-kill.conf > /dev/null << EOF
Section "ServerFlags"
    Option "DontZap" "true"
EndSection
EOF
    
    # Create keyboard filter script
    cat > "$USER_HOME/keyboard-filter.sh" << 'EOF'
#!/bin/bash
# Disable specific key combinations
xmodmap -e "keycode 64 ="  # Disable Alt_L
xmodmap -e "keycode 108 =" # Disable Alt_R
xmodmap -e "keycode 133 =" # Disable Super_L
xmodmap -e "keycode 134 =" # Disable Super_R
EOF
    chmod +x "$USER_HOME/keyboard-filter.sh"
    
    # Add to autostart
    cat > "$USER_HOME/.config/autostart/keyboard-filter.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Keyboard Filter
Exec=$USER_HOME/keyboard-filter.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    
    print_status "System locked down for kiosk mode"
}

# Create recovery script
create_recovery() {
    echo "Creating recovery script..."
    
    cat > "$USER_HOME/exit-kiosk.sh" << 'EOF'
#!/bin/bash

# Emergency exit script for kiosk mode
# Run via SSH or TTY if needed

echo "Exiting kiosk mode..."

# Stop kiosk service
sudo systemctl stop aura-mirror-kiosk.service
sudo systemctl disable aura-mirror-kiosk.service

# Kill Chromium
pkill -f chromium-browser

# Restore keyboard
xmodmap -e "keycode 64 = Alt_L"
xmodmap -e "keycode 108 = Alt_R"
xmodmap -e "keycode 133 = Super_L"
xmodmap -e "keycode 134 = Super_R"

# Re-enable screensaver
xset s on
xset +dpms

echo "Kiosk mode disabled. Please reboot the system."
EOF
    
    chmod +x "$USER_HOME/exit-kiosk.sh"
    print_status "Recovery script created at ~/exit-kiosk.sh"
}

# Test kiosk mode
test_kiosk() {
    echo "Testing kiosk mode setup..."
    
    # Check if Aura Mirror service is running
    if systemctl is-active --quiet aura-mirror.service; then
        print_status "Aura Mirror service is running"
    else
        print_warning "Aura Mirror service is not running"
        print_warning "Start it with: sudo systemctl start aura-mirror.service"
    fi
    
    # Test Chromium launch
    print_status "Testing Chromium launch (will close after 5 seconds)..."
    timeout 5 chromium-browser --version &> /dev/null
    if [ $? -eq 124 ] || [ $? -eq 0 ]; then
        print_status "Chromium test successful"
    else
        print_error "Chromium test failed"
    fi
}

# Main setup flow
main() {
    echo "======================================"
    echo "   Kiosk Mode Setup for Aura Mirror  "
    echo "======================================"
    echo
    echo "Display Configuration:"
    echo "  Resolution: ${DISPLAY_WIDTH}x${DISPLAY_HEIGHT}"
    echo "  URL: ${APP_URL}"
    echo
    
    check_prerequisites
    configure_display
    disable_screensaver
    configure_chromium
    configure_cursor
    configure_autologin
    configure_autostart
    lock_down_system
    create_recovery
    test_kiosk
    
    echo
    echo "======================================"
    echo "   Kiosk Setup Complete!              "
    echo "======================================"
    echo
    print_status "System configured for kiosk mode"
    echo
    echo "Kiosk features enabled:"
    echo "  ✓ Full-screen Chromium browser"
    echo "  ✓ Auto-login configured"
    echo "  ✓ Auto-start on boot"
    echo "  ✓ Screen saver disabled"
    echo "  ✓ Cursor hidden"
    echo "  ✓ Keyboard shortcuts disabled"
    echo "  ✓ TTY switching disabled"
    echo
    echo "Important files:"
    echo "  Start script: ~/start-kiosk.sh"
    echo "  Exit script: ~/exit-kiosk.sh"
    echo
    echo "To start kiosk mode manually:"
    echo "  ~/start-kiosk.sh"
    echo
    echo "To start kiosk service:"
    echo "  sudo systemctl start aura-mirror-kiosk.service"
    echo
    echo "To exit kiosk mode (via SSH):"
    echo "  ~/exit-kiosk.sh"
    echo
    print_warning "Reboot required for all changes to take effect"
}

# Run main function
main "$@"