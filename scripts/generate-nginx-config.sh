#!/bin/bash
# Generate nginx.production.conf with your domain
# Usage: ./generate-nginx-config.sh your-domain.com

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./generate-nginx-config.sh your-domain.com"
    exit 1
fi

cat > nginx.production.conf << EOF
# SPLIT-IT PRODUCTION NGINX CONFIGURATION
# Generated for domain: $DOMAIN
# Certificate paths: /etc/letsencrypt/live/$DOMAIN/

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
limit_conn_zone \$binary_remote_addr zone=conn_limit:10m;

upstream api {
    least_conn;
    server api:5000;
    keepalive 32;
}

# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration - Let's Encrypt certificates
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL session configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration (TLS 1.2+)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # OCSP Stapling (optional - requires your CA bundle)
    # ssl_stapling on;
    # ssl_stapling_verify on;
    # ssl_trusted_certificate /etc/letsencrypt/live/$DOMAIN/chain.pem;
    # resolver 8.8.8.8 8.8.4.4 valid=300s;
    # resolver_timeout 5s;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com wss:; frame-src https://accounts.google.com;" always;

    # Connection limits
    limit_conn conn_limit 20;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_comp_level 6;

    # ============================================
    # Frontend - React SPA
    # ============================================
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets (js, css, images) - 1 year
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        # Don't cache HTML files
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }

    # ============================================
    # API Proxy
    # ============================================
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Rate limiting for API
        limit_req zone=api burst=20 nodelay;
    }
    
    # Stricter rate limiting for auth endpoints
    location ~ ^/api/auth/(login|register|refresh) {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        limit_req zone=login burst=5 nodelay;
    }

    # ============================================
    # WebSocket for Socket.IO (Real-time Updates)
    # ============================================
    location /socket.io/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket timeouts (7 days)
        proxy_connect_timeout 604800s;
        proxy_send_timeout 604800s;
        proxy_read_timeout 604800s;
        
        # Allow longer buffers for WebSocket
        proxy_buffering off;
    }

    # ============================================
    # Metrics Endpoint (Internal Only)
    # ============================================
    location /metrics {
        # Restrict to VPC/internal access
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        allow 127.0.0.1;
        deny all;
        
        proxy_pass http://api;
        access_log off;
    }

    # ============================================
    # Health Check Endpoint
    # ============================================
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # ============================================
    # Block Common Exploit Paths
    # ============================================
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~* (\.php|\.asp|\.aspx|\.jsp|\.cgi|\.exe|\.sh)$ {
        deny all;
        access_log off;
        log_not_found off;
    }

    # ============================================
    # Logging
    # ============================================
    access_log /var/log/nginx/access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/error.log warn;
}
EOF

echo "✅ nginx.production.conf generated for $DOMAIN"
echo ""
echo "Next steps:"
echo "1. Review the generated file: cat nginx.production.conf"
echo "2. Update docker-compose.production.yml to use this file"
echo "3. Ensure Let's Encrypt certificate exists:"
echo "   sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
echo "4. Start Docker Compose:"
echo "   docker-compose -f docker-compose.production.yml up -d"
