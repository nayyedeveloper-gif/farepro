#!/bin/bash

# Script to run database migrations
# Usage: ./run-migration.sh

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-teamwork}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME:-teamwork}

echo "Running database migrations..."
echo "Database: ${DB_NAME} at ${DB_HOST}:${DB_PORT}"

# Run migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/001_create_ads_table.sql

echo "Migration completed successfully!"
