import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  WizardPhase, 
  WizardStep, 
  UserProfile, 
  BusinessFormation, 
  DigitalPlatform, 
  Progress, 
  ActionItem,
  GrantOpportunity,
  GeneratedDocument
} from '../types';

interface WizardState {
  // Core wizard state
  currentPhase: string;
  currentStep: string;
  phases: WizardPhase[];
  progress: Progress;
  completedSteps: string[]; // Track completed step IDs

  // User data
  userProfile: Partial<UserProfile>;
  businessFormation: Partial<BusinessFormation>;
  digitalPlatform: Partial<DigitalPlatform>;

  // Generated content
  actionItems: ActionItem[];
  grantOpportunities: GrantOpportunity[];
  generatedDocuments: GeneratedDocument[];

  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentPhase: (phaseId: string) => void;
  setCurrentStep: (stepId: string) => void;
  updateUserProfile: (data: Partial<UserProfile>) => void;
  updateBusinessFormation: (data: Partial<BusinessFormation>) => void;
  updateDigitalPlatform: (data: Partial<DigitalPlatform>) => void;
  completeStep: (stepId: string) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionItem: (id: string, updates: Partial<ActionItem>) => void;
  addGrantOpportunity: (grant: GrantOpportunity) => void;
  addGeneratedDocument: (document: GeneratedDocument) => void;
  calculateProgress: () => void;
  resetWizard: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Default wizard phases configuration
const defaultPhases: WizardPhase[] = [
  {
    id: 'discovery',
    title: 'Discovery & Planning',
    description: 'Understand your goals and gather essential information',
    estimatedTime: 30,
    isComplete: false,
    steps: [
      {
        id: 'user-profile',
        title: 'Personal Information',
        description: 'Basic contact and location information',
        component: null as any,
        isComplete: false
      },
      {
        id: 'veteran-status',
        title: 'Veteran Status & Benefits',
        description: 'Military service and disability benefits information',
        component: null as any,
        isComplete: false,
        isOptional: false
      },
      {
        id: 'business-vision',
        title: 'Business Vision & Mission',
        description: 'Define your AI education platform goals',
        component: null as any,
        isComplete: false
      },
      {
        id: 'preferences',
        title: 'Automation Preferences',
        description: 'Choose your interaction and automation levels',
        component: null as any,
        isComplete: false
      }
    ]
  },
  {
    id: 'legal-foundation',
    title: 'Legal Foundation',
    description: 'Establish your business entity and legal structure',
    estimatedTime: 45,
    isComplete: false,
    steps: [
      {
        id: 'business-name',
        title: 'Business Name & Identity',
        description: 'Choose and verify your business name availability',
        component: null as any,
        isComplete: false
      },
      {
        id: 'legal-structure',
        title: 'Legal Structure Selection',
        description: 'Choose the best entity type for your needs',
        component: null as any,
        isComplete: false
      },
      {
        id: 'registered-agent',
        title: 'Registered Agent',
        description: 'Select and configure your registered agent',
        component: null as any,
        isComplete: false
      },
      {
        id: 'legal-documents',
        title: 'Legal Document Generation',
        description: 'Generate LLC formation and operating documents',
        component: null as any,
        isComplete: false
      }
    ]
  },
  {
    id: 'financial-setup',
    title: 'Financial Infrastructure',
    description: 'Set up banking, taxes, and financial tracking',
    estimatedTime: 30,
    isComplete: false,
    steps: [
      {
        id: 'ein-application',
        title: 'EIN Application',
        description: 'Apply for your federal tax identification number',
        component: null as any,
        isComplete: false
      },
      {
        id: 'banking-setup',
        title: 'Business Banking',
        description: 'Open your business bank account',
        component: null as any,
        isComplete: false
      },
      {
        id: 'tax-strategy',
        title: 'Tax Strategy & Compliance',
        description: 'Set up tax tracking and quarterly payments',
        component: null as any,
        isComplete: false
      },
      {
        id: 'accounting-system',
        title: 'Accounting System',
        description: 'Configure your financial tracking system',
        component: null as any,
        isComplete: false
      }
    ]
  },
  {
    id: 'digital-platform',
    title: 'Digital Platform',
    description: 'Build your website and online presence',
    estimatedTime: 60,
    isComplete: false,
    steps: [
      {
        id: 'website-creation',
        title: 'Website Creation',
        description: 'Generate your professional website',
        component: null as any,
        isComplete: false
      },
      {
        id: 'content-strategy',
        title: 'Content Strategy',
        description: 'Plan your content and publishing schedule',
        component: null as any,
        isComplete: false
      },
      {
        id: 'automation-setup',
        title: 'Automation Setup',
        description: 'Configure email and social media automation',
        component: null as any,
        isComplete: false
      },
      {
        id: 'analytics-tracking',
        title: 'Analytics & Tracking',
        description: 'Set up performance monitoring and analytics',
        component: null as any,
        isComplete: false
      }
    ]
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    description: 'Protect your business with insurance and compliance',
    estimatedTime: 25,
    isComplete: false,
    steps: [
      {
        id: 'insurance-assessment',
        title: 'Insurance Needs Assessment',
        description: 'Determine your insurance requirements',
        component: null as any,
        isComplete: false
      },
      {
        id: 'compliance-check',
        title: 'Compliance Requirements',
        description: 'Identify local and industry compliance needs',
        component: null as any,
        isComplete: false
      },
      {
        id: 'risk-mitigation',
        title: 'Risk Mitigation Strategy',
        description: 'Develop your risk management plan',
        component: null as any,
        isComplete: false
      }
    ]
  },
  {
    id: 'growth-funding',
    title: 'Growth & Funding',
    description: 'Discover grants and plan for growth',
    estimatedTime: 40,
    isComplete: false,
    steps: [
      {
        id: 'grant-discovery',
        title: 'Grant Discovery',
        description: 'Find relevant grant opportunities',
        component: null as any,
        isComplete: false
      },
      {
        id: 'marketing-strategy',
        title: 'Marketing Strategy',
        description: 'Plan your outreach and marketing approach',
        component: null as any,
        isComplete: false
      },
      {
        id: 'growth-planning',
        title: 'Growth Planning',
        description: 'Develop your scaling and expansion strategy',
        component: null as any,
        isComplete: false
      }
    ]
  },
  {
    id: 'launch-preparation',
    title: 'Launch Preparation',
    description: 'Final steps and go-live checklist',
    estimatedTime: 20,
    isComplete: false,
    steps: [
      {
        id: 'final-review',
        title: 'Final Review',
        description: 'Review all completed steps and documents',
        component: null as any,
        isComplete: false
      },
      {
        id: 'launch-checklist',
        title: 'Launch Checklist',
        description: 'Complete your go-live action items',
        component: null as any,
        isComplete: false
      },
      {
        id: 'next-steps',
        title: 'Next Steps & Resources',
        description: 'Plan your ongoing operations and growth',
        component: null as any,
        isComplete: false
      }
    ]
  }
];

const initialProgress: Progress = {
  currentPhase: 'discovery',
  currentStep: 'user-profile',
  completedSteps: [],
  overallProgress: 0,
  estimatedTimeRemaining: 250, // Total estimated time
  lastUpdated: new Date()
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentPhase: 'discovery',
      currentStep: 'user-profile',
      phases: defaultPhases,
      progress: initialProgress,
      completedSteps: [],
      userProfile: {},
      businessFormation: {},
      digitalPlatform: {},
      actionItems: [],
      grantOpportunities: [],
      generatedDocuments: [],
      isLoading: false,
      error: null,

      // Actions
      setCurrentPhase: (phaseId: string) => {
        set((state) => {
          const phase = state.phases.find(p => p.id === phaseId);
          const firstStep = phase?.steps[0];
          return {
            currentPhase: phaseId,
            currentStep: firstStep?.id || state.currentStep
          };
        });
      },

      setCurrentStep: (stepId: string) => {
        set({ currentStep: stepId });
      },

      updateUserProfile: (data: Partial<UserProfile>) => {
        set((state) => ({
          userProfile: { ...state.userProfile, ...data }
        }));
      },

      updateBusinessFormation: (data: Partial<BusinessFormation>) => {
        set((state) => ({
          businessFormation: { ...state.businessFormation, ...data }
        }));
      },

      updateDigitalPlatform: (data: Partial<DigitalPlatform>) => {
        set((state) => ({
          digitalPlatform: { ...state.digitalPlatform, ...data }
        }));
      },

      completeStep: (stepId: string) => {
        set((state) => {
          const updatedPhases = state.phases.map(phase => ({
            ...phase,
            steps: phase.steps.map(step => 
              step.id === stepId ? { ...step, isComplete: true } : step
            )
          }));

          const completedSteps = [...state.completedSteps];
          if (!completedSteps.includes(stepId)) {
            completedSteps.push(stepId);
          }

          return {
            phases: updatedPhases,
            progress: {
              ...state.progress,
              completedSteps,
              lastUpdated: new Date()
            }
          };
        });
        get().calculateProgress();
      },

      addActionItem: (item: ActionItem) => {
        set((state) => ({
          actionItems: [...state.actionItems, item]
        }));
      },

      updateActionItem: (id: string, updates: Partial<ActionItem>) => {
        set((state) => ({
          actionItems: state.actionItems.map(item =>
            item.id === id ? { ...item, ...updates } : item
          )
        }));
      },

      addGrantOpportunity: (grant: GrantOpportunity) => {
        set((state) => ({
          grantOpportunities: [...state.grantOpportunities, grant]
        }));
      },

      addGeneratedDocument: (document: GeneratedDocument) => {
        set((state) => ({
          generatedDocuments: [...state.generatedDocuments, document]
        }));
      },

      calculateProgress: () => {
        set((state) => {
          const totalSteps = state.phases.reduce((acc, phase) => acc + phase.steps.length, 0);
          const completedSteps = state.progress.completedSteps.length;
          const overallProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
          
          const totalEstimatedTime = state.phases.reduce((acc, phase) => acc + phase.estimatedTime, 0);
          const estimatedTimeRemaining = totalEstimatedTime * (1 - overallProgress / 100);

          return {
            progress: {
              ...state.progress,
              overallProgress,
              estimatedTimeRemaining,
              lastUpdated: new Date()
            }
          };
        });
      },

      resetWizard: () => {
        set({
          currentPhase: 'discovery',
          currentStep: 'user-profile',
          phases: defaultPhases,
          progress: initialProgress,
          userProfile: {},
          businessFormation: {},
          digitalPlatform: {},
          actionItems: [],
          grantOpportunities: [],
          generatedDocuments: [],
          isLoading: false,
          error: null
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      }
    }),
    {
      name: 'ai-catalyst-wizard',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentPhase: state.currentPhase,
        currentStep: state.currentStep,
        progress: state.progress,
        userProfile: state.userProfile,
        businessFormation: state.businessFormation,
        digitalPlatform: state.digitalPlatform,
        actionItems: state.actionItems,
        grantOpportunities: state.grantOpportunities,
        generatedDocuments: state.generatedDocuments
      })
    }
  )
);
