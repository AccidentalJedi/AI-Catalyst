# AI Catalyst Troubleshooting Guide

## Database Issues

### PostgreSQL Connection Problems

#### Error: `connect ECONNREFUSED 127.0.0.1:5432`

**Cause**: PostgreSQL server is not running or not accessible.

**Solutions**:
1. **Check if PostgreSQL is running**:
   ```bash
   # Ubuntu/Debian
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   
   # macOS
   brew services list | grep postgresql
   brew services start postgresql
   
   # Windows
   net start postgresql-x64-14
   ```

2. **Verify PostgreSQL is listening on correct port**:
   ```bash
   sudo netstat -tlnp | grep 5432
   # or
   sudo ss -tlnp | grep 5432
   ```

3. **Check PostgreSQL configuration**:
   ```bash
   # Edit postgresql.conf
   sudo nano /etc/postgresql/14/main/postgresql.conf
   
   # Ensure these settings:
   listen_addresses = 'localhost'
   port = 5432
   ```

#### Error: `password authentication failed for user "ai_catalyst_user"`

**Cause**: Incorrect username or password in environment variables.

**Solutions**:
1. **Verify user exists**:
   ```bash
   sudo -u postgres psql -c "\du"
   ```

2. **Reset user password**:
   ```bash
   sudo -u postgres psql -c "ALTER USER ai_catalyst_user PASSWORD 'new_password';"
   ```

3. **Check environment variables**:
   ```bash
   # Verify .env file contains correct credentials
   cat .env | grep POSTGRES
   ```

4. **Check pg_hba.conf authentication method**:
   ```bash
   sudo nano /etc/postgresql/14/main/pg_hba.conf
   
   # Ensure line exists:
   local   all             ai_catalyst_user                md5
   ```

#### Error: `database "ai_catalyst_dev" does not exist`

**Cause**: Database hasn't been created.

**Solutions**:
1. **Create database**:
   ```bash
   sudo -u postgres createdb ai_catalyst_dev -O ai_catalyst_user
   ```

2. **Verify database exists**:
   ```bash
   sudo -u postgres psql -l | grep ai_catalyst
   ```

### Migration Issues

#### Error: `Migration table does not exist`

**Cause**: Database schema hasn't been initialized.

**Solutions**:
1. **Run initial migration**:
   ```bash
   npm run db:migrate:latest
   ```

2. **Check migration status**:
   ```bash
   npm run db:status
   ```

#### Error: `Migration failed: relation already exists`

**Cause**: Attempting to run migrations on a database that already has some schema.

**Solutions**:
1. **Check current schema version**:
   ```bash
   npm run db:status:json
   ```

2. **Mark migrations as completed** (if schema already exists):
   ```bash
   # Connect to database and manually insert migration records
   psql -h localhost -U ai_catalyst_user -d ai_catalyst_dev
   INSERT INTO schema_migrations (version, applied_at) VALUES ('001', NOW());
   ```

3. **Reset database** (destructive - only for development):
   ```bash
   npm run db:rollback:version 0
   npm run db:migrate:latest
   ```

### Data Migration Issues

#### Error: `Data migration failed: table does not exist`

**Cause**: Target PostgreSQL database doesn't have the required schema.

**Solutions**:
1. **Ensure migrations are run first**:
   ```bash
   npm run db:migrate:latest
   npm run db:status
   ```

2. **Then run data migration**:
   ```bash
   npm run db:migrate:data
   ```

#### Error: `Foreign key constraint violation during data migration`

**Cause**: Data being migrated violates foreign key constraints.

**Solutions**:
1. **Run data migration with constraint checking disabled**:
   ```bash
   # Temporarily disable foreign key checks
   psql -h localhost -U ai_catalyst_user -d ai_catalyst_dev -c "SET session_replication_role = replica;"
   npm run db:migrate:data
   psql -h localhost -U ai_catalyst_user -d ai_catalyst_dev -c "SET session_replication_role = DEFAULT;"
   ```

2. **Clean up orphaned data in SQLite before migration**:
   ```bash
   # Check for orphaned records
   npm run db:verify:integrity
   ```

## Performance Issues

### Slow Query Performance

#### Symptoms: Queries taking >100ms consistently

**Diagnosis**:
1. **Enable query logging**:
   ```sql
   -- In PostgreSQL
   ALTER SYSTEM SET log_min_duration_statement = 100;
   SELECT pg_reload_conf();
   ```

2. **Check slow query log**:
   ```bash
   tail -f /var/log/postgresql/postgresql-14-main.log | grep "duration:"
   ```

**Solutions**:
1. **Add missing indexes**:
   ```sql
   -- Common indexes for AI Catalyst
   CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
   CREATE INDEX CONCURRENTLY idx_grant_matches_user_id ON grant_matches("userId");
   CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp ON audit_logs(timestamp);
   ```

2. **Analyze query plans**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM grant_matches WHERE "userId" = 'some-uuid';
   ```

3. **Update table statistics**:
   ```sql
   ANALYZE;
   ```

### Connection Pool Exhaustion

#### Error: `remaining connection slots are reserved`

**Cause**: Too many concurrent connections or connection leaks.

**Solutions**:
1. **Check current connections**:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'ai_catalyst_dev';
   ```

2. **Increase connection pool settings**:
   ```env
   # In .env
   POSTGRES_POOL_MAX=50
   POSTGRES_POOL_MIN=5
   ```

