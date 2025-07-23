const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries (in dependency order)
  await knex('grant_matches').del();
  await knex('grant_opportunities').del();
  await knex('veteran_verification').del();
  await knex('user_roles').del();
  await knex('user_sessions').del();
  await knex('users').del();
  await knex('document_templates').del();

  // Insert test users
  const hashedPassword = await bcrypt.hash('password123', 10);
  const testUserId = uuidv4();
  const veteranUserId = uuidv4();

  await knex('users').insert([
    {
      id: testUserId,
      email: 'test.user@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-123-4567',
      passwordHash: hashedPassword,
      isActive: true,
      emailVerified: true,
    },
    {
      id: veteranUserId,
      email: 'test.veteran@example.com',
      firstName: 'John',
      lastName: 'Veteran',
      phone: '555-987-6543',
      passwordHash: hashedPassword,
      isActive: true,
      emailVerified: true,
    }
  ]);

  // Insert user roles
  await knex('user_roles').insert([
    {
      id: uuidv4(),
      userId: testUserId,
      role: 'user',
      isActive: true
    },
    {
      id: uuidv4(),
      userId: veteranUserId,
      role: 'veteran',
      isActive: true
    }
  ]);

  // Insert veteran verification for the veteran user
  await knex('veteran_verification').insert([
    {
      id: uuidv4(),
      userId: veteranUserId,
      verificationStatus: 'verified',
      county: 'Travis',
      vaDisabilityRating: 70,
      branchOfService: 'army',
      dischargeType: 'honorable',
      serviceEra: 'post_911',
      verificationData: JSON.stringify({
        dd214Verified: true,
        vaLetterVerified: true
      }),
      verifiedAt: new Date()
    }
  ]);

  // Insert document templates
  await knex('document_templates').insert([
    {
      id: uuidv4(),
      name: 'Texas LLC Articles of Organization',
      type: 'llc_formation',
      state: 'TX',
      templateContent: '<!-- Texas LLC Formation Template -->',
      requiredFields: JSON.stringify(['companyName', 'registeredAgent', 'businessAddress']),
      isActive: true,
      version: '1.0'
    },
    {
      id: uuidv4(),
      name: 'LLC Operating Agreement',
      type: 'operating_agreement',
      state: 'TX',
      templateContent: '<!-- LLC Operating Agreement Template -->',
      requiredFields: JSON.stringify(['companyName', 'members', 'managementStructure']),
      isActive: true,
      version: '1.0'
    }
  ]);

  // Insert sample grant opportunities
  await knex('grant_opportunities').insert([
    {
      id: uuidv4(),
      grantName: 'Texas Veterans Business Development Grant',
      grantingOrganization: 'Texas Veterans Commission',
      grantType: 'business_development',
      maxGrantAmount: 50000.00,
      minDisabilityRating: 30,
      frictionScore: 6,
      documentationBurden: 3,
      processSteps: 4,
      thirdPartyDependency: 2,
      ambiguityGatekeeping: 3,
      submissionMode: 2,
      eligibilityCriteria: JSON.stringify(['Texas resident', 'Veteran status', '30% disability rating']),
      requiredDocuments: JSON.stringify(['DD-214', 'VA disability letter', 'Business plan']),
      actionableSteps: JSON.stringify(['Verify eligibility', 'Prepare documents', 'Submit application']),
      description: 'Grant program to support veteran-owned business development in Texas',
      isActive: true
    },
    {
      id: uuidv4(),
      grantName: 'SBA Veterans Advantage Program',
      grantingOrganization: 'Small Business Administration',
      grantType: 'federal_program',
      maxGrantAmount: 25000.00,
      minDisabilityRating: 0,
      frictionScore: 4,
      documentationBurden: 2,
      processSteps: 3,
      thirdPartyDependency: 1,
      ambiguityGatekeeping: 2,
      submissionMode: 1,
      eligibilityCriteria: JSON.stringify(['Veteran status', 'Small business owner']),
      requiredDocuments: JSON.stringify(['DD-214', 'Business registration']),
      actionableSteps: JSON.stringify(['Register business', 'Apply online', 'Attend interview']),
      description: 'Federal program providing funding and support for veteran entrepreneurs',
      isActive: true
    }
  ]);
};
