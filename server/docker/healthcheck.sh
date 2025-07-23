#!/bin/sh
# AI Catalyst Health Check Script

set -e

# Configuration
HOST="localhost"
PORT="${PORT:-3001}"
HEALTH_ENDPOINT="/api/health"
TIMEOUT=10

# Check if the application is responding
echo "Checking application health..."

# Use curl to check the health endpoint
response=$(curl -s -w "%{http_code}" -o /tmp/health_response --max-time $TIMEOUT "http://${HOST}:${PORT}${HEALTH_ENDPOINT}" || echo "000")

# Check HTTP status code
if [ "$response" = "200" ]; then
    echo "Health check passed (HTTP 200)"
    
    # Check response content
    if grep -q '"status":"healthy"' /tmp/health_response; then
        echo "Application reports healthy status"
        exit 0
    else
        echo "Application reports unhealthy status"
        cat /tmp/health_response
        exit 1
    fi
else
    echo "Health check failed (HTTP $response)"
    if [ -f /tmp/health_response ]; then
        cat /tmp/health_response
    fi
    exit 1
fi