3. **Check for connection leaks in application**:
   ```bash
   # Monitor connection count over time
   watch -n 5 "psql -h localhost -U ai_catalyst_user -d ai_catalyst_dev -c \"SELECT count(*) FROM pg_stat_activity WHERE datname = 'ai_catalyst_dev';\""
   ```

## Application Issues

### Server Won't Start

#### Error: `Cannot find module '@utils/database'`

**Cause**: TypeScript path mapping not working or build issue.

**Solutions**:
1. **Clean and rebuild**:
   ```bash
   npm run clean
   npm run server:build
   npm run server:start
   ```

2. **Check tsconfig.json paths**:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@utils/*": ["./src/utils/*"]
       }
     }
   }
   ```

3. **Use development mode**:
   ```bash
   npm run server:dev
   ```

#### Error: `Port 3001 is already in use`

**Cause**: Another process is using the port.

**Solutions**:
1. **Find and kill process**:
   ```bash
   # Find process using port 3001
   lsof -ti:3001
   
   # Kill the process
   kill -9 $(lsof -ti:3001)
   ```

2. **Use different port**:
   ```env
   # In .env
   PORT=3002
   ```

### Authentication Issues

#### Error: `JWT token invalid or expired`

**Cause**: Token validation failing.

**Solutions**:
1. **Check JWT secret**:
   ```env
   # Ensure JWT_SECRET is set in .env
   JWT_SECRET=your-secret-key-here
   ```

2. **Clear browser storage**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

3. **Check token expiration**:
   ```bash
   # Decode JWT token to check expiration
   echo "your-jwt-token" | cut -d. -f2 | base64 -d | jq .exp
   ```

## Testing Issues

### Test Database Setup

#### Error: `Test database connection failed`

**Cause**: Test database not configured properly.

**Solutions**:
1. **Create test database**:
   ```bash
   sudo -u postgres createdb ai_catalyst_test -O ai_catalyst_user
   ```

2. **Set test environment variables**:
   ```env
   # In .env.test or set before running tests
   TEST_DATABASE_TYPE=postgresql
   TEST_POSTGRES_DATABASE=ai_catalyst_test
   ```

3. **Run tests with correct environment**:
   ```bash
   npm run test:postgresql
   ```

### Load Testing Issues

#### Error: `Load test failed: too many connections`

**Cause**: Database connection limits exceeded during load testing.

**Solutions**:
1. **Increase PostgreSQL connection limits**:
   ```sql
   -- In postgresql.conf
   max_connections = 200
   ```

2. **Adjust load test parameters**:
   ```bash
   # Use smaller batch sizes
   npm run perf:load:medium  # Instead of production
   ```

3. **Monitor system resources**:
   ```bash
   # Check memory and CPU usage
   htop
   
   # Check PostgreSQL stats
   psql -h localhost -U ai_catalyst_user -d ai_catalyst_dev -c "SELECT * FROM pg_stat_activity;"
   ```

## Environment Issues

### Docker Issues

#### Error: `PostgreSQL container won't start`

**Cause**: Port conflicts or volume issues.

**Solutions**:
1. **Check port availability**:
   ```bash
   docker ps | grep 5432
   netstat -tlnp | grep 5432
   ```

2. **Remove conflicting containers**:
   ```bash
   docker stop $(docker ps -q --filter "expose=5432")
   docker rm $(docker ps -aq --filter "expose=5432")
   ```

3. **Reset Docker volumes**:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

### Environment Variable Issues

#### Error: `Configuration validation failed`

**Cause**: Missing or invalid environment variables.

**Solutions**:
1. **Copy example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Validate environment variables**:
   ```bash
   # Check which variables are missing
   npm run config:validate
   ```

3. **Use development defaults**:
   ```bash
   # Start with minimal configuration
   NODE_ENV=development npm run server:dev
   ```

## Getting Help

### Log Analysis

1. **Application logs**:
   ```bash
   tail -f logs/app.log
   tail -f logs/error.log
   ```

2. **Database logs**:
   ```bash
   tail -f /var/log/postgresql/postgresql-14-main.log
   ```

3. **System logs**:
   ```bash
   journalctl -u postgresql -f
   ```

### Diagnostic Commands

```bash
# System information
npm run db:status:json
npm run perf:load:light
npm run db:verify:integrity

# Database health check
curl http://localhost:3001/api/health

# Connection test
psql -h localhost -U ai_catalyst_user -d ai_catalyst_dev -c "SELECT 1;"
```

### Support Resources

- **GitHub Issues**: [AI Catalyst Issues](https://github.com/AccidentalJedi/AI-Catalyst/issues)
- **PostgreSQL Documentation**: [PostgreSQL Docs](https://www.postgresql.org/docs/)
- **Node.js PostgreSQL Guide**: [node-postgres](https://node-postgres.com/)

### Creating Bug Reports

When reporting issues, include:

1. **Environment information**:
   - Operating system and version
   - Node.js version (`node --version`)
   - PostgreSQL version (`psql --version`)
   - npm version (`npm --version`)

2. **Error logs**:
   - Application error logs
   - Database error logs
   - Full stack traces

3. **Steps to reproduce**:
   - Exact commands run
   - Configuration used
   - Expected vs actual behavior

4. **System state**:
   - Output of `npm run db:status:json`
   - Database connection count
   - Available system resources
