# Database-Agnostic Development Quick Reference

## Essential Imports
```typescript
import { unifiedDbUtils as dbUtils } from '@utils/databaseAdapter';
import crypto from 'crypto';
import { dbLogger } from '@utils/logger';
```

## SQL Patterns

### ✅ DO - Parameter Placeholders
```typescript
await dbUtils.get('SELECT * FROM users WHERE id = ?', [userId]);
```

### ❌ DON'T - Database-Specific Syntax
```typescript
await dbUtils.get('SELECT * FROM users WHERE id = $1', [userId]);
```

## Date Handling

### ✅ DO - JavaScript Dates
```typescript
await dbUtils.run('INSERT INTO table (created) VALUES (?)', [new Date()]);
```

### ❌ DON'T - Database Functions
```typescript
await dbUtils.run('INSERT INTO table (created) VALUES (NOW())');
```

## UUID Generation

### ✅ DO - Node.js Crypto
```typescript
const id = crypto.randomUUID();
```

### ❌ DON'T - Database Functions
```typescript
const id = await dbUtils.get('SELECT gen_random_uuid()');
```

## Type Conversion

### ✅ DO - Explicit Conversion
```typescript
return {
  isActive: Boolean(row.isActive),
  createdAt: new Date(row.createdAt)
};
```

## Transaction Pattern
```typescript
const result = await dbUtils.transaction(async (db) => {
  await dbUtils.run(/* operation 1 */);
  await dbUtils.run(/* operation 2 */);
  return result;
});
```

## Error Handling
```typescript
try {
  // service logic
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  dbLogger.error('Operation failed:', { error: errorMessage });
  return null; // or throw
}
```

## Testing Checklist
- [ ] Database connection validation
- [ ] Service function tests
- [ ] Error handling tests
- [ ] Resource cleanup
- [ ] Cross-database compatibility

## Reference Files
- **Implementation**: `server/src/services/userService.ts`
- **Test Template**: `server/scripts/testUserService.ts`
- **Full Guidelines**: `server/docs/Database-Agnostic-Service-Development-Guidelines.md`
