import { dbLogger } from '@utils/logger';
import { dbUtils } from '@utils/database';

// NER training interfaces
export interface TrainingExample {
  text: string;
  entities: Array<{
    start: number;
    end: number;
    label: string;
  }>;
}

export interface NERModelConfig {
  modelName: string;
  entityTypes: string[];
  trainingData: TrainingExample[];
  validationData: TrainingExample[];
  hyperparameters: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    dropout: number;
  };
}

/**
 * Custom NER model training service for grant-specific entities
 * Designed to work with spaCy v3.7+ for production deployment
 */
export class NERTrainingService {
  private static instance: NERTrainingService;
  
  // Grant-specific entity types as defined in the framework
  private readonly GRANT_ENTITY_TYPES = [
    'ELIGIBILITY_CRITERION',
    'DOCUMENT_TYPE', 
    'DISCHARGE_STATUS',
    'TARGET_POPULATION',
    'DISABILITY_RATING',
    'INCOME_REQUIREMENT',
    'GEOGRAPHIC_RESTRICTION',
    'SERVICE_ERA',
    'APPLICATION_DEADLINE',
    'GRANT_AMOUNT',
    'CONTACT_INFO'
  ];
  
  public static getInstance(): NERTrainingService {
    if (!NERTrainingService.instance) {
      NERTrainingService.instance = new NERTrainingService();
    }
    return NERTrainingService.instance;
  }
  
  /**
   * Generate training data for custom NER model
   */
  async generateTrainingData(): Promise<NERModelConfig> {
    try {
      dbLogger.info('Starting NER training data generation');
      
      // Get grant data from database for training
      const grants = dbUtils.all(`
        SELECT grantName, grantDescription, eligibilityCriteria, 
               otherCriteriaText, requiredDocuments, applicationProcess
        FROM grant_opportunities 
        WHERE isActive = 1
      `);
      
      const trainingExamples: TrainingExample[] = [];
      const validationExamples: TrainingExample[] = [];
      
      // Generate training examples from grant data
      for (const grant of grants) {
        const examples = await this.createTrainingExamplesFromGrant(grant);
        
        // Split 80/20 for training/validation
        const splitIndex = Math.floor(examples.length * 0.8);
        trainingExamples.push(...examples.slice(0, splitIndex));
        validationExamples.push(...examples.slice(splitIndex));
      }
      
      // Add synthetic training examples
      const syntheticExamples = await this.generateSyntheticTrainingData();
      trainingExamples.push(...syntheticExamples);
      
      const config: NERModelConfig = {
        modelName: 'grant_ner_model',
        entityTypes: this.GRANT_ENTITY_TYPES,
        trainingData: trainingExamples,
        validationData: validationExamples,
        hyperparameters: {
          learningRate: 0.001,
          batchSize: 16,
          epochs: 20,
          dropout: 0.2
        }
      };
      
      dbLogger.info('NER training data generated', {
        trainingExamples: trainingExamples.length,
        validationExamples: validationExamples.length,
        entityTypes: this.GRANT_ENTITY_TYPES.length
      });
      
      return config;
      
    } catch (error) {
      dbLogger.error('NER training data generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Create training examples from grant data
   */
  private async createTrainingExamplesFromGrant(grant: any): Promise<TrainingExample[]> {
    const examples: TrainingExample[] = [];
    
    try {
      // Process grant description
      if (grant.grantDescription) {
        const descriptionExample = await this.annotateText(grant.grantDescription);
        if (descriptionExample) examples.push(descriptionExample);
      }
      
      // Process eligibility criteria
      if (grant.eligibilityCriteria) {
        const criteriaExample = await this.annotateText(grant.eligibilityCriteria);
        if (criteriaExample) examples.push(criteriaExample);
      }
      
      // Process other criteria text
      if (grant.otherCriteriaText) {
        const otherExample = await this.annotateText(grant.otherCriteriaText);
        if (otherExample) examples.push(otherExample);
      }
      
      // Process required documents
      if (grant.requiredDocuments) {
        const docsExample = await this.annotateText(grant.requiredDocuments);
        if (docsExample) examples.push(docsExample);
      }
      
    } catch (error) {
      dbLogger.error('Failed to create training examples from grant:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        grantName: grant.grantName
      });
    }
    
    return examples;
  }
  
  /**
   * Annotate text with entity labels for training
   */
  private async annotateText(text: string): Promise<TrainingExample | null> {
    try {
      const entities: Array<{ start: number; end: number; label: string }> = [];
      
      // Annotate disability ratings
      const disabilityMatches = [...text.matchAll(/(\d{1,3})%?\s*(?:disability|disabled|rating)/gi)];
      for (const match of disabilityMatches) {
        entities.push({
          start: match.index!,
          end: match.index! + match[0].length,
          label: 'DISABILITY_RATING'
        });
      }
      
      // Annotate document types
      const documentPatterns = [
        { pattern: /DD-?214/gi, label: 'DOCUMENT_TYPE' },
        { pattern: /VA\s+disability\s+letter/gi, label: 'DOCUMENT_TYPE' },
        { pattern: /discharge\s+papers/gi, label: 'DOCUMENT_TYPE' },
        { pattern: /tax\s+returns?/gi, label: 'DOCUMENT_TYPE' },
        { pattern: /bank\s+statements?/gi, label: 'DOCUMENT_TYPE' },
        { pattern: /W-?9\s+form/gi, label: 'DOCUMENT_TYPE' }
      ];
      
      for (const { pattern, label } of documentPatterns) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
          entities.push({
            start: match.index!,
            end: match.index! + match[0].length,
            label
          });
        }
      }
      
      // Annotate target populations
      const populationPatterns = [
        { pattern: /veterans?/gi, label: 'TARGET_POPULATION' },
        { pattern: /spouses?/gi, label: 'TARGET_POPULATION' },
        { pattern: /dependents?/gi, label: 'TARGET_POPULATION' },
        { pattern: /surviving\s+spouses?/gi, label: 'TARGET_POPULATION' }
      ];
      
      for (const { pattern, label } of populationPatterns) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
          entities.push({
            start: match.index!,
            end: match.index! + match[0].length,
            label
          });
        }
      }
      
