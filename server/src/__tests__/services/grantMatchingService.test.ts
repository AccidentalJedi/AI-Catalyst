/**
 * @file Grant Matching Service Tests
 * Tests for the grant matching service with PostgreSQL async operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  ruleBasedFiltering, 
  getUserGrantMatches, 
  saveGrantMatches,
  updateGrantMatchFeedback 
} from '../../services/grantMatchingService';
import { 
  clearDatabase, 
  createTestVeteran, 
  createTestGrant, 
  createTestGrantMatch,
  waitForDatabase 
} from '../testDatabaseUtils';

describe('Grant Matching Service', () => {
  let testUser: any;
  let testGrant: any;

  beforeEach(async () => {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Clear database before each test
    await clearDatabase();
    
    // Create test data
    testUser = await createTestVeteran({
      email: 'veteran.test@example.com'
    });
    
    testGrant = await createTestGrant({
      grantName: 'Test Veteran Education Grant',
      minDisabilityRating: 50,
      maxGrantAmount: 10000
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await clearDatabase();
  });

  describe('ruleBasedFiltering', () => {
    it('should filter grants based on veteran profile', async () => {
      const veteranProfile = {
        disabilityRating: 70,
        state: 'TX',
        county: 'Travis',
        serviceEra: 'post_911',
        branchOfService: 'army'
      };

      const matches = await ruleBasedFiltering(veteranProfile);
      
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThan(0);
      
      // Should include our test grant since veteran meets criteria
      const matchingGrant = matches.find(grant => grant.id === testGrant.id);
      expect(matchingGrant).toBeDefined();
      expect(matchingGrant.grantName).toBe('Test Veteran Education Grant');
    });

    it('should exclude grants when veteran does not meet disability rating', async () => {
      const veteranProfile = {
        disabilityRating: 30, // Below minimum of 50
        state: 'TX',
        county: 'Travis',
        serviceEra: 'post_911',
        branchOfService: 'army'
      };

      const matches = await ruleBasedFiltering(veteranProfile);
      
      // Should not include our test grant
      const matchingGrant = matches.find(grant => grant.id === testGrant.id);
      expect(matchingGrant).toBeUndefined();
    });

    it('should handle empty results gracefully', async () => {
      const veteranProfile = {
        disabilityRating: 0,
        state: 'CA', // Different state
        county: 'Los Angeles',
        serviceEra: 'vietnam',
        branchOfService: 'navy'
      };

      const matches = await ruleBasedFiltering(veteranProfile);
      
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBe(0);
    });
  });

  describe('getUserGrantMatches', () => {
    it('should return user grant matches with grant details', async () => {
      // Create a grant match for the test user
      await createTestGrantMatch(testUser.id, testGrant.id, {
        matchScore: 0.90,
        eligibilityStatus: 'eligible'
      });

      const matches = await getUserGrantMatches(testUser.id, 10);
      
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBe(1);
      
      const match = matches[0];
      expect(match.userId).toBe(testUser.id);
      expect(match.grantId).toBe(testGrant.id);
      expect(match.matchScore).toBe(0.90);
      expect(match.eligibilityStatus).toBe('eligible');
      expect(match.grantName).toBe('Test Veteran Education Grant');
    });

    it('should limit results based on limit parameter', async () => {
      // Create multiple grant matches
      const grant2 = await createTestGrant({
        grantName: 'Second Test Grant',
        minDisabilityRating: 30
      });

      await createTestGrantMatch(testUser.id, testGrant.id);
      await createTestGrantMatch(testUser.id, grant2.id);

      const matches = await getUserGrantMatches(testUser.id, 1);
      
      expect(matches.length).toBe(1);
    });

    it('should return empty array for user with no matches', async () => {
      const matches = await getUserGrantMatches(testUser.id, 10);
      
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBe(0);
    });
  });

  describe('saveGrantMatches', () => {
    it('should save grant matches for a user', async () => {
      const matches = [
        {
          grantId: testGrant.id,
          matchScore: 0.85,
          eligibilityStatus: 'eligible' as const,
          matchReason: 'Meets all criteria',
          ruleBasedMatch: true,
          frictionAdjustedScore: 0.80,
          recommendationPriority: 1
        }
      ];

      await saveGrantMatches(testUser.id, matches);

      // Verify matches were saved
      const savedMatches = await getUserGrantMatches(testUser.id, 10);
      expect(savedMatches.length).toBe(1);
      
      const savedMatch = savedMatches[0];
      expect(savedMatch.matchScore).toBe(0.85);
      expect(savedMatch.eligibilityStatus).toBe('eligible');
      expect(savedMatch.matchReason).toBe('Meets all criteria');
    });

    it('should replace existing matches for a user', async () => {
      // Create initial match
      await createTestGrantMatch(testUser.id, testGrant.id);

      // Save new matches (should replace existing)
      const newMatches = [
        {
          grantId: testGrant.id,
          matchScore: 0.95,
          eligibilityStatus: 'eligible' as const,
          matchReason: 'Updated criteria',
          ruleBasedMatch: true,
          frictionAdjustedScore: 0.90,
          recommendationPriority: 1
        }
      ];

      await saveGrantMatches(testUser.id, newMatches);

      // Verify only new match exists
      const savedMatches = await getUserGrantMatches(testUser.id, 10);
      expect(savedMatches.length).toBe(1);
      expect(savedMatches[0].matchScore).toBe(0.95);
      expect(savedMatches[0].matchReason).toBe('Updated criteria');
    });
  });

  describe('updateGrantMatchFeedback', () => {
    let testMatch: any;

    beforeEach(async () => {
      testMatch = await createTestGrantMatch(testUser.id, testGrant.id);
    });

    it('should update user feedback', async () => {
      await updateGrantMatchFeedback(testUser.id, testGrant.id, {
        feedback: 'Very helpful grant information'
      });

      const matches = await getUserGrantMatches(testUser.id, 10);
      expect(matches[0].userFeedback).toBe('Very helpful grant information');
    });

    it('should update application status', async () => {
      await updateGrantMatchFeedback(testUser.id, testGrant.id, {
        applicationStarted: true,
        applicationCompleted: false
      });

      const matches = await getUserGrantMatches(testUser.id, 10);
      expect(matches[0].applicationStarted).toBe(true);
      expect(matches[0].applicationCompleted).toBe(false);
    });

    it('should update grant awarded status', async () => {
      await updateGrantMatchFeedback(testUser.id, testGrant.id, {
        grantAwarded: true
      });

      const matches = await getUserGrantMatches(testUser.id, 10);
      expect(matches[0].grantAwarded).toBe(true);
    });

    it('should handle multiple updates', async () => {
      await updateGrantMatchFeedback(testUser.id, testGrant.id, {
        feedback: 'Started application',
        applicationStarted: true
      });

      await updateGrantMatchFeedback(testUser.id, testGrant.id, {
        applicationCompleted: true
      });

      const matches = await getUserGrantMatches(testUser.id, 10);
      const match = matches[0];
      
      expect(match.userFeedback).toBe('Started application');
      expect(match.applicationStarted).toBe(true);
      expect(match.applicationCompleted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID gracefully', async () => {
      const matches = await getUserGrantMatches('invalid-user-id', 10);
      expect(matches).toEqual([]);
    });

    it('should handle invalid grant ID in feedback update', async () => {
      await expect(
        updateGrantMatchFeedback(testUser.id, 'invalid-grant-id', {
          feedback: 'Test feedback'
        })
      ).resolves.not.toThrow();
    });
  });
});
