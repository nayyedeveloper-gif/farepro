#!/bin/bash

# Server Setup Script for Teamwork
# Run this on the server: root@129.212.226.234

set -e

echo "=== Teamwork Server Setup ==="

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "Installing required packages..."
apt install -y \
    nginx \
    postgresql \
    postgresql-contrib \
    git \
    curl \
    wget \
    rsync \
    build-essential \
    nodejs \
    npm

# Install Go (if not already installed)
if ! command -v go &> /dev/null; then
    echo "Installing Go..."
    wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    rm go1.21.5.linux-amd64.tar.gz
fi

# Create project directory
echo "Creating project directory..."
mkdir -p /var/www/teamwork
mkdir -p /var/www/teamwork/frontend
mkdir -p /var/www/teamwork/backend
mkdir -p /var/www/teamwork/uploads
mkdir -p /var/www/teamwork/logs
mkdir -p /var/backups/teamwork

# Set permissions
echo "Setting permissions..."
chown -R root:root /var/www/teamwork
chmod -R 755 /var/www/teamwork
chmod -R 755 /var/www/teamwork/uploads

# Setup PostgreSQL
echo "Setting up PostgreSQL..."
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw teamwork; then
    sudo -u postgres psql -c "CREATE DATABASE teamwork;"
    sudo -u postgres psql -c "CREATE USER teamwork WITH PASSWORD 'change_this_password';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE teamwork TO teamwork;"
    echo "PostgreSQL database 'teamwork' created"
else
    echo "PostgreSQL database 'teamwork' already exists"
fi

# Install systemd service
echo "Installing systemd service..."
if [ -f "./teamwork-backend.service" ]; then
    cp ./teamwork-backend.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable teamwork-backend
    echo "Systemd service installed"
else
    echo "Warning: teamwork-backend.service not found in current directory"
fi

# Install nginx configuration
echo "Installing nginx configuration..."
if [ -f "./teamwork-nginx.conf" ]; then
    cp ./teamwork-nginx.conf /etc/nginx/sites-available/teamwork
    ln -sf /etc/nginx/sites-available/teamwork /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
    echo "Nginx configuration installed"
else
    echo "Warning: teamwork-nginx.conf not found in current directory"
fi

# Configure firewall (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

echo "=== Server Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Update backend/.env with production values"
echo "2. Run: ./deploy.sh deploy"
echo "3. Check service status: systemctl status teamwork-backend"
echo "4. Check nginx status: systemctl status nginx"
