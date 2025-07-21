import { dbUtils } from '@utils/database';
import { dbLogger } from '@utils/logger';

export interface WizardProgress {
  userId: string;
  currentStep: string;
  completedSteps: string[];
  stepData: Record<string, any>;
}

/**
 * Get the user's wizard progress.
 */
export const getWizardProgress = (userId: string): WizardProgress | null => {
  try {
    const row = dbUtils.get(
      'SELECT currentStep, completedSteps, stepData FROM wizard_progress WHERE userId = ?',
      [userId]
    );

    if (row) {
      return {
        userId,
        currentStep: row.currentStep,
        completedSteps: JSON.parse(row.completedSteps || '[]'),
        stepData: JSON.parse(row.stepData || '{}'),
      };
    }

    return null;
  } catch (error) {
    dbLogger.error('Failed to get wizard progress', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
};

/**
 * Update the user's wizard progress.
 */
export const updateWizardProgress = (
  userId: string,
  progress: Partial<WizardProgress>
): void => {
  try {
    const existingProgress = getWizardProgress(userId) || {
      userId,
      currentStep: 'welcome',
      completedSteps: [],
      stepData: {},
    };

    const newProgress = { ...existingProgress, ...progress };

    dbUtils.run(
      `
      INSERT OR REPLACE INTO wizard_progress (
        userId,
        currentStep,
        completedSteps,
        stepData
      ) VALUES (?, ?, ?, ?)
    `,
      [
        userId,
        newProgress.currentStep,
        JSON.stringify(newProgress.completedSteps),
        JSON.stringify(newProgress.stepData),
      ]
    );

    dbLogger.info('Wizard progress updated', { userId, newStep: newProgress.currentStep });
  } catch (error) {
    dbLogger.error('Failed to update wizard progress', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
  }
};
