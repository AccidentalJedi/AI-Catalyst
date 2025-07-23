# AI Catalyst Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying AI Catalyst to a production environment using Docker, PostgreSQL, and comprehensive monitoring.

## Architecture

The production deployment includes:

- **Application**: Node.js/Express backend with TypeScript
- **Database**: PostgreSQL 15 with optimized configuration
- **Cache**: Redis for session storage and caching
- **Reverse Proxy**: Nginx with SSL termination and rate limiting
- **Monitoring**: Prometheus + Grafana for metrics and alerting
- **Backup**: Automated PostgreSQL backups with S3 storage
- **Security**: SSL/TLS, security headers, rate limiting, and firewall

## Prerequisites

### System Requirements

- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ recommended (16GB+ for high traffic)
- **Storage**: 100GB+ SSD recommended
- **Network**: Static IP address and domain name
- **OS**: Ubuntu 20.04+ LTS, CentOS 8+, or similar

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Git
- SSL certificates (Let's Encrypt recommended)

### External Services

- Domain name with DNS control
- SSL certificate (Let's Encrypt or commercial)
- DocuSign developer account
- AWS S3 bucket for backups (optional)
- SMTP service for email notifications

## Pre-Deployment Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reboot to apply group changes
sudo reboot
```

### 2. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Grafana (restrict to admin IPs)
sudo ufw allow 9090/tcp  # Prometheus (restrict to admin IPs)
```

### 3. SSL Certificate Setup

```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot

# Generate SSL certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates to project
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/project/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/project/ssl/private.key

# Generate DH parameters
sudo openssl dhparam -out /path/to/project/ssl/dhparam.pem 2048
```

## Deployment Process

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/AccidentalJedi/AI-Catalyst.git
cd AI-Catalyst/server

# Checkout production branch or tag
git checkout main  # or specific version tag
```

### 2. Environment Configuration

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit configuration with your values
nano .env.production
```

**Critical Configuration Items:**

```env
# Database
POSTGRES_PASSWORD=your_very_strong_password_here
DATABASE_URL=postgresql://ai_catalyst_user:your_password@postgres:5432/ai_catalyst_prod

# Security
JWT_SECRET=your_very_long_random_jwt_secret_here
ENCRYPTION_KEY=your_32_character_encryption_key_here

# DocuSign
DOCUSIGN_INTEGRATION_KEY=your_docusign_integration_key
DOCUSIGN_USER_ID=your_docusign_user_id
DOCUSIGN_ACCOUNT_ID=your_docusign_account_id
DOCUSIGN_PRIVATE_KEY=your_docusign_private_key

# Domain
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com

# Monitoring
GRAFANA_ADMIN_PASSWORD=your_grafana_admin_password

# Backup (optional)
S3_BACKUP_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### 3. Deploy Application

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh deploy
```

The deployment script will:
1. Check prerequisites
2. Create a backup (if existing data)
3. Build Docker images
4. Deploy containers
5. Run database migrations
6. Perform health checks
7. Show deployment status

### 4. Verify Deployment

```bash
# Check deployment status
./scripts/deploy.sh status

# Run health checks
./scripts/deploy.sh health

# Check application logs
docker-compose -f docker-compose.production.yml logs -f app
```

## Post-Deployment Configuration

### 1. DNS Configuration

Point your domain to the server IP:

```
A    your-domain.com        -> YOUR_SERVER_IP
A    www.your-domain.com    -> YOUR_SERVER_IP
```

### 2. SSL Certificate Renewal

Set up automatic SSL renewal:

```bash
# Add to crontab
sudo crontab -e

# Add this line for automatic renewal
0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook "docker-compose -f /path/to/project/docker-compose.production.yml restart nginx"
```

### 3. Monitoring Setup

Access monitoring dashboards:

- **Grafana**: https://your-domain.com:3000
- **Prometheus**: https://your-domain.com:9090

Default Grafana credentials:
- Username: admin
- Password: (set in GRAFANA_ADMIN_PASSWORD)

### 4. Backup Verification

```bash
# Test backup creation
docker-compose -f docker-compose.production.yml exec backup /usr/local/bin/backup.sh

# Verify backup files
ls -la backups/

# Test backup restoration (on test environment)
npm run perf:backup:test
```

## Maintenance Operations

### Application Updates

```bash
# Pull latest code
git pull origin main

# Deploy update
./scripts/deploy.sh deploy
```

### Database Maintenance

```bash
# Run migrations
docker-compose -f docker-compose.production.yml exec app npm run db:migrate:latest

# Create manual backup
docker-compose -f docker-compose.production.yml exec backup /usr/local/bin/backup.sh

# Check database status
docker-compose -f docker-compose.production.yml exec app npm run db:status
```

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.production.yml logs -f app

# View database logs
docker-compose -f docker-compose.production.yml logs -f postgres

# View nginx logs
docker-compose -f docker-compose.production.yml logs -f nginx

# Rotate logs (configure logrotate)
sudo nano /etc/logrotate.d/ai-catalyst
```

### Performance Monitoring

```bash
# Run performance tests
docker-compose -f docker-compose.production.yml exec app npm run perf:load:production

# Monitor system resources
htop
df -h
free -h

# Check database performance
docker-compose -f docker-compose.production.yml exec postgres psql -U ai_catalyst_user -d ai_catalyst_prod -c "SELECT * FROM pg_stat_activity;"
```

## Scaling and High Availability

### Horizontal Scaling

1. **Load Balancer**: Add multiple app containers behind a load balancer
2. **Database Replication**: Set up PostgreSQL read replicas
3. **Redis Cluster**: Configure Redis clustering for session storage
4. **CDN**: Use CloudFlare or AWS CloudFront for static assets

### Vertical Scaling

```bash
# Increase container resources
# Edit docker-compose.production.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Security Hardening

### 1. System Security

```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Enable fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 2. Application Security

- Regular security updates
- Dependency vulnerability scanning
- SSL/TLS configuration testing
- Rate limiting monitoring
- Access log analysis

### 3. Database Security

```bash
# PostgreSQL security configuration
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres -c "
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_statement = 'ddl';
SELECT pg_reload_conf();
"
```

## Troubleshooting

### Common Issues

1. **Container Won't Start**: Check logs and environment variables
2. **Database Connection Failed**: Verify PostgreSQL configuration
3. **SSL Certificate Issues**: Check certificate paths and permissions
4. **Performance Issues**: Monitor resource usage and database queries
5. **Backup Failures**: Check S3 credentials and permissions

### Emergency Procedures

```bash
# Emergency rollback
./scripts/deploy.sh rollback

# Emergency stop
docker-compose -f docker-compose.production.yml down

# Emergency database restore
# (Restore from latest backup)
```

## Support and Monitoring

### Health Checks

- Application: https://your-domain.com/api/health
- Database: Automated via Docker health checks
- SSL: Use SSL Labs test
- Performance: Automated load testing

### Alerting

Configure alerts for:
- Application downtime
- Database connectivity issues
- High resource usage
- Failed backups
- SSL certificate expiration

### Log Analysis

- Application errors
- Security events
- Performance bottlenecks
- User activity patterns

## Compliance and Legal

### Data Protection

- GDPR compliance for EU users
- Data encryption at rest and in transit
- Regular security audits
- User data retention policies

### Business Compliance

- FinCEN BOI reporting deadlines
- Corporate Transparency Act requirements
- Texas LLC formation compliance
- DocuSign legal validity

## Backup and Disaster Recovery

### Backup Strategy

- **Frequency**: Daily automated backups
- **Retention**: 30 days local, 1 year S3
- **Testing**: Monthly restore tests
- **Monitoring**: Backup success/failure alerts

### Disaster Recovery

1. **RTO**: 4 hours (Recovery Time Objective)
2. **RPO**: 24 hours (Recovery Point Objective)
3. **Backup Locations**: Local + S3
4. **Recovery Testing**: Quarterly

### Business Continuity

- Documented procedures
- Emergency contacts
- Vendor relationships
- Insurance coverage
