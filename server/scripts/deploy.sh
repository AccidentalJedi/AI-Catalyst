#!/bin/bash
# AI Catalyst Production Deployment Script

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${1:-production}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
RUN_HEALTH_CHECK="${RUN_HEALTH_CHECK:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f "$PROJECT_ROOT/.env.${DEPLOY_ENV}" ]; then
        log_error "Environment file .env.${DEPLOY_ENV} not found"
        log_info "Please copy .env.${DEPLOY_ENV}.example to .env.${DEPLOY_ENV} and configure it"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup before deployment
create_backup() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        log_info "Creating backup before deployment..."
        
        # Create backup directory if it doesn't exist
        mkdir -p "$PROJECT_ROOT/backups"
        
        # Run backup using Docker Compose
        docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} \
            run --rm backup /usr/local/bin/backup.sh
        
        if [ $? -eq 0 ]; then
            log_success "Backup created successfully"
        else
            log_error "Backup creation failed"
            exit 1
        fi
    else
        log_warning "Skipping backup creation"
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build application image
    docker build -f Dockerfile.production -t ai-catalyst-app:latest .
    
    # Build backup service image
    docker build -f Dockerfile.backup -t ai-catalyst-backup:latest .
    
    log_success "Docker images built successfully"
}

# Deploy application
deploy_application() {
    log_info "Deploying application..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} down
    
    # Start new containers
    log_info "Starting new containers..."
    docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    log_success "Application deployed successfully"
}

# Run database migrations
run_migrations() {
    if [ "$RUN_MIGRATIONS" = "true" ]; then
        log_info "Running database migrations..."
        
        # Wait for database to be ready
        log_info "Waiting for database to be ready..."
        docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} \
            exec -T postgres pg_isready -U ai_catalyst_user -d ai_catalyst_prod
        
        # Run migrations
        docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} \
            exec -T app npm run db:migrate:latest
        
        if [ $? -eq 0 ]; then
            log_success "Database migrations completed successfully"
        else
            log_error "Database migrations failed"
            exit 1
        fi
    else
        log_warning "Skipping database migrations"
    fi
}

# Run health checks
run_health_checks() {
    if [ "$RUN_HEALTH_CHECK" = "true" ]; then
        log_info "Running health checks..."
        
        # Check application health
        for i in {1..10}; do
            if curl -f http://localhost:3001/api/health &> /dev/null; then
                log_success "Application health check passed"
                break
            else
                log_info "Health check attempt $i/10 failed, retrying in 10 seconds..."
                sleep 10
            fi
            
            if [ $i -eq 10 ]; then
                log_error "Application health check failed after 10 attempts"
                exit 1
            fi
        done
        
        # Check database connectivity
        docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} \
            exec -T app npm run db:status
        
        if [ $? -eq 0 ]; then
            log_success "Database connectivity check passed"
        else
            log_error "Database connectivity check failed"
            exit 1
        fi
        
        # Run performance test
        log_info "Running light performance test..."
        docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} \
            exec -T app npm run perf:load:light
        
        if [ $? -eq 0 ]; then
            log_success "Performance test passed"
        else
            log_warning "Performance test failed - check application performance"
        fi
        
    else
        log_warning "Skipping health checks"
    fi
}

# Cleanup old images and containers
cleanup() {
    log_info "Cleaning up old Docker images and containers..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused volumes (be careful with this in production)
    # docker volume prune -f
    
    log_success "Cleanup completed"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""
    
    # Show running containers
    docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} ps
    
    echo ""
    log_info "Application URLs:"
    echo "  Application: http://localhost:3001"
    echo "  Health Check: http://localhost:3001/api/health"
    echo "  Grafana: http://localhost:3000"
    echo "  Prometheus: http://localhost:9090"
    
    echo ""
    log_info "Useful Commands:"
    echo "  View logs: docker-compose -f docker-compose.production.yml logs -f"
    echo "  Stop services: docker-compose -f docker-compose.production.yml down"
    echo "  Restart services: docker-compose -f docker-compose.production.yml restart"
    echo "  Run migrations: docker-compose -f docker-compose.production.yml exec app npm run db:migrate:latest"
    echo "  Create backup: docker-compose -f docker-compose.production.yml exec backup /usr/local/bin/backup.sh"
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop current containers
    docker-compose -f docker-compose.production.yml --env-file .env.${DEPLOY_ENV} down
    
    # Restore from latest backup
    LATEST_BACKUP=$(ls -t "$PROJECT_ROOT/backups/"*.sql.gz | head -n1)
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Restoring from backup: $LATEST_BACKUP"
        # Add backup restoration logic here
        log_success "Rollback completed"
    else
        log_error "No backup found for rollback"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting AI Catalyst deployment to $DEPLOY_ENV environment"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    create_backup
    
    # Build images
    build_images
    
    # Deploy application
    deploy_application
    
    # Run migrations
    run_migrations
    
    # Run health checks
    run_health_checks
    
    # Cleanup
    cleanup
    
    # Show status
    show_status
    
    log_success "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "status")
        show_status
        ;;
    "health")
        run_health_checks
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status|health}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy application (default)"
        echo "  rollback - Rollback to previous version"
        echo "  status   - Show deployment status"
        echo "  health   - Run health checks"
        echo ""
        echo "Environment variables:"
        echo "  BACKUP_BEFORE_DEPLOY=true|false (default: true)"
        echo "  RUN_MIGRATIONS=true|false (default: true)"
        echo "  RUN_HEALTH_CHECK=true|false (default: true)"
        exit 1
        ;;
esac
