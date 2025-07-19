import React from 'react';
import {
  Box,
  VStack,
  Text,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  HStack,
  Icon,
  Badge,
  useColorModeValue,
  Flex,
  Circle
} from '@chakra-ui/react';
import { 
  FiUser, 
  FiFileText, 
  FiDollarSign, 
  FiGlobe, 
  FiShield, 
  FiTrendingUp, 
  FiPocket,
  FiCheck,
  FiClock
} from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';

const phaseIcons = {
  'discovery': FiUser,
  'legal-foundation': FiFileText,
  'financial-setup': FiDollarSign,
  'digital-platform': FiGlobe,
  'risk-management': FiShield,
  'growth-funding': FiTrendingUp,
  'launch-preparation': FiPocket
};

export const WizardSidebar: React.FC = () => {
  const {
    currentPhase,
    currentStep,
    phases,
    setCurrentPhase,
    setCurrentStep
  } = useWizardStore();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.600', 'blue.300');

  const getPhaseProgress = (phase: any) => {
    const completedSteps = phase.steps.filter((step: any) => step.isComplete).length;
    return (completedSteps / phase.steps.length) * 100;
  };

  const getStepStatus = (step: any) => {
    if (step.isComplete) return 'complete';
    if (step.id === currentStep) return 'current';
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return FiCheck;
      case 'current':
        return FiClock;
      default:
        return null;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'green.500';
      case 'current':
        return 'blue.500';
      default:
        return 'gray.400';
    }
  };

  return (
    <Box
      bg={bgColor}
      border="1px"
      borderColor={borderColor}
      rounded="lg"
      p={4}
      h="fit-content"
      position="sticky"
      top={6}
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={2}>
            Launch Wizard
          </Text>
          <Text fontSize="sm" color="gray.600">
            Follow these steps to launch your AI Catalyst platform
          </Text>
        </Box>

        <Accordion allowMultiple index={phases.map((_, i) => i)}>
          {phases.map((phase) => {
            const PhaseIcon = phaseIcons[phase.id as keyof typeof phaseIcons] || FiFileText;
            const progress = getPhaseProgress(phase);
            const isCurrentPhase = phase.id === currentPhase;

            return (
              <AccordionItem key={phase.id} border="none">
                <AccordionButton
                  p={3}
                  rounded="md"
                  bg={isCurrentPhase ? activeBg : 'transparent'}
                  _hover={{ bg: isCurrentPhase ? activeBg : hoverBg }}
                  onClick={() => setCurrentPhase(phase.id)}
                >
                  <Flex align="center" flex={1} textAlign="left">
                    <HStack spacing={3} flex={1}>
                      <Circle
                        size={8}
                        bg={progress === 100 ? 'green.500' : isCurrentPhase ? activeColor : 'gray.400'}
                        color="white"
                      >
                        <Icon as={PhaseIcon} size="sm" />
                      </Circle>
                      
                      <VStack align="start" spacing={0} flex={1}>
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          color={isCurrentPhase ? activeColor : 'inherit'}
                        >
                          {phase.title}
                        </Text>
                        <HStack spacing={2}>
                          <Text fontSize="xs" color="gray.500">
                            {Math.round(progress)}% complete
                          </Text>
                          <Badge size="sm" colorScheme="gray" variant="subtle">
                            {phase.estimatedTime}m
                          </Badge>
                        </HStack>
                      </VStack>
                    </HStack>
                  </Flex>
                  <AccordionIcon />
                </AccordionButton>

                <AccordionPanel p={0} pl={11}>
                  <VStack spacing={1} align="stretch">
                    {phase.steps.map((step) => {
                      const status = getStepStatus(step);
                      const StepIcon = getStepIcon(status);
                      const isCurrentStep = step.id === currentStep;

                      return (
                        <Box
                          key={step.id}
                          p={2}
                          rounded="md"
                          bg={isCurrentStep ? activeBg : 'transparent'}
                          _hover={{ bg: isCurrentStep ? activeBg : hoverBg }}
                          cursor="pointer"
                          onClick={() => setCurrentStep(step.id)}
                          transition="all 0.2s"
                        >
                          <HStack spacing={3}>
                            <Circle
                              size={5}
                              bg={getStepColor(status)}
                              color="white"
                            >
                              {StepIcon && <Icon as={StepIcon} size="xs" />}
                            </Circle>
                            
                            <VStack align="start" spacing={0} flex={1}>
                              <Text
                                fontSize="xs"
                                fontWeight={isCurrentStep ? "medium" : "normal"}
                                color={isCurrentStep ? activeColor : 'inherit'}
                                noOfLines={1}
                              >
                                {step.title}
                              </Text>
                              {step.isOptional && (
                                <Badge size="xs" colorScheme="gray" variant="outline">
                                  Optional
                                </Badge>
                              )}
                            </VStack>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
      </VStack>
    </Box>
  );
};
