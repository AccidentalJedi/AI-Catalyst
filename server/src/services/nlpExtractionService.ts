import { dbUtils } from '@utils/databaseAdapter';
import { dbLogger } from '@utils/logger';
import { NERTrainingService } from './nerTrainingService';

// NLP extraction interfaces
export interface ExtractedEntity {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
}

export interface StructuredGrantData {
  eligibilityCriteria: {
    minDisabilityRating?: number;
    targetPopulation: string[];
    residencyRequired: string[];
    serviceEraRequired: string[];
    incomeRequirements?: any;
    otherCriteria: string[];
  };
  applicationProcess: {
    applicationURL?: string;
    applicationWindow?: string;
    requiredDocuments: string[];
    actionableSteps: string[];
  };
  grantDetails: {
    maxGrantAmount?: number;
    grantType?: string;
    averageProcessingTime?: number;
  };
}

/**
 * Extract structured data from grant description text using NLP
 * Enhanced with custom NER model for grant-specific entities
 */
export const extractGrantData = async (
  grantText: string,
  grantId?: string
): Promise<StructuredGrantData> => {
  try {
    dbLogger.info('Starting enhanced NLP extraction', {
      grantId,
      textLength: grantText.length
    });

    // Perform entity extraction with custom NER
    const entities = await extractEntitiesWithCustomNER(grantText);

    // Structure the extracted data
    const structuredData = await structureExtractedData(entities, grantText);

    // Validate and enrich the structured data
    const enrichedData = await enrichStructuredData(structuredData, grantText);

    dbLogger.info('Enhanced NLP extraction completed', {
      grantId,
      entitiesFound: entities.length,
      criteriaCount: enrichedData.eligibilityCriteria.otherCriteria.length
    });

    return enrichedData;

  } catch (error) {
    dbLogger.error('Enhanced NLP extraction failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      grantId
    });

    // Fallback to basic pattern extraction
    try {
      const entities = await extractEntities(grantText);
      return await structureExtractedData(entities, grantText);
    } catch (fallbackError) {
      // Return empty structure on complete failure
      return {
        eligibilityCriteria: {
          targetPopulation: [],
          residencyRequired: [],
          serviceEraRequired: [],
          otherCriteria: []
        },
        applicationProcess: {
          requiredDocuments: [],
          actionableSteps: []
        },
        grantDetails: {}
      };
    }
  }
};

/**
 * Extract named entities from text
 * TODO: Replace with spaCy custom NER model
 */
