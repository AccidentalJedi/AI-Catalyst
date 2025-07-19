import React from 'react';
import {
  Box,
  Container,
  Flex,
  VStack,
  HStack,
  Text,
  Progress,
  Button,
  useColorModeValue,
  Divider,
  Badge,
  Icon,
  Tooltip
} from '@chakra-ui/react';
import { FiClock, FiCheck, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { WizardSidebar } from './WizardSidebar';
import { WizardHeader } from './WizardHeader';

interface WizardLayoutProps {
  children: React.ReactNode;
}

export const WizardLayout: React.FC<WizardLayoutProps> = ({ children }) => {
  const {
    currentPhase,
    currentStep,
    phases,
    progress,
    setCurrentStep,
    setCurrentPhase,
    completeStep
  } = useWizardStore();

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const currentPhaseData = phases.find(p => p.id === currentPhase);
  const currentStepData = currentPhaseData?.steps.find(s => s.id === currentStep);
  const currentStepIndex = currentPhaseData?.steps.findIndex(s => s.id === currentStep) ?? 0;
  const totalStepsInPhase = currentPhaseData?.steps.length ?? 0;

  const canGoNext = () => {
    if (!currentPhaseData) return false;

    // Can go to next step within current phase
    if (currentStepIndex < totalStepsInPhase - 1) {
      return true;
    }

    // Can go to next phase if current phase is complete
    const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
    return currentPhaseIndex < phases.length - 1;
  };

  const canGoPrevious = () => {
    // Can go to previous step within current phase
    if (currentStepIndex > 0) {
      return true;
    }

    // Can go to previous phase if not in first phase
    const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
    return currentPhaseIndex > 0;
  };

  const handleNext = () => {
    if (!currentPhaseData || !canGoNext()) return;

    // Mark current step as complete when moving forward
    completeStep(currentStep);

    // Move to next step within current phase
    if (currentStepIndex < totalStepsInPhase - 1) {
      const nextStep = currentPhaseData.steps[currentStepIndex + 1];
      if (nextStep) {
        setCurrentStep(nextStep.id);
      }
    } else {
      // Move to next phase
      const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
      if (currentPhaseIndex < phases.length - 1) {
        const nextPhase = phases[currentPhaseIndex + 1];
        setCurrentPhase(nextPhase.id);
      }
    }
  };

  const handlePrevious = () => {
    if (!canGoPrevious()) return;

    // Move to previous step within current phase
    if (currentStepIndex > 0) {
      const previousStep = currentPhaseData!.steps[currentStepIndex - 1];
      if (previousStep) {
        setCurrentStep(previousStep.id);
      }
    } else {
      // Move to previous phase (last step of previous phase)
      const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
      if (currentPhaseIndex > 0) {
        const previousPhase = phases[currentPhaseIndex - 1];
        const lastStepOfPreviousPhase = previousPhase.steps[previousPhase.steps.length - 1];
        setCurrentPhase(previousPhase.id);
        setCurrentStep(lastStepOfPreviousPhase.id);
      }
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Box minH="100vh" bg={bgColor}>
      <WizardHeader />
      
      <Container maxW="7xl" py={6}>
        <Flex gap={6} align="flex-start">
          {/* Sidebar */}
          <Box w="300px" flexShrink={0}>
            <WizardSidebar />
          </Box>

          {/* Main Content */}
          <Box flex={1}>
            <VStack spacing={6} align="stretch">
              {/* Progress Header */}
              <Box bg={cardBg} p={6} rounded="lg" border="1px" borderColor={borderColor}>
                <VStack spacing={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={1}>
                      <Text fontSize="2xl" fontWeight="bold">
                        {currentStepData?.title}
                      </Text>
                      <Text color="gray.600" fontSize="md">
                        {currentStepData?.description}
                      </Text>
                    </VStack>
                    
                    <VStack align="end" spacing={1}>
                      <HStack>
                        <Icon as={FiClock} color="gray.500" />
                        <Text fontSize="sm" color="gray.600">
                          {formatTime(progress.estimatedTimeRemaining)} remaining
                        </Text>
                      </HStack>
                      <Badge colorScheme="blue" variant="subtle">
                        Step {currentStepIndex + 1} of {totalStepsInPhase}
                      </Badge>
                    </VStack>
                  </Flex>

                  <Box>
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        Overall Progress
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {Math.round(progress.overallProgress)}% complete
                      </Text>
                    </Flex>
                    <Progress 
                      value={progress.overallProgress} 
                      colorScheme="blue" 
                      size="lg" 
                      rounded="full"
                    />
                  </Box>

                  {/* Phase Progress */}
                  <Box>
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        {currentPhaseData?.title}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {currentStepIndex + 1} of {totalStepsInPhase} steps
                      </Text>
                    </Flex>
                    <Progress 
                      value={((currentStepIndex + 1) / totalStepsInPhase) * 100} 
                      colorScheme="green" 
                      size="sm" 
                      rounded="full"
                    />
                  </Box>
                </VStack>
              </Box>

              {/* Step Content */}
              <Box bg={cardBg} p={8} rounded="lg" border="1px" borderColor={borderColor}>
                {children}
              </Box>

              {/* Navigation */}
              <Box bg={cardBg} p={6} rounded="lg" border="1px" borderColor={borderColor}>
                <Flex justify="space-between" align="center">
                  <Button
                    leftIcon={<FiArrowLeft />}
                    variant="outline"
                    onClick={handlePrevious}
                    isDisabled={!canGoPrevious()}
                  >
                    Previous
                  </Button>

                  <HStack spacing={2}>
                    {currentPhaseData?.steps.map((step, index) => (
                      <Tooltip key={step.id} label={step.title}>
                        <Box
                          w={3}
                          h={3}
                          rounded="full"
                          bg={
                            step.isComplete 
                              ? 'green.500' 
                              : index === currentStepIndex 
                                ? 'blue.500' 
                                : 'gray.300'
                          }
                          cursor="pointer"
                          onClick={() => setCurrentStep(step.id)}
                          transition="all 0.2s"
                          _hover={{ transform: 'scale(1.2)' }}
                        />
                      </Tooltip>
                    ))}
                  </HStack>

                  <Button
                    rightIcon={<FiArrowRight />}
                    colorScheme="blue"
                    onClick={handleNext}
                    isDisabled={!canGoNext()}
                  >
                    Next
                  </Button>
                </Flex>
              </Box>
            </VStack>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
};
