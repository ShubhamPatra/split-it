#!/bin/bash
# Quick Start Deployment Script for Split-It on AWS EC2
# This automates the entire deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Split-It AWS EC2 Deployment Script                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running on EC2
if ! curl -s http://169.254.169.254/latest/meta-data/instance-id &>/dev/null; then
    echo -e "${RED}❌ This script must run on an AWS EC2 instance${NC}"
    exit 1
fi

# Get parameters
read -p "Enter your domain (e.g., example.com): " DOMAIN
read -p "Enter your GitHub repository URL: " REPO_URL
read -p "Enter Git branch to deploy (default: main): " GIT_BRANCH
GIT_BRANCH=${GIT_BRANCH:-main}

if [ -z "$DOMAIN" ] || [ -z "$REPO_URL" ]; then
    echo -e "${RED}❌ Domain and repository URL are required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚙️  Configuration Summary:${NC}"
echo "Domain: $DOMAIN"
echo "Repository: $REPO_URL"
echo "Branch: $GIT_BRANCH"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Update system
echo ""
echo -e "${BLUE}📦 Step 1: Updating system packages...${NC}"
sudo dnf update -y -q

# Step 2: Install Docker
echo -e "${BLUE}🐳 Step 2: Installing Docker...${NC}"
sudo dnf install -y -q docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Step 3: Install Docker Compose
echo -e "${BLUE}🐳 Step 3: Installing Docker Compose...${NC}"
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Step 4: Install Certbot
echo -e "${BLUE}🔒 Step 4: Installing Certbot (SSL/TLS)...${NC}"
sudo dnf install -y -q certbot

# Step 5: Install Git
echo -e "${BLUE}📥 Step 5: Installing Git...${NC}"
sudo dnf install -y -q git

# Step 6: Clone repository
echo -e "${BLUE}📥 Step 6: Cloning repository...${NC}"
APP_DIR="/opt/split-it"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

cd $APP_DIR
if [ -d ".git" ]; then
    git pull origin $GIT_BRANCH
else
    git clone --branch $GIT_BRANCH $REPO_URL .
fi

# Step 7: Setup environment
echo ""
echo -e "${BLUE}⚙️  Step 7: Environment setup...${NC}"
echo ""
echo -e "${YELLOW}You need to configure environment variables.${NC}"
echo "Copy .env.production.example to .env.production and fill in your values:"
echo ""
echo "Required environment variables:"
echo "  - MONGODB_URI (from MongoDB Atlas)"
echo "  - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD (from AWS ElastiCache)"
echo "  - JWT_SECRET (generate: openssl rand -base64 32)"
echo "  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
echo "  - CLIENT_URL (https://$DOMAIN)"
echo "  - AWS_* (for S3 receipts storage)"
echo ""

if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    echo -e "${YELLOW}⚠️  Edit .env.production now:${NC}"
    nano .env.production
else
    echo -e "${GREEN}✅ .env.production already exists${NC}"
fi

# Step 8: Build frontend
echo ""
echo -e "${BLUE}🔨 Step 8: Building frontend...${NC}"
npm install -q
npm run build

# Step 9: Generate nginx config
echo -e "${BLUE}⚙️  Step 9: Generating nginx configuration...${NC}"
chmod +x scripts/generate-nginx-config.sh
./scripts/generate-nginx-config.sh "$DOMAIN"

# Step 10: Get SSL certificate
echo ""
echo -e "${BLUE}🔒 Step 10: Obtaining SSL certificate...${NC}"
echo "This may take a few minutes..."

# Stop Docker services first
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

# Get certificate
sudo certbot certonly --standalone \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email admin@$DOMAIN \
    --preferred-challenges http

# Verify certificate
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}✅ SSL certificate obtained successfully${NC}"
else
    echo -e "${RED}❌ Failed to obtain SSL certificate${NC}"
    echo "Please get certificate manually:"
    echo "  sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
    exit 1
fi

# Step 11: Start services
echo ""
echo -e "${BLUE}🚀 Step 11: Starting services...${NC}"
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

# Wait for services to start
echo "Waiting for services to start (30s)..."
sleep 30

# Step 12: Verify services
echo ""
echo -e "${BLUE}✅ Step 12: Verifying services...${NC}"

# Check Docker containers
if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Docker services are running${NC}"
else
    echo -e "${RED}❌ Docker services failed to start${NC}"
    echo "Check logs: docker-compose -f docker-compose.production.yml logs"
    exit 1
fi

# Test API health
sleep 5
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  API health check failed (may still be starting)${NC}"
fi

# Step 13: Setup Route 53 (if AWS CLI available)
echo ""
echo -e "${BLUE}📍 Step 13: Route 53 Configuration${NC}"

EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Your EC2 Public IP: $EC2_IP"
echo ""
echo "Configure Route 53 manually:"
echo "  1. Go to AWS Route 53 console"
echo "  2. Create/select hosted zone for $DOMAIN"
echo "  3. Add A records:"
echo "     - Name: $DOMAIN        | Type: A | Value: $EC2_IP"
echo "     - Name: www.$DOMAIN    | Type: A | Value: $EC2_IP"
echo ""
echo "Or run from your local machine:"
echo "  aws route53 change-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --change-batch file://route53-update.json"

# Step 14: Setup auto-renewal
echo ""
echo -e "${BLUE}🔄 Step 14: Setting up SSL certificate auto-renewal...${NC}"
sudo systemctl enable certbot-renew.timer
echo -e "${GREEN}✅ Auto-renewal enabled${NC}"

# Finish
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🎉 Deployment Complete! 🎉                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Configure Route 53 DNS records:"
echo "   - Point $DOMAIN to EC2 IP: $EC2_IP"
echo ""
echo "2. Configure Google OAuth (if not done):"
echo "   - Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.production"
echo "   - Restart services: docker-compose -f docker-compose.production.yml restart api"
echo ""
echo "3. Verify your application:"
echo "   - Open https://$DOMAIN in browser"
echo "   - Test login and create expense"
echo "   - Check browser console for errors"
echo ""
echo "4. View logs:"
echo "   docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "5. Manage services:"
echo "   Stop:     docker-compose -f docker-compose.production.yml stop"
echo "   Start:    docker-compose -f docker-compose.production.yml start"
echo "   Restart:  docker-compose -f docker-compose.production.yml restart"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo ""
echo "View logs:              docker-compose -f docker-compose.production.yml logs -f"
echo "Restart API:            docker-compose -f docker-compose.production.yml restart api"
echo "Update code:            git pull && npm run build && docker-compose restart"
echo "View certificate:       sudo certbot certificates"
echo "Renew certificate:      sudo certbot renew"
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