const extractEntities = async (text: string): Promise<ExtractedEntity[]> => {
  const entities: ExtractedEntity[] = [];
  
  try {
    // Pattern-based entity extraction (temporary implementation)
    
    // Extract disability ratings
    const disabilityMatches = text.matchAll(/(\d{1,3})%?\s*(?:disability|disabled|rating)/gi);
    for (const match of disabilityMatches) {
      entities.push({
        text: match[0],
        label: 'DISABILITY_RATING',
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        confidence: 0.9
      });
    }
    
    // Extract document types
    const documentPatterns = [
      /DD-?214/gi,
      /VA\s+disability\s+letter/gi,
      /discharge\s+papers/gi,
      /tax\s+returns?/gi,
      /bank\s+statements?/gi,
      /income\s+verification/gi,
      /W-?9\s+form/gi,
      /budget\s+worksheet/gi
    ];
    
    for (const pattern of documentPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'DOCUMENT_TYPE',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence: 0.8
        });
      }
    }
    
    // Extract target populations
    const populationPatterns = [
      /veterans?/gi,
      /spouses?/gi,
      /dependents?/gi,
      /children/gi,
      /surviving\s+spouses?/gi,
      /family\s+members?/gi
    ];
    
    for (const pattern of populationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'TARGET_POPULATION',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence: 0.7
        });
      }
    }
    
    // Extract geographic entities
    const stateMatches = text.matchAll(/\b(Texas|TX|California|CA|Florida|FL|New York|NY)\b/gi);
    for (const match of stateMatches) {
      entities.push({
        text: match[0],
        label: 'STATE',
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        confidence: 0.9
      });
    }
    
    // Extract county names (Texas-specific)
    const countyMatches = text.matchAll(/\b(Harris|Dallas|Tarrant|Bexar|Travis|Collin|Denton|Fort Bend|Williamson|Hidalgo)\s+County\b/gi);
    for (const match of countyMatches) {
      entities.push({
        text: match[0],
        label: 'COUNTY',
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        confidence: 0.8
      });
    }
    
    // Extract monetary amounts
    const moneyMatches = text.matchAll(/\$[\d,]+(?:\.\d{2})?/g);
    for (const match of moneyMatches) {
      entities.push({
        text: match[0],
        label: 'MONEY',
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        confidence: 0.9
      });
    }
    
    // Extract URLs
    const urlMatches = text.matchAll(/https?:\/\/[^\s]+/gi);
    for (const match of urlMatches) {
      entities.push({
        text: match[0],
        label: 'URL',
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
        confidence: 0.95
      });
    }
    
    return entities;
    
  } catch (error) {
    dbLogger.error('Entity extraction failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
};

/**
 * Structure extracted entities into grant data format
 */
const structureExtractedData = async (
  entities: ExtractedEntity[],
  originalText: string
): Promise<StructuredGrantData> => {
  const structuredData: StructuredGrantData = {
    eligibilityCriteria: {
      targetPopulation: [],
      residencyRequired: [],
      serviceEraRequired: [],
      otherCriteria: []
    },
    applicationProcess: {
      requiredDocuments: [],
      actionableSteps: []
    },
    grantDetails: {}
  };
  
  // Process entities by type
  for (const entity of entities) {
    switch (entity.label) {
      case 'DISABILITY_RATING':
        const rating = parseInt(entity.text.match(/\d+/)?.[0] || '0');
        if (rating > 0) {
          structuredData.eligibilityCriteria.minDisabilityRating = rating;
        }
        break;
        
      case 'DOCUMENT_TYPE':
        if (!structuredData.applicationProcess.requiredDocuments.includes(entity.text)) {
          structuredData.applicationProcess.requiredDocuments.push(entity.text);
        }
        break;
        
      case 'TARGET_POPULATION':
        const population = entity.text.toLowerCase();
        if (!structuredData.eligibilityCriteria.targetPopulation.includes(population)) {
          structuredData.eligibilityCriteria.targetPopulation.push(population);
        }
        break;
        
      case 'STATE':
        const state = entity.text.toUpperCase();
        if (!structuredData.eligibilityCriteria.residencyRequired.includes(state)) {
          structuredData.eligibilityCriteria.residencyRequired.push(state);
        }
        break;
        
      case 'COUNTY':
        if (!structuredData.eligibilityCriteria.residencyRequired.includes(entity.text)) {
          structuredData.eligibilityCriteria.residencyRequired.push(entity.text);
        }
        break;
        
      case 'MONEY':
        const amount = parseFloat(entity.text.replace(/[$,]/g, ''));
        if (amount > 0 && !structuredData.grantDetails.maxGrantAmount) {
          structuredData.grantDetails.maxGrantAmount = amount;
        }
        break;
        
      case 'URL':
        if (!structuredData.applicationProcess.applicationURL) {
          structuredData.applicationProcess.applicationURL = entity.text;
        }
        break;
    }
  }
  
  // Extract additional criteria from text patterns
  structuredData.eligibilityCriteria.otherCriteria = extractComplexCriteria(originalText);
  
  // Extract actionable steps
  structuredData.applicationProcess.actionableSteps = extractActionableSteps(originalText);
  
  return structuredData;
};

/**
 * Extract complex eligibility criteria that require LLM analysis
 */
const extractComplexCriteria = (text: string): string[] => {
  const criteria: string[] = [];
  
  // Look for income-related criteria
  const incomePatterns = [
    /income\s+(?:must\s+)?(?:be\s+)?(?:below|under|less\s+than)[^.]+/gi,
    /financial\s+need[^.]+/gi,
    /hardship[^.]+/gi
  ];
  
  for (const pattern of incomePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      criteria.push(...matches);
    }
  }
  
  // Look for family-related criteria
  const familyPatterns = [
    /(?:must\s+have|require[sd]?)\s+(?:minor\s+)?children[^.]+/gi,
    /dependent[^.]+/gi,
    /family\s+size[^.]+/gi
  ];
  
  for (const pattern of familyPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      criteria.push(...matches);
    }
  }
  
  return criteria;
};

/**
 * Extract actionable steps from application process text
 */
const extractActionableSteps = (text: string): string[] => {
  const steps: string[] = [];

  // Look for numbered steps
  const numberedSteps = text.match(/\d+\.\s+[^.]+\./g);
  if (numberedSteps) {
    steps.push(...numberedSteps);
  }

  // Look for bullet points
  const bulletSteps = text.match(/[•\-\*]\s+[^.]+\./g);
  if (bulletSteps) {
    steps.push(...bulletSteps);
  }

  // Look for imperative sentences (commands)
  const imperativePatterns = [
    /(?:submit|provide|complete|fill\s+out|attach|include)[^.]+\./gi,
    /(?:visit|go\s+to|navigate\s+to)[^.]+\./gi,
    /(?:contact|call|email)[^.]+\./gi
  ];

  for (const pattern of imperativePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      steps.push(...matches);
    }
  }

  return steps.slice(0, 10); // Limit to 10 steps
};

