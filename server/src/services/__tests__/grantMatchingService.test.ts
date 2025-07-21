import { findMatchingGrants, storeGrantMatches, getUserGrantMatches } from '../grantMatchingService';
import { dbUtils } from '@utils/database';
import { LLMClassificationService } from '../llmClassificationService';
import { VeteranProfile } from '../../types';

// Mock the database
jest.mock('@utils/database', () => ({
  dbUtils: {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
  },
}));

// Mock the LLM classification service
jest.mock('../llmClassificationService', () => ({
  LLMClassificationService: {
    getInstance: jest.fn(() => ({
      classifyEligibility: jest.fn(),
    })),
  },
}));

describe('Grant Matching Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should find matching grants for a veteran profile', async () => {
    // Mock the database responses
    (dbUtils.all as jest.Mock).mockReturnValue([
      {
        id: 'grant1',
        grantName: 'Test Grant 1',
        frictionScore: 3,
        maxGrantAmount: 1000,
        grantType: 'rent',
        requiredDocuments: '[]',
        actionableSteps: '[]',
        otherCriteriaText: '',
      },
    ]);
    (dbUtils.get as jest.Mock).mockReturnValue({
        frictionScore: 3,
        maxGrantAmount: 1000,
        grantType: 'rent',
    });

    const veteranProfile: VeteranProfile = {
      userId: 'user1',
      disabilityRating: 100,
      isPermanentAndTotal: true,
      state: 'TX',
      county: 'Travis',
      maritalStatus: 'single',
      hasMinorChildren: false,
      isHomelessOrAtRisk: false,
      serviceEra: 'post-9/11',
      branchOfService: 'Army',
      dischargeType: 'honorable',
      needs: ['rent'],
      availableDocuments: [],
    };

    const matches = await findMatchingGrants(veteranProfile);

    expect(matches).toHaveLength(1);
    expect(matches[0].grantId).toBe('grant1');
    expect(dbUtils.all).toHaveBeenCalled();
  });

  it('should store grant matches', async () => {
    const matches = [
      {
        grantId: 'grant1',
        matchScore: 0.8,
        eligibilityStatus: 'eligible',
        matchReason: 'Meets all criteria',
        ruleBasedMatch: true,
        frictionAdjustedScore: 0.7,
        recommendationPriority: 80,
      },
    ];

    await storeGrantMatches('user1', matches as any);

    expect(dbUtils.run).toHaveBeenCalledTimes(2); // One for delete, one for insert
  });

  it('should get user grant matches', () => {
    (dbUtils.all as jest.Mock).mockReturnValue([
      {
        grantId: 'grant1',
        grantName: 'Test Grant 1',
        frictionScore: 3,
        requiredDocuments: '[]',
        actionableSteps: '[]',
      },
    ]);

    const matches = getUserGrantMatches('user1');

    expect(matches).toHaveLength(1);
    expect(matches[0].grantId).toBe('grant1');
  });
});
