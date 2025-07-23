/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('boi_compliance', function (table) {
      table.uuid('id').primary();
      table.uuid('companyId').notNullable();
      table.string('reportingStatus', 50).defaultTo('pending');
      table.timestamp('filingDeadline');
      table.timestamp('filedAt');
      table.string('confirmationNumber', 100);
      table.json('filingData');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('companyId').references('id').inTable('companies');
    })
    .createTable('beneficial_owners', function (table) {
      table.uuid('id').primary();
      table.uuid('companyId').notNullable();
      table.string('firstName', 100).notNullable();
      table.string('lastName', 100).notNullable();
      table.date('dateOfBirth').notNullable();
      table.uuid('addressId').notNullable();
      table.string('ownershipPercentage', 10);
      table.boolean('isExempt').defaultTo(false);
      table.string('exemptionType', 100);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('companyId').references('id').inTable('companies');
      table.foreign('addressId').references('id').inTable('addresses');
    })
    .createTable('identification_documents', function (table) {
      table.uuid('id').primary();
      table.uuid('beneficialOwnerId').notNullable();
      table.string('documentType', 50).notNullable(); // 'passport', 'drivers_license', etc.
      table.string('documentNumber', 100).notNullable();
      table.string('issuingState', 2);
      table.string('issuingCountry', 3);
      table.date('expirationDate');
      table.string('documentImagePath', 500);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('beneficialOwnerId').references('id').inTable('beneficial_owners');
    })
    .createTable('document_templates', function (table) {
      table.uuid('id').primary();
      table.string('name', 255).notNullable();
      table.string('type', 100).notNullable(); // 'llc_formation', 'operating_agreement', etc.
      table.string('state', 2).notNullable();
      table.text('templateContent').notNullable();
      table.json('requiredFields');
      table.boolean('isActive').defaultTo(true);
      table.string('version', 20).defaultTo('1.0');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    })
    .createTable('documents', function (table) {
      table.uuid('id').primary();
      table.uuid('userId').notNullable();
      table.uuid('companyId');
      table.uuid('templateId');
      table.string('documentType', 100).notNullable();
      table.string('title', 255).notNullable();
      table.text('content');
      table.string('filePath', 500);
      table.string('status', 50).defaultTo('draft'); // 'draft', 'generated', 'signed', 'filed'
      table.json('formData');
      table.string('docusignEnvelopeId', 100);
      table.timestamp('generatedAt');
      table.timestamp('signedAt');
      table.timestamp('filedAt');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      
      table.foreign('userId').references('id').inTable('users');
      table.foreign('companyId').references('id').inTable('companies');
      table.foreign('templateId').references('id').inTable('document_templates');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('documents')
    .dropTableIfExists('document_templates')
    .dropTableIfExists('identification_documents')
    .dropTableIfExists('beneficial_owners')
    .dropTableIfExists('boi_compliance');
};