/**
 * Enhanced entity extraction using custom NER model
 * TODO: Integrate with trained spaCy model when available
 */
const extractEntitiesWithCustomNER = async (text: string): Promise<ExtractedEntity[]> => {
  try {
    // For now, use enhanced pattern matching with grant-specific entities
    // This will be replaced with actual spaCy NER model inference

    const entities: ExtractedEntity[] = [];

    // Enhanced disability rating extraction
    const disabilityPatterns = [
      /(\d{1,3})%\s*(?:service[- ]connected\s+)?(?:disability|disabled|rating)/gi,
      /(?:disability|disabled)\s+(?:rating\s+of\s+)?(\d{1,3})%/gi,
      /(\d{1,3})\s*percent\s+(?:disability|disabled)/gi
    ];

    for (const pattern of disabilityPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'DISABILITY_RATING',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence: 0.95
        });
      }
    }

    // Enhanced document type extraction
    const documentPatterns = [
      { pattern: /DD[- ]?214/gi, confidence: 0.98 },
      { pattern: /VA\s+disability\s+(?:rating\s+)?letter/gi, confidence: 0.95 },
      { pattern: /certificate\s+of\s+eligibility/gi, confidence: 0.9 },
      { pattern: /discharge\s+(?:certificate|papers|documentation)/gi, confidence: 0.9 },
      { pattern: /tax\s+returns?\s*(?:form\s+1040)?/gi, confidence: 0.85 },
      { pattern: /bank\s+statements?/gi, confidence: 0.85 },
      { pattern: /income\s+verification/gi, confidence: 0.9 },
      { pattern: /W-?9\s+form/gi, confidence: 0.9 },
      { pattern: /budget\s+worksheet/gi, confidence: 0.85 },
      { pattern: /proof\s+of\s+(?:income|residency|identity)/gi, confidence: 0.8 }
    ];

    for (const { pattern, confidence } of documentPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'DOCUMENT_TYPE',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence
        });
      }
    }

    // Enhanced eligibility criteria extraction
    const eligibilityPatterns = [
      { pattern: /(?:must\s+have|require[sd]?)\s+(?:minor\s+)?children\s+(?:in\s+the\s+home|under\s+\d+)/gi, confidence: 0.9 },
      { pattern: /income\s+(?:must\s+be\s+)?(?:below|under|less\s+than)\s+\$?[\d,]+/gi, confidence: 0.9 },
      { pattern: /(?:homeless|at[- ]risk\s+of\s+homelessness)/gi, confidence: 0.85 },
      { pattern: /(?:honorable|general|other\s+than\s+honorable)\s+discharge/gi, confidence: 0.9 },
      { pattern: /post[- ]9\/11\s+(?:veteran|service)/gi, confidence: 0.9 },
      { pattern: /wartime\s+(?:veteran|service)/gi, confidence: 0.85 }
    ];

    for (const { pattern, confidence } of eligibilityPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'ELIGIBILITY_CRITERION',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence
        });
      }
    }

    // Enhanced target population extraction
    const populationPatterns = [
      { pattern: /(?:disabled\s+)?veterans?/gi, confidence: 0.9 },
      { pattern: /(?:surviving\s+)?spouses?/gi, confidence: 0.85 },
      { pattern: /(?:dependent\s+)?children/gi, confidence: 0.8 },
      { pattern: /family\s+members?/gi, confidence: 0.75 },
      { pattern: /beneficiaries/gi, confidence: 0.8 }
    ];

    for (const { pattern, confidence } of populationPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'TARGET_POPULATION',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence
        });
      }
    }

    // Enhanced geographic restriction extraction
    const geoPatterns = [
      { pattern: /Texas\s+(?:residents?|counties?)/gi, confidence: 0.95 },
      { pattern: /\b(Harris|Dallas|Tarrant|Bexar|Travis|Collin|Denton|Fort\s+Bend|Williamson|Hidalgo)\s+County\b/gi, confidence: 0.9 },
      { pattern: /\b(TX|Texas)\b/gi, confidence: 0.8 }
    ];

    for (const { pattern, confidence } of geoPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'GEOGRAPHIC_RESTRICTION',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence
        });
      }
    }

    // Enhanced grant amount extraction
    const amountPatterns = [
      { pattern: /(?:up\s+to\s+)?\$[\d,]+(?:\.\d{2})?/g, confidence: 0.9 },
      { pattern: /(?:maximum\s+(?:of\s+)?)?\$[\d,]+/gi, confidence: 0.85 },
      { pattern: /grants?\s+(?:of\s+)?(?:up\s+to\s+)?\$[\d,]+/gi, confidence: 0.9 }
    ];

    for (const { pattern, confidence } of amountPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          label: 'GRANT_AMOUNT',
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
          confidence
        });
      }
    }

    // Sort entities by position and remove overlaps
    const sortedEntities = entities.sort((a, b) => a.start - b.start);
    const nonOverlappingEntities = removeOverlappingEntities(sortedEntities);

    return nonOverlappingEntities;

  } catch (error) {
    dbLogger.error('Enhanced entity extraction failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Fallback to basic extraction
    return await extractEntities(text);
  }
};

