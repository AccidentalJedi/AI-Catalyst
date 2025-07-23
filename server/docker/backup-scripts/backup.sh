#!/bin/bash
# AI Catalyst Database Backup Script

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="ai_catalyst_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Database connection parameters
PGHOST=${POSTGRES_HOST:-postgres}
PGPORT=${POSTGRES_PORT:-5432}
PGDATABASE=${POSTGRES_DATABASE:-ai_catalyst_prod}
PGUSER=${POSTGRES_USER:-ai_catalyst_user}
PGPASSWORD=${POSTGRES_PASSWORD}

# Export password for pg_dump
export PGPASSWORD

echo "Starting backup at $(date)"
echo "Database: ${PGDATABASE}"
echo "Host: ${PGHOST}:${PGPORT}"
echo "User: ${PGUSER}"

# Create backup
echo "Creating backup: ${BACKUP_FILE}"
pg_dump \
    --host=${PGHOST} \
    --port=${PGPORT} \
    --username=${PGUSER} \
    --dbname=${PGDATABASE} \
    --verbose \
    --clean \
    --if-exists \
    --create \
    --format=custom \
    --compress=9 \
    --file="${BACKUP_PATH}"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"
    
    # Compress backup
    echo "Compressing backup..."
    gzip "${BACKUP_PATH}"
    COMPRESSED_BACKUP="${BACKUP_PATH}.gz"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${COMPRESSED_BACKUP}" | cut -f1)
    echo "Compressed backup size: ${BACKUP_SIZE}"
    
    # Upload to S3 if configured
    if [ -n "${S3_BUCKET}" ] && [ -n "${AWS_ACCESS_KEY_ID}" ]; then
        echo "Uploading backup to S3..."
        aws s3 cp "${COMPRESSED_BACKUP}" "s3://${S3_BUCKET}/backups/$(basename ${COMPRESSED_BACKUP})"
        
        if [ $? -eq 0 ]; then
            echo "Backup uploaded to S3 successfully"
        else
            echo "Failed to upload backup to S3"
        fi
    fi
    
    # Clean up old backups
    echo "Cleaning up old backups..."
    find ${BACKUP_DIR} -name "ai_catalyst_backup_*.sql.gz" -mtime +${BACKUP_RETENTION_DAYS:-30} -delete
    
    echo "Backup process completed at $(date)"
    
    # Send notification (if webhook configured)
    if [ -n "${BACKUP_WEBHOOK_URL}" ]; then
        curl -X POST "${BACKUP_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"success\",\"backup_file\":\"${BACKUP_FILE}.gz\",\"size\":\"${BACKUP_SIZE}\",\"timestamp\":\"$(date -Iseconds)\"}"
    fi
    
else
    echo "Backup failed!"
    
    # Send failure notification
    if [ -n "${BACKUP_WEBHOOK_URL}" ]; then
        curl -X POST "${BACKUP_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"failed\",\"error\":\"pg_dump failed\",\"timestamp\":\"$(date -Iseconds)\"}"
    fi
    
    exit 1
fi
