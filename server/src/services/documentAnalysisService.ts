import { dbUtils } from '@utils/database';
import { dbLogger } from '@utils/logger';
import crypto from 'crypto';
import nlp from 'compromise';

/**
 * Analyze a document to extract text and structured data.
 */
export const analyzeDocument = async (
  documentId: string,
  userId: string,
  filePath: string,
  mimeType: string
): Promise<any[]> => {
  dbLogger.info('Starting document analysis', { documentId, userId });

  try {
    // In a real implementation, you would use a library like 'textract' or 'pdf-parse'
    // to extract text from the file based on its mimeType.
    const extractedText = `This is a sample document for user ${userId}. It mentions a disability rating of 100% and that the user lives in Texas. The user served in the Army.`;

    const structuredData = extractStructuredData(extractedText);

    const analysisId = await storeAnalysisResults(
      documentId,
      userId,
      extractedText,
      structuredData
    );

    dbLogger.info('Document analysis completed', { documentId, userId, analysisId });

    return [{ id: analysisId, structuredData }];
  } catch (error) {
    dbLogger.error('Document analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      documentId,
      userId,
    });
    throw error;
  }
};

/**
 * Extract structured data from text using compromise.
 */
const extractStructuredData = (text: string): Record<string, any> => {
  const doc = nlp(text);
  const data: Record<string, any> = {};

  // Extract disability rating
  const disabilityRating = doc.match('#Value #Percent disability rating').text();
  if (disabilityRating) {
    data.disabilityRating = disabilityRating;
  }

  // Extract state
  const state = doc.match('in #Region').text();
  if (state) {
    data.state = state.replace('in ', '');
  }

  // Extract branch of service
  const branch = doc.match('in the #Organization').text();
  if (branch) {
    data.branchOfService = branch.replace('in the ', '');
  }

  return data;
};

/**
 * Store the results of the document analysis in the database.
 */
const storeAnalysisResults = async (
  documentId: string,
  userId: string,
  extractedText: string,
  structuredData: Record<string, any>
): Promise<string> => {
  const analysisId = crypto.randomUUID();

  dbUtils.run(
    `
    INSERT INTO document_analysis (
      id,
      documentId,
      userId,
      analysisStatus,
      extractedText,
      structuredData,
      completedAt
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `,
    [
      analysisId,
      documentId,
      userId,
      'completed',
      extractedText,
      JSON.stringify(structuredData),
    ]
  );

  return analysisId;
};
