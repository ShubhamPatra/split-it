#!/bin/bash
# AWS EC2 Quick Setup Script for Split-It
# Run this on a fresh Amazon Linux 2023 or Ubuntu 22.04 instance

set -e

echo "🚀 Split-It AWS EC2 Setup Script"
echo "================================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

echo "📦 Installing dependencies..."

if [ "$OS" = "amzn" ]; then
    # Amazon Linux 2023
    sudo dnf update -y
    sudo dnf install -y docker git
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Install Certbot
    sudo dnf install -y certbot
    
elif [ "$OS" = "ubuntu" ]; then
    # Ubuntu
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    
    # Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    # Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Certbot
    sudo apt-get install -y certbot
fi

echo "✅ Dependencies installed"

# Create app directory
APP_DIR="/opt/split-it"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Log out and back in for docker group to take effect:"
echo "   exit"
echo ""
echo "2. Clone your repository:"
echo "   cd $APP_DIR"
echo "   git clone https://github.com/YOUR_USERNAME/split-it.git ."
echo ""
echo "3. Create environment file:"
echo "   cp .env.production.example .env.production"
echo "   nano .env.production  # Edit with your values"
echo ""
echo "4. Build frontend:"
echo "   npm install"
echo "   npm run build"
echo ""
echo "5. Get SSL certificate (replace YOUR_DOMAIN):"
echo "   sudo certbot certonly --standalone -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com"
echo ""
echo "6. Update nginx.production.conf with your domain"
echo ""
echo "7. Start the application:"
echo "   docker-compose -f docker-compose.production.yml --env-file .env.production up -d"
echo ""
echo "8. View logs:"
echo "   docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "🎉 Setup complete! Follow the steps above to deploy Split-It."
