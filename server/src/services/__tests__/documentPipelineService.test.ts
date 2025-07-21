import { processDocumentPipeline } from '../documentPipelineService';
import { analyzeDocument } from '../documentAnalysisService';
import { findMatchingGrants, storeGrantMatches } from '../grantMatchingService';
import { updateWizardProgress, getWizardProgress } from '../wizardService';
import { dbUtils } from '@utils/database';

jest.mock('../documentAnalysisService');
jest.mock('../grantMatchingService');
jest.mock('../wizardService');
jest.mock('@utils/database', () => ({
    dbUtils: {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn(),
    },
  }));

describe('Document Pipeline Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process a document through the pipeline', async () => {
    (analyzeDocument as jest.Mock).mockResolvedValue([{ id: 'analysis1', structuredData: {} }]);
    (findMatchingGrants as jest.Mock).mockResolvedValue([]);
    (storeGrantMatches as jest.Mock).mockResolvedValue(undefined);
    (getWizardProgress as jest.Mock).mockResolvedValue(null);
    (updateWizardProgress as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.get as jest.Mock).mockReturnValue({ id: 'user1' });


    await processDocumentPipeline('doc1', 'user1', '/path/to/doc', 'application/pdf', 'other');

    expect(analyzeDocument).toHaveBeenCalled();
    expect(findMatchingGrants).toHaveBeenCalled();
    expect(storeGrantMatches).toHaveBeenCalled();
    expect(updateWizardProgress).toHaveBeenCalledTimes(2);
  });
});
