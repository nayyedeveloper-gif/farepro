#!/bin/bash

# SSH Deployment Script for Telegram Clone
# Server: root@129.212.226.234
# Deploy to: /var/www/teamwork

set -e

# Configuration
SERVER_USER="root"
SERVER_HOST="129.212.226.234"
SERVER_PORT="22"
PROJECT_NAME="teamwork"
REMOTE_DIR="/var/www/${PROJECT_NAME}"
BACKUP_DIR="/var/backups/${PROJECT_NAME}"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check SSH connection
check_ssh() {
    log_info "Checking SSH connection to ${SERVER_USER}@${SERVER_HOST}..."
    if ssh -p $SERVER_PORT -o ConnectTimeout=10 ${SERVER_USER}@${SERVER_HOST} "echo 'Connection successful'"; then
        log_info "SSH connection successful"
    else
        log_error "SSH connection failed"
        exit 1
    fi
}

# Create backup on remote server
create_backup() {
    log_info "Creating backup on remote server..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << EOF
        if [ -d "$REMOTE_DIR" ]; then
            mkdir -p $BACKUP_DIR
            BACKUP_NAME="${PROJECT_NAME}_$(date +%Y%m%d_%H%M%S).tar.gz"
            tar -czf $BACKUP_DIR/$BACKUP_NAME -C $(dirname $REMOTE_DIR) $(basename $REMOTE_DIR)
            echo "Backup created: $BACKUP_DIR/$BACKUP_NAME"
            
            # Keep only last 5 backups
            cd $BACKUP_DIR
            ls -t ${PROJECT_NAME}_*.tar.gz | tail -n +6 | xargs -r rm
        else
            echo "No existing deployment to backup"
        fi
EOF
}

# Build frontend
build_frontend() {
    log_info "Building frontend..."
    cd $LOCAL_DIR/frontend
    npm install
    npm run build
    cd $LOCAL_DIR
}

# Build backend
build_backend() {
    log_info "Building backend..."
    cd $LOCAL_DIR/backend
    CGO_ENABLED=0 GOOS=linux go build -o teamwork-server ./cmd/server
    cd $LOCAL_DIR
}

# Deploy to remote server
deploy() {
    log_info "Starting deployment to ${SERVER_USER}@${SERVER_HOST}..."
    
    # Check SSH connection
    check_ssh
    
    # Create backup
    create_backup
    
    # Build artifacts
    build_frontend
    build_backend
    
    # Create remote directory structure
    log_info "Creating remote directory structure..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << EOF
        mkdir -p $REMOTE_DIR
        mkdir -p $REMOTE_DIR/frontend
        mkdir -p $REMOTE_DIR/backend
        mkdir -p $REMOTE_DIR/uploads
        mkdir -p $REMOTE_DIR/logs
        mkdir -p $BACKUP_DIR
EOF
    
    # Upload frontend build
    log_info "Uploading frontend build..."
    rsync -avz -e "ssh -p $SERVER_PORT" --delete \
        $LOCAL_DIR/frontend/dist/ \
        ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/frontend/
    
    # Upload backend binary
    log_info "Uploading backend binary..."
    scp -P $SERVER_PORT \
        $LOCAL_DIR/backend/teamwork-server \
        ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/
    
    # Upload backend files
    log_info "Uploading backend files..."
    rsync -avz -e "ssh -p $SERVER_PORT" \
        --exclude='*.go' \
        --exclude='vendor/' \
        --exclude='*.test' \
        $LOCAL_DIR/backend/ \
        ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/
    
    # Upload environment file
    log_info "Uploading environment file..."
    if [ -f "$LOCAL_DIR/backend/.env.production" ]; then
        scp -P $SERVER_PORT \
            $LOCAL_DIR/backend/.env.production \
            ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/.env
    else
        log_warn "No .env.production file found, using existing .env"
    fi
    
    # Set permissions
    log_info "Setting permissions..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << EOF
        chown -R root:root $REMOTE_DIR
        chmod -R 755 $REMOTE_DIR
        chmod +x $REMOTE_DIR/backend/teamwork-server
        chmod -R 755 $REMOTE_DIR/uploads
EOF
    
    # Restart backend service
    log_info "Restarting backend service..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        if systemctl is-active --quiet teamwork-backend; then
            systemctl restart teamwork-backend
            echo "Service restarted"
        else
            systemctl start teamwork-backend
            echo "Service started"
        fi
        systemctl enable teamwork-backend
EOF
    
    # Reload nginx
    log_info "Reloading nginx..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        nginx -t
        systemctl reload nginx
EOF
    
    log_info "Deployment completed successfully!"
}

# Quick deploy (no backup)
quick_deploy() {
    log_info "Starting quick deployment (no backup)..."
    
    # Build artifacts
    build_frontend
    build_backend
    
    # Upload frontend build
    log_info "Uploading frontend build..."
    rsync -avz -e "ssh -p $SERVER_PORT" --delete \
        $LOCAL_DIR/frontend/dist/ \
        ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/frontend/
    
    # Upload backend binary
    log_info "Uploading backend binary..."
    scp -P $SERVER_PORT \
        $LOCAL_DIR/backend/teamwork-server \
        ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/
    
    # Restart backend service
    log_info "Restarting backend service..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        systemctl restart teamwork-backend
EOF
    
    # Reload nginx
    log_info "Reloading nginx..."
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST} << 'EOF'
        nginx -t
        systemctl reload nginx
EOF
    
    log_info "Quick deployment completed successfully!"
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy      Full deployment with backup"
    echo "  quick       Quick deployment without backup"
    echo "  backup      Create backup only"
    echo "  check       Check SSH connection"
    echo ""
    echo "Example:"
    echo "  $0 deploy"
}

# Main
case "${1:-}" in
    deploy)
        deploy
        ;;
    quick)
        quick_deploy
        ;;
    backup)
        check_ssh
        create_backup
        ;;
    check)
        check_ssh
        ;;
    *)
        usage
        exit 1
        ;;
esac
