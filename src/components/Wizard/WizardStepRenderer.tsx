import React from 'react';
import { useWizardStore } from '@store/wizardStore';

// Step Components
import { UserProfileStep } from '@components/Steps/UserProfileStep';
import { VeteranStatusStep } from '@components/Steps/VeteranStatusStep';
import { BusinessVisionStep } from '@components/Steps/BusinessVisionStep';
import { PreferencesStep } from '@components/Steps/PreferencesStep';
import { BusinessNameStep } from '@components/Steps/BusinessNameStep';
import { LegalStructureStep } from '@components/Steps/LegalStructureStep';
import { RegisteredAgentStep } from '@components/Steps/RegisteredAgentStep';
import { LegalDocumentsStep } from '@components/Steps/LegalDocumentsStep';

// Step component mapping
const stepComponents: Record<string, React.ComponentType> = {
  // Discovery Phase
  'user-profile': UserProfileStep,
  'veteran-status': VeteranStatusStep,
  'business-vision': BusinessVisionStep,
  'preferences': PreferencesStep,
  
  // Legal Foundation Phase
  'business-name': BusinessNameStep,
  'legal-structure': LegalStructureStep,
  'registered-agent': RegisteredAgentStep,
  'legal-documents': LegalDocumentsStep,
  
  // Financial Setup Phase
  'ein-application': () => <div>EIN Application Step - Coming Soon</div>,
  'banking-setup': () => <div>Banking Setup Step - Coming Soon</div>,
  'tax-strategy': () => <div>Tax Strategy Step - Coming Soon</div>,
  'accounting-system': () => <div>Accounting System Step - Coming Soon</div>,
  
  // Digital Platform Phase
  'website-creation': () => <div>Website Creation Step - Coming Soon</div>,
  'content-strategy': () => <div>Content Strategy Step - Coming Soon</div>,
  'automation-setup': () => <div>Automation Setup Step - Coming Soon</div>,
  'analytics-tracking': () => <div>Analytics Tracking Step - Coming Soon</div>,
  
  // Risk Management Phase
  'insurance-assessment': () => <div>Insurance Assessment Step - Coming Soon</div>,
  'compliance-check': () => <div>Compliance Check Step - Coming Soon</div>,
  'risk-mitigation': () => <div>Risk Mitigation Step - Coming Soon</div>,
  
  // Growth & Funding Phase
  'grant-discovery': () => <div>Grant Discovery Step - Coming Soon</div>,
  'marketing-strategy': () => <div>Marketing Strategy Step - Coming Soon</div>,
  'growth-planning': () => <div>Growth Planning Step - Coming Soon</div>,
  
  // Launch Preparation Phase
  'final-review': () => <div>Final Review Step - Coming Soon</div>,
  'launch-checklist': () => <div>Launch Checklist Step - Coming Soon</div>,
  'next-steps': () => <div>Next Steps Step - Coming Soon</div>,
};

export const WizardStepRenderer: React.FC = () => {
  const { currentStep } = useWizardStore();
  
  const StepComponent = stepComponents[currentStep];
  
  if (!StepComponent) {
    return (
      <div>
        <h2>Step not found: {currentStep}</h2>
        <p>This step component has not been implemented yet.</p>
      </div>
    );
  }
  
  return <StepComponent />;
};