/**
 * Remove overlapping entities, keeping the one with higher confidence
 */
const removeOverlappingEntities = (entities: ExtractedEntity[]): ExtractedEntity[] => {
  const filtered: ExtractedEntity[] = [];

  for (const entity of entities) {
    const hasOverlap = filtered.some(existing =>
      (entity.start < existing.end && entity.end > existing.start)
    );

    if (!hasOverlap) {
      filtered.push(entity);
    } else {
      // Replace if current entity has higher confidence
      const overlappingIndex = filtered.findIndex(existing =>
        entity.start < existing.end && entity.end > existing.start
      );

      if (overlappingIndex >= 0 && entity.confidence > filtered[overlappingIndex].confidence) {
        filtered[overlappingIndex] = entity;
      }
    }
  }

  return filtered;
};

/**
 * Enrich structured data with additional analysis
 */
const enrichStructuredData = async (
  data: StructuredGrantData,
  originalText: string
): Promise<StructuredGrantData> => {
  try {
    // Enhance eligibility criteria with context analysis
    const contextualCriteria = analyzeEligibilityContext(originalText);
    data.eligibilityCriteria.otherCriteria.push(...contextualCriteria);

    // Enhance application process with deadline detection
    const deadlines = extractApplicationDeadlines(originalText);
    if (deadlines.length > 0) {
      data.applicationProcess.applicationWindow = deadlines[0];
    }

    // Enhance grant details with processing time
    const processingTime = extractProcessingTime(originalText);
    if (processingTime) {
      data.grantDetails.averageProcessingTime = processingTime;
    }

    return data;

  } catch (error) {
    dbLogger.error('Data enrichment failed:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return data;
  }
};

/**
 * Analyze eligibility context for complex criteria
 */
const analyzeEligibilityContext = (text: string): string[] => {
  const criteria: string[] = [];

  // Look for conditional statements
  const conditionalPatterns = [
    /if\s+[^.]+\./gi,
    /provided\s+that\s+[^.]+\./gi,
    /subject\s+to\s+[^.]+\./gi,
    /contingent\s+(?:on|upon)\s+[^.]+\./gi
  ];

  for (const pattern of conditionalPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      criteria.push(...matches);
    }
  }

  return criteria.slice(0, 5); // Limit to 5 criteria
};

/**
 * Extract application deadlines
 */
const extractApplicationDeadlines = (text: string): string[] => {
  const deadlines: string[] = [];

  const deadlinePatterns = [
    /(?:deadline|due\s+date|apply\s+by)[:\s]+[^.]+/gi,
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/gi,
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    /rolling\s+(?:basis|admissions?)/gi
  ];

  for (const pattern of deadlinePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      deadlines.push(...matches);
    }
  }

  return deadlines;
};

/**
 * Extract processing time information
 */
const extractProcessingTime = (text: string): number | undefined => {
  const timePatterns = [
    /(?:processing\s+time|review\s+period)[:\s]+(\d+)(?:\s+to\s+\d+)?\s+(?:days?|weeks?|months?)/gi,
    /(?:within|up\s+to)\s+(\d+)\s+(?:business\s+)?(?:days?|weeks?|months?)/gi
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      const timeValue = parseInt(match[1]);
      const timeUnit = match[0].toLowerCase();

      if (timeUnit.includes('week')) {
        return timeValue * 7; // Convert to days
      } else if (timeUnit.includes('month')) {
        return timeValue * 30; // Convert to days
      } else {
        return timeValue; // Already in days
      }
    }
  }

  return undefined;
};


