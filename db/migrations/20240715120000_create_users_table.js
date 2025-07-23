/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('users', function (table) {
      table.uuid('id').primary();
      table.string('email', 255).unique().notNullable();
      table.string('firstName', 100).notNullable();
      table.string('lastName', 100).notNullable();
      table.string('phone', 20).notNullable();
      table.string('passwordHash', 255).notNullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      table.boolean('isActive').defaultTo(true);
      table.timestamp('lastLoginAt');
      table.boolean('emailVerified').defaultTo(false);
      table.string('emailVerificationToken', 255);
      table.string('passwordResetToken', 255);
      table.timestamp('passwordResetExpires');
    })
    .createTable('addresses', function (table) {
      table.uuid('id').primary();
      table.string('street', 255).notNullable();
      table.string('city', 100).notNullable();
      table.string('state', 2).notNullable();
      table.string('zipCode', 10).notNullable();
      table.string('county', 100);
      table.string('type', 50).notNullable(); // 'business', 'mailing', 'registered'
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    })
    .createTable('companies', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.string('legalName', 255).notNullable();
      table.string('businessType', 50).notNullable(); // 'LLC', 'Corporation', etc.
      table.string('formationState', 2).notNullable();
      table.uuid('businessAddressId');
      table.uuid('mailingAddressId');
      table.uuid('registeredAgentId');
      table.string('ein', 20);
      table.string('sosFileNumber', 50);
      table.string('status', 50).defaultTo('forming'); // 'forming', 'active', 'dissolved'
      table.timestamp('formationDate');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
      table.foreign('businessAddressId').references('id').inTable('addresses');
      table.foreign('mailingAddressId').references('id').inTable('addresses');
    })
    .createTable('registered_agents', function (table) {
      table.uuid('id').primary();
      table.string('name', 255).notNullable();
      table.uuid('addressId').notNullable();
      table.string('phone', 20);
      table.string('email', 255);
      table.boolean('isIndividual').defaultTo(true);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('addressId').references('id').inTable('addresses');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('registered_agents')
    .dropTableIfExists('companies')
    .dropTableIfExists('addresses')
    .dropTableIfExists('users');
};
