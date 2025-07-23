# AI Catalyst Database-Agnostic Service Development Guidelines

## Overview

This document establishes the standard patterns and practices for developing database-agnostic services in the AI Catalyst project. These guidelines ensure that services work seamlessly across different database systems (SQLite for development, PostgreSQL for production) without code changes.

## Core Principles

### 1. Universal Database Compatibility
All services must work with both SQLite and PostgreSQL without modification.

### 2. Consistent API Patterns
Services should follow standardized patterns for database interaction, error handling, and data transformation.

### 3. Type Safety and Validation
Proper TypeScript typing and runtime validation ensure data integrity across database systems.

## Required Imports and Setup

### Standard Import Pattern
```typescript
// Import unified database utilities for database-agnostic operations
import { unifiedDbUtils as dbUtils } from '@utils/databaseAdapter';
```

### Additional Required Imports
```typescript
import crypto from 'crypto';                    // For UUID generation
import { dbLogger } from '@utils/logger';       // For consistent logging
import { /* audit functions */ } from '@utils/audit'; // For audit trails
```

## Database-Agnostic SQL Patterns

### ✅ REQUIRED: Parameter Placeholders
**Always use `?` placeholders, never database-specific syntax:**

```typescript
// ✅ CORRECT - Database-agnostic
const user = await dbUtils.get(`
  SELECT * FROM users WHERE id = ? AND isActive = ?
`, [userId, true]);

// ❌ WRONG - PostgreSQL-specific
const user = await dbUtils.get(`
  SELECT * FROM users WHERE id = $1 AND isActive = $2
`, [userId, true]);
```

### ✅ REQUIRED: JavaScript Date Objects
**Always use JavaScript Date objects, never database-specific date functions:**

```typescript
// ✅ CORRECT - Database-agnostic
await dbUtils.run(`
  INSERT INTO users (id, createdAt, updatedAt) 
  VALUES (?, ?, ?)
`, [userId, new Date(), new Date()]);

// ❌ WRONG - PostgreSQL-specific
await dbUtils.run(`
  INSERT INTO users (id, createdAt, updatedAt) 
  VALUES (?, NOW(), NOW())
`, [userId]);
```

### ✅ REQUIRED: UUID Generation
**Always use Node.js crypto for UUID generation:**

```typescript
// ✅ CORRECT - Database-agnostic
const id = crypto.randomUUID();

// ❌ WRONG - PostgreSQL-specific
const id = await dbUtils.get('SELECT gen_random_uuid() as id');
```

## Transaction Management

### Standard Transaction Pattern
```typescript
const result = await dbUtils.transaction(async (db) => {
  // Multiple related operations
  const userResult = await dbUtils.run(/* user creation */);
  await dbUtils.run(/* role assignment */);
  await dbUtils.run(/* preferences setup */);
  
  return userResult;
});
```

### Transaction Best Practices
- Keep transactions as short as possible
- Group related operations together
- Always return meaningful results
- Handle errors within transaction scope

## Data Type Conversion

### Database to JavaScript Type Conversion
```typescript
// Always convert database types to JavaScript types
return {
  id: user.id,
  isActive: Boolean(user.isActive),           // Ensure boolean consistency
  createdAt: new Date(user.createdAt),        // Convert to JavaScript Date
  updatedAt: new Date(user.updatedAt),        // Convert to JavaScript Date
  lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
  emailVerified: Boolean(user.emailVerified)  // Ensure boolean consistency
} as UserEntity;
```

### Dynamic Query Building
```typescript
// Build queries safely using arrays and joins
const updateFields: string[] = [];
const updateValues: any[] = [];

if (updateData.firstName) {
  updateFields.push('firstName = ?');
  updateValues.push(updateData.firstName);
}

updateFields.push('updatedAt = ?');
updateValues.push(new Date());
updateValues.push(userId); // Add WHERE clause parameter

await dbUtils.run(`
  UPDATE users SET ${updateFields.join(', ')} WHERE id = ?
`, updateValues);
```

## Error Handling Patterns

### Standard Error Handling
```typescript
export const serviceFunction = async (params: ParamType): Promise<ReturnType | null> => {
  try {
    // Service logic here
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    dbLogger.error('Service operation failed:', {
      error: errorMessage,
      params: Object.keys(params) // Log param keys, not values for security
    });
    
    // Return null or throw based on service contract
    return null;
  }
};
```

## Service Structure Template

### Complete Service Template
```typescript
/**
 * [ServiceName] - Database-Agnostic Implementation
 * 
 * This service follows AI Catalyst database-agnostic patterns:
 * ✅ Universal Parameter Placeholders (? syntax)
 * ✅ JavaScript Date Objects
 * ✅ Unified Database Adapter
 * ✅ Transaction Management
 * ✅ Type Conversion
 * ✅ UUID Generation
 */

import crypto from 'crypto';
import { unifiedDbUtils as dbUtils } from '@utils/databaseAdapter';
import { dbLogger } from '@utils/logger';
// Additional imports as needed

// TypeScript interfaces
export interface ServiceDataType {
  // Define your data structures
}

// Service functions following database-agnostic patterns
export const createEntity = async (data: ServiceDataType): Promise<EntityType> => {
  try {
    const entityId = crypto.randomUUID();
    
    const entity = await dbUtils.transaction(async (db) => {
      const result = await dbUtils.run(`
        INSERT INTO entities (id, field1, field2, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `, [entityId, data.field1, data.field2, new Date(), new Date()]);
      
      return result;
    });
    
    return entity;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbLogger.error('Failed to create entity:', { error: errorMessage });
    throw new Error('Entity creation failed');
  }
};
```

## Testing Requirements

### Required Test Coverage
Every database-agnostic service must include:

1. **Database Connection Tests** - Verify DatabaseAdapterFactory integration
2. **Function Validation Tests** - Test all service methods
3. **Error Handling Tests** - Validate error scenarios
4. **Edge Case Tests** - Test with invalid/missing data
5. **Resource Cleanup Tests** - Ensure proper connection management

### Test Script Template
Use `server/scripts/testUserService.ts` as a template for creating service-specific test scripts.

## Validation Checklist

Before deploying any database-agnostic service, verify:

- [ ] Uses `?` parameter placeholders (not `$1`, `$2`, etc.)
- [ ] Uses JavaScript `Date` objects (not database-specific functions)
- [ ] Uses `crypto.randomUUID()` (not database-specific UUID generation)
- [ ] Properly handles database type conversion (`Boolean`, `Date`, etc.)
- [ ] Uses `unifiedDbUtils` from DatabaseAdapterFactory
- [ ] Implements proper transaction management
- [ ] Includes comprehensive error handling
- [ ] Has corresponding test script
- [ ] Follows TypeScript best practices
- [ ] Includes audit logging where appropriate

## Reference Implementation

The `UserService` (`server/src/services/userService.ts`) serves as the reference implementation demonstrating all these patterns. Study this service for examples of:

- Proper import patterns
- Database-agnostic SQL syntax
- Transaction management
- Error handling
- Type conversion
- Testing approaches

## Additional Resources

- **Database Analysis**: `server/docs/Database-Agnostic-Analysis.md`
- **Test Template**: `server/scripts/testUserService.ts`
- **Database Adapter**: `server/src/utils/databaseAdapter.ts`
- **Configuration**: `knexfile.cjs`

## Support and Questions

For questions about database-agnostic service development:
1. Review the UserService implementation
2. Check existing documentation
3. Run validation tests using provided scripts
4. Ensure all checklist items are completed

Following these guidelines ensures consistent, maintainable, and portable database services across the AI Catalyst platform.