      // Annotate discharge status
      const dischargeMatches = [...text.matchAll(/(?:honorable|general|other\s+than\s+honorable|dishonorable)\s+discharge/gi)];
      for (const match of dischargeMatches) {
        entities.push({
          start: match.index!,
          end: match.index! + match[0].length,
          label: 'DISCHARGE_STATUS'
        });
      }
      
      // Annotate income requirements
      const incomeMatches = [...text.matchAll(/income\s+(?:must\s+be\s+)?(?:below|under|less\s+than)\s+\$?[\d,]+/gi)];
      for (const match of incomeMatches) {
        entities.push({
          start: match.index!,
          end: match.index! + match[0].length,
          label: 'INCOME_REQUIREMENT'
        });
      }
      
      // Annotate grant amounts
      const amountMatches = [...text.matchAll(/(?:up\s+to\s+)?\$[\d,]+(?:\.\d{2})?/g)];
      for (const match of amountMatches) {
        entities.push({
          start: match.index!,
          end: match.index! + match[0].length,
          label: 'GRANT_AMOUNT'
        });
      }
      
      // Only return if we found entities
      if (entities.length > 0) {
        return {
          text,
          entities: entities.sort((a, b) => a.start - b.start)
        };
      }
      
      return null;
      
    } catch (error) {
      dbLogger.error('Text annotation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length
      });
      return null;
    }
  }
  
  /**
   * Generate synthetic training data for better model coverage
   */
  private async generateSyntheticTrainingData(): Promise<TrainingExample[]> {
    const syntheticExamples: TrainingExample[] = [
      {
        text: "Veterans with a 100% disability rating are eligible for this grant.",
        entities: [
          { start: 0, end: 8, label: 'TARGET_POPULATION' },
          { start: 16, end: 35, label: 'DISABILITY_RATING' }
        ]
      },
      {
        text: "Required documents include DD-214 and VA disability letter.",
        entities: [
          { start: 27, end: 33, label: 'DOCUMENT_TYPE' },
          { start: 38, end: 58, label: 'DOCUMENT_TYPE' }
        ]
      },
      {
        text: "Applicants must have an honorable discharge from military service.",
        entities: [
          { start: 24, end: 42, label: 'DISCHARGE_STATUS' }
        ]
      },
      {
        text: "Income must be below $50,000 annually to qualify.",
        entities: [
          { start: 0, end: 37, label: 'INCOME_REQUIREMENT' }
        ]
      },
      {
        text: "Grant provides up to $5,000 for emergency assistance.",
        entities: [
          { start: 17, end: 27, label: 'GRANT_AMOUNT' }
        ]
      },
      {
        text: "Available to Texas residents and their dependents.",
        entities: [
          { start: 12, end: 27, label: 'GEOGRAPHIC_RESTRICTION' },
          { start: 38, end: 48, label: 'TARGET_POPULATION' }
        ]
      },
      {
        text: "Post-9/11 veterans with minor children in the home are eligible.",
        entities: [
          { start: 0, end: 18, label: 'SERVICE_ERA' },
          { start: 24, end: 51, label: 'ELIGIBILITY_CRITERION' }
        ]
      }
    ];
    
    return syntheticExamples;
  }
  
  /**
   * Export training data in spaCy format
   */
  async exportSpacyTrainingData(config: NERModelConfig): Promise<string> {
    try {
      const spacyData = {
        training: config.trainingData.map(example => [
          example.text,
          { entities: example.entities.map(ent => [ent.start, ent.end, ent.label]) }
        ]),
        validation: config.validationData.map(example => [
          example.text,
          { entities: example.entities.map(ent => [ent.start, ent.end, ent.label]) }
        ])
      };
      
      const jsonData = JSON.stringify(spacyData, null, 2);
      
      dbLogger.info('spaCy training data exported', {
        trainingSize: config.trainingData.length,
        validationSize: config.validationData.length
      });
      
      return jsonData;
      
    } catch (error) {
      dbLogger.error('Failed to export spaCy training data:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}


