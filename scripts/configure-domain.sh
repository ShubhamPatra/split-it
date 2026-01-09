#!/bin/bash
# AWS Domain Configuration Helper for Split-It
# This script helps configure Route 53 records and nginx for your custom domain

set -e

DOMAIN=$1
AWS_REGION=${2:-us-east-1}

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./configure-domain.sh your-domain.com [aws-region]"
    echo ""
    echo "Example:"
    echo "  ./configure-domain.sh example.com us-east-1"
    echo ""
    exit 1
fi

echo "================================================"
echo "Split-It Domain Configuration Helper"
echo "================================================"
echo ""
echo "Domain: $DOMAIN"
echo "Region: $AWS_REGION"
echo ""

# Step 1: Get hosted zone ID
echo "📍 Fetching Route 53 hosted zone..."
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
    --output text | awk -F'/' '{print $NF}')

if [ -z "$ZONE_ID" ]; then
    echo "❌ Error: Hosted zone not found for $DOMAIN"
    echo "Please ensure Route 53 hosted zone is created first"
    exit 1
fi

echo "✅ Found hosted zone: $ZONE_ID"
echo ""

# Step 2: Show nameservers
echo "📍 Nameservers for this zone:"
aws route53 get-hosted-zone --id $ZONE_ID --query 'DelegationSet.NameServers' --output text
echo ""
echo "⚠️  If domain registered elsewhere, update nameservers at your registrar"
echo ""

# Step 3: Choose configuration option
echo "Choose your setup:"
echo ""
echo "1) EC2 Instance (Simple, single server)"
echo "2) Application Load Balancer (ECS/Fargate, production)"
echo ""
read -p "Enter option (1 or 2): " SETUP_OPTION

case $SETUP_OPTION in
    1)
        read -p "Enter EC2 instance public IP or elastic IP: " EC2_IP
        if [ -z "$EC2_IP" ]; then
            echo "❌ IP address required"
            exit 1
        fi
        
        echo ""
        echo "Creating Route 53 A records for EC2..."
        
        # Main domain
        aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID \
            --change-batch '{
                "Changes": [
                    {
                        "Action": "CREATE",
                        "ResourceRecordSet": {
                            "Name": "'$DOMAIN'",
                            "Type": "A",
                            "TTL": 300,
                            "ResourceRecords": [{"Value": "'$EC2_IP'"}]
                        }
                    },
                    {
                        "Action": "CREATE",
                        "ResourceRecordSet": {
                            "Name": "www.'$DOMAIN'",
                            "Type": "A",
                            "TTL": 300,
                            "ResourceRecords": [{"Value": "'$EC2_IP'"}]
                        }
                    }
                ]
            }' || true
        
        echo "✅ Route 53 records created"
        echo ""
        echo "Next steps:"
        echo "1. SSH into EC2: ssh -i your-key.pem ec2-user@$EC2_IP"
        echo "2. Update nginx.production.conf:"
        echo "   - Replace 'your-domain.com' with '$DOMAIN'"
        echo "3. Get SSL certificate:"
        echo "   sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
        echo "4. Update certificate paths in nginx.production.conf"
        echo "5. Start services: docker-compose -f docker-compose.production.yml up -d"
        ;;
        
    2)
        read -p "Enter ALB DNS name (e.g., my-alb-123456789.us-east-1.elb.amazonaws.com): " ALB_DNS
        if [ -z "$ALB_DNS" ]; then
            echo "❌ ALB DNS required"
            exit 1
        fi
        
        echo ""
        echo "Creating Route 53 ALIAS records for ALB..."
        
        ALB_ZONE_ID=$(aws elbv2 describe-load-balancers \
            --region $AWS_REGION \
            --query "LoadBalancers[?DNSName=='$ALB_DNS'].CanonicalHostedZoneId" \
            --output text)
        
        if [ -z "$ALB_ZONE_ID" ]; then
            echo "❌ Could not find ALB zone ID. Verify ALB DNS name."
            exit 1
        fi
        
        aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID \
            --change-batch '{
                "Changes": [
                    {
                        "Action": "CREATE",
                        "ResourceRecordSet": {
                            "Name": "'$DOMAIN'",
                            "Type": "A",
                            "AliasTarget": {
                                "HostedZoneId": "'$ALB_ZONE_ID'",
                                "DNSName": "'$ALB_DNS'",
                                "EvaluateTargetHealth": true
                            }
                        }
                    },
                    {
                        "Action": "CREATE",
                        "ResourceRecordSet": {
                            "Name": "www.'$DOMAIN'",
                            "Type": "A",
                            "AliasTarget": {
                                "HostedZoneId": "'$ALB_ZONE_ID'",
                                "DNSName": "'$ALB_DNS'",
                                "EvaluateTargetHealth": true
                            }
                        }
                    },
                    {
                        "Action": "CREATE",
                        "ResourceRecordSet": {
                            "Name": "api.'$DOMAIN'",
                            "Type": "A",
                            "AliasTarget": {
                                "HostedZoneId": "'$ALB_ZONE_ID'",
                                "DNSName": "'$ALB_DNS'",
                                "EvaluateTargetHealth": true
                            }
                        }
                    }
                ]
            }' || true
        
        echo "✅ Route 53 ALIAS records created"
        echo ""
        echo "Next steps:"
        echo "1. Your ALB should have HTTPS listener with ACM certificate"
        echo "2. Update ECS task definition with environment variables:"
        echo "   CLIENT_URL=https://$DOMAIN"
        echo "   REACT_APP_API_URL=https://api.$DOMAIN/api"
        echo "3. Force new ECS deployment: aws ecs update-service --cluster split-it-cluster --service split-it-api --force-new-deployment"
        ;;
        
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "⏳ Waiting for DNS propagation (this can take 5-15 minutes)..."
echo ""
echo "Test DNS resolution:"
echo "  nslookup $DOMAIN"
echo "  dig $DOMAIN"
echo ""
echo "Test HTTPS:"
echo "  curl -I https://$DOMAIN"
echo ""
echo "✅ Configuration complete!"
