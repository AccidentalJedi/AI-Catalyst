# AI Catalyst PostgreSQL Migration Guide

## Overview

This guide provides step-by-step instructions for migrating the AI Catalyst system from SQLite to PostgreSQL. The migration includes schema conversion, data transfer, and system configuration updates.

## Prerequisites

### 1. PostgreSQL Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Database Setup

```bash
# Create database user
sudo -u postgres createuser --interactive ai_catalyst_user

# Create database
sudo -u postgres createdb ai_catalyst_dev -O ai_catalyst_user

# Set password
sudo -u postgres psql -c "ALTER USER ai_catalyst_user PASSWORD 'your_secure_password';"
```

### 3. Environment Configuration

Update your `.env` file:

```env
# Database Configuration
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://ai_catalyst_user:your_password@localhost:5432/ai_catalyst_dev

# PostgreSQL Settings
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=ai_catalyst_dev
POSTGRES_USER=ai_catalyst_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_SSL=false

# Connection Pool Settings
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=20
POSTGRES_POOL_IDLE_TIMEOUT=30000
POSTGRES_POOL_CONNECTION_TIMEOUT=2000
```

## Migration Process

### Phase 1: Schema Migration

1. **Check Current Status**
   ```bash
   npm run db:status
   ```

2. **Create Backup**
   ```bash
   npm run db:backup:create
   ```

3. **Run Schema Migration**
   ```bash
   npm run db:migrate:latest
   ```

4. **Verify Schema**
   ```bash
   npm run db:status
   ```

### Phase 2: Data Migration

1. **Test Migration Setup**
   ```bash
   npm run test:migration-setup
   ```
   This validates:
   - Environment variables are configured
   - SQLite database is accessible and has data
   - PostgreSQL database is accessible and schema is ready

2. **Perform Data Migration**
   ```bash
   # Safe mode (default) - skips tables with existing data
   npm run db:migrate:data

   # Clean mode - clears existing data before migration
   npm run db:migrate:data:clean
   ```
   This script:
   - Validates both database connections
   - Migrates tables in dependency order
   - Uses batch processing for performance
   - Provides detailed progress reporting
   - Verifies migration success
   - **Safety Feature**: By default, skips tables with existing data to prevent data loss
   - **Clean Mode**: Use `--clean-destination` flag to clear existing data

3. **Verify Data Integrity**
   ```bash
   npm run test:user-service
   npm run test:auth-service
   ```

### Phase 3: System Configuration

1. **Update Environment Variables**
   - Set `DATABASE_TYPE=postgresql`
   - Configure PostgreSQL connection settings

2. **Restart Application**
   ```bash
   npm run dev
   ```

3. **Run Health Checks**
   ```bash
   curl http://localhost:3001/api/health
   ```

## Migration Commands Reference

### Schema Management
```bash
# Check migration status
npm run db:status
npm run db:status:json

# Run migrations
npm run db:migrate:latest
npm run db:migrate:up
npm run db:migrate:down

# Schema validation
npm run db:status
```

### Data Migration
```bash
# Data migration (with options)
npm run db:migrate:data                    # Full migration
npm run db:migrate:data:dry-run           # Preview only
npm run db:migrate:data -- --batch-size 500  # Custom batch size
npm run db:migrate:data -- --no-verify   # Skip verification
```

### Backup and Recovery
```bash
# Create backups
npm run db:backup:create
npm run db:backup:list
npm run db:backup:cleanup

# Rollback operations
npm run db:rollback:last
npm run db:rollback:version 3
npm run db:rollback:backup /path/to/backup.sql
```

### Data Integrity
```bash
# Verify data integrity
npm run db:verify:integrity
```

## Troubleshooting

### Common Issues

**1. Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check port configuration in `.env`

**2. Authentication Failed**
```
Error: password authentication failed for user "ai_catalyst_user"
```
- Verify username and password in `.env`
- Check PostgreSQL user permissions

**3. Database Does Not Exist**
```
Error: database "ai_catalyst_dev" does not exist
```
- Create database: `createdb ai_catalyst_dev -O ai_catalyst_user`

**4. Permission Denied**
```
Error: permission denied for table users
```
- Grant permissions: `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ai_catalyst_user;`

### Performance Optimization

**1. Connection Pool Tuning**
```env
POSTGRES_POOL_MIN=5
POSTGRES_POOL_MAX=50
POSTGRES_POOL_IDLE_TIMEOUT=10000
```

**2. Query Optimization**
```bash
# Analyze query performance
npm run db:status:json | jq '.queryPerformance'
```

**3. Index Optimization**
```sql
-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public';
```

## Rollback Procedures

### Emergency Rollback

If migration fails or issues are discovered:

1. **Stop Application**
   ```bash
   # Stop all services
   pkill -f "node.*ai-catalyst"
   ```

2. **Rollback to SQLite**
   ```bash
   # Update environment
   export DATABASE_TYPE=sqlite
   
   # Restore from backup if needed
   npm run db:rollback:backup /path/to/sqlite/backup.db
   ```

3. **Restart with SQLite**
   ```bash
   npm run dev
   ```

### Planned Rollback

For planned rollback to previous version:

```bash
# Rollback to specific version
npm run db:rollback:version 4

# Or rollback last migration
npm run db:rollback:last
```

## Validation Checklist

### Pre-Migration
- [ ] PostgreSQL installed and running
- [ ] Database and user created
- [ ] Environment variables configured
- [ ] Current SQLite backup created
- [ ] Application stopped

### Post-Migration
- [ ] Schema migration successful
- [ ] Data migration completed
- [ ] Data integrity verified
- [ ] Application starts successfully
- [ ] Health checks pass
- [ ] All features functional
- [ ] Performance acceptable

### Production Deployment
- [ ] Load testing completed
- [ ] Backup procedures tested
- [ ] Monitoring configured
- [ ] Rollback procedures documented
- [ ] Team trained on new system

## Performance Benchmarks

### Expected Improvements

| Metric | SQLite | PostgreSQL | Improvement |
|--------|--------|------------|-------------|
| Concurrent Users | 10-20 | 200+ | 10x+ |
| Query Response Time | 50-200ms | <100ms | 2x |
| Write Throughput | 100 ops/sec | 1000+ ops/sec | 10x+ |
| Database Size Limit | 281TB | Unlimited | ∞ |

### Monitoring

```bash
# Check connection pool status
npm run db:status:json | jq '.connectionPool'

# Monitor query performance
npm run db:status:json | jq '.queryPerformance'

# Check for slow queries
tail -f logs/database.log | grep "slow query"
```

## Security Considerations

### Database Security
- Use strong passwords for database users
- Enable SSL in production environments
- Restrict database access to application servers only
- Regular security updates for PostgreSQL

### Application Security
- Validate all database inputs
- Use parameterized queries (already implemented)
- Monitor for SQL injection attempts
- Regular audit log reviews

## Support and Resources

### Documentation
- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [Node.js PostgreSQL Guide](https://node-postgres.com/)
- [AI Catalyst Database Schema](./DATABASE_SCHEMA.md)

### Monitoring Tools
- pgAdmin for database administration
- pg_stat_statements for query analysis
- Prometheus + Grafana for metrics

### Getting Help
- Check application logs: `tail -f logs/app.log`
- Database logs: `tail -f /var/log/postgresql/postgresql-*.log`
- Create GitHub issue with migration logs and error details
