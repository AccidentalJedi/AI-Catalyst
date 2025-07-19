import React, { useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Select,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Button,
  useToast,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Tooltip,
  Icon,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiSettings, FiShield, FiMessageCircle, FiZap } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { UserPreferences } from '../../types';

// Validation schema
const schema = yup.object().shape({
  interactionLevel: yup.string().oneOf(['minimal', 'moderate', 'high']).required('Interaction level is required'),
  automationLevel: yup.string().oneOf(['basic', 'advanced', 'maximum']).required('Automation level is required'),
  privacyLevel: yup.string().oneOf(['standard', 'enhanced', 'maximum']).required('Privacy level is required'),
  communicationPreferences: yup.array().of(yup.string()).min(1, 'Please select at least one communication preference'),
  workingHours: yup.object().shape({
    timezone: yup.string().required('Timezone is required'),
    preferredDays: yup.array().of(yup.string()).min(1, 'Please select at least one preferred day'),
    startTime: yup.string().required('Start time is required'),
    endTime: yup.string().required('End time is required')
  }),
  notificationSettings: yup.object().shape({
    email: yup.boolean(),
    sms: yup.boolean(),
    push: yup.boolean(),
    frequency: yup.string().required('Notification frequency is required')
  }),
  documentPreferences: yup.object().shape({
    format: yup.string().required('Document format preference is required'),
    delivery: yup.string().required('Document delivery preference is required'),
    retention: yup.string().required('Document retention preference is required')
  }),
  supportPreferences: yup.object().shape({
    preferredMethod: yup.string().required('Preferred support method is required'),
    responseTime: yup.string().required('Expected response time is required'),
    complexity: yup.string().required('Support complexity preference is required')
  }),
  integrationPreferences: yup.array().of(yup.string()),
  accessibilityNeeds: yup.array().of(yup.string()),
  customizationLevel: yup.number().min(1).max(10).required('Customization level is required')
});

type FormData = yup.InferType<typeof schema>;

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' }
];

const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const communicationOptions = [
  'Email', 'Phone', 'Text/SMS', 'Video Call', 'In-Person Meeting',
  'Online Chat', 'Project Management Tools', 'Document Sharing',
  'Automated Updates', 'Self-Service Portal'
];

const integrationOptions = [
  'Google Workspace', 'Microsoft 365', 'Dropbox', 'OneDrive',
  'QuickBooks', 'Xero', 'DocuSign', 'Adobe Sign',
  'Slack', 'Microsoft Teams', 'Zoom', 'Calendar Apps',
  'Banking APIs', 'Payment Processors', 'CRM Systems'
];

const accessibilityOptions = [
  'Screen Reader Support', 'High Contrast Mode', 'Large Text Options',
  'Keyboard Navigation', 'Voice Commands', 'Closed Captions',
  'Audio Descriptions', 'Simplified Interface', 'Color Blind Support',
  'Motor Impairment Support'
];

export const PreferencesStep: React.FC = () => {
  const toast = useToast();
  const { userProfile, updateUserProfile, completeStep } = useWizardStore();
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
    watch,
    setValue
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: userProfile.preferences || {
      interactionLevel: 'minimal',
      automationLevel: 'maximum',
      privacyLevel: 'enhanced',
      communicationPreferences: ['Email', 'Automated Updates'],
      workingHours: {
        timezone: 'America/Chicago',
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: '09:00',
        endTime: '17:00'
      },
      notificationSettings: {
        email: true,
        sms: false,
        push: true,
        frequency: 'weekly'
      },
      documentPreferences: {
        format: 'pdf',
        delivery: 'email',
        retention: 'cloud'
      },
      supportPreferences: {
        preferredMethod: 'email',
        responseTime: '24-hours',
        complexity: 'detailed'
      },
      integrationPreferences: [],
      accessibilityNeeds: [],
      customizationLevel: 7
    }
  });

  const watchedValues = watch();
  const interactionLevel = watch('interactionLevel');
  const automationLevel = watch('automationLevel');
  const customizationLevel = watch('customizationLevel');

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value: any) => {
      updateUserProfile({
        preferences: value as UserPreferences
      });
    });
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [watch, updateUserProfile]);

  const onSubmit = (data: FormData) => {
    updateUserProfile({
      preferences: data as UserPreferences
    });
    
    completeStep('preferences');
    
    toast({
      title: 'Preferences saved',
      description: 'Your platform preferences have been saved successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const getInteractionDescription = (level: string) => {
    switch (level) {
      case 'minimal':
        return 'Prefer automated processes with minimal human interaction. Self-service options preferred.';
      case 'moderate':
        return 'Comfortable with some interaction for important decisions. Balance of automation and guidance.';
      case 'high':
        return 'Prefer regular check-ins and guidance throughout the process. More hands-on support.';
      default:
        return '';
    }
  };

  const getAutomationDescription = (level: string) => {
    switch (level) {
      case 'basic':
        return 'Basic automation for simple tasks. Manual review for most decisions.';
      case 'advanced':
        return 'Advanced automation with smart defaults. Manual override available.';
      case 'maximum':
        return 'Maximum automation with AI-driven decisions. Minimal manual intervention.';
      default:
        return '';
    }
  };

  return (
    <Box maxW="4xl" mx="auto" p={6}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Platform Preferences
          </Text>
          <Text color="gray.600" mb={4}>
            Customize your AI Catalyst experience to match your working style and preferences. 
            These settings will optimize the platform for your specific needs.
          </Text>
          
          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Tailored Experience</AlertTitle>
              <AlertDescription>
                Your preferences help us create a personalized experience that aligns with your 
                veteran background and business goals.
              </AlertDescription>
            </Box>
          </Alert>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} align="stretch">
            
            {/* Core Preferences */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiSettings} color="blue.500" />
                  <Text fontSize="lg" fontWeight="semibold">Core Preferences</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl isInvalid={!!errors.interactionLevel}>
                    <FormLabel>Interaction Level</FormLabel>
                    <Controller
                      name="interactionLevel"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field}>
                          <VStack align="start" spacing={3}>
                            <Box>
                              <Radio value="minimal">Minimal Interaction</Radio>
                              <Text fontSize="sm" color="gray.600" ml={6}>
                                {getInteractionDescription('minimal')}
                              </Text>
                            </Box>
                            <Box>
                              <Radio value="moderate">Moderate Interaction</Radio>
                              <Text fontSize="sm" color="gray.600" ml={6}>
                                {getInteractionDescription('moderate')}
                              </Text>
                            </Box>
                            <Box>
                              <Radio value="high">High Interaction</Radio>
                              <Text fontSize="sm" color="gray.600" ml={6}>
                                {getInteractionDescription('high')}
                              </Text>
                            </Box>
                          </VStack>
                        </RadioGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.interactionLevel?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.automationLevel}>
                    <FormLabel>
                      Automation Level
                      <Tooltip label="How much do you want the platform to automate decisions and processes?">
                        <Icon as={FiInfo} ml={2} color="gray.500" />
                      </Tooltip>
                    </FormLabel>
                    <Controller
                      name="automationLevel"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field}>
                          <VStack align="start" spacing={3}>
                            <Box>
                              <Radio value="basic">Basic Automation</Radio>
                              <Text fontSize="sm" color="gray.600" ml={6}>
                                {getAutomationDescription('basic')}
                              </Text>
                            </Box>
                            <Box>
                              <Radio value="advanced">Advanced Automation</Radio>
                              <Text fontSize="sm" color="gray.600" ml={6}>
                                {getAutomationDescription('advanced')}
                              </Text>
                            </Box>
                            <Box>
                              <Radio value="maximum">Maximum Automation</Radio>
                              <Text fontSize="sm" color="gray.600" ml={6}>
                                {getAutomationDescription('maximum')}
                              </Text>
                            </Box>
                          </VStack>
                        </RadioGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.automationLevel?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.privacyLevel}>
                    <FormLabel>Privacy Level</FormLabel>
                    <Controller
                      name="privacyLevel"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field}>
                          <VStack align="start" spacing={2}>
                            <Radio value="standard">Standard Privacy</Radio>
                            <Radio value="enhanced">Enhanced Privacy</Radio>
                            <Radio value="maximum">Maximum Privacy</Radio>
                          </VStack>
                        </RadioGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.privacyLevel?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.customizationLevel}>
                    <FormLabel>
                      Customization Level: {customizationLevel}/10
                      <Tooltip label="How much do you want to customize the platform experience?">
                        <Icon as={FiInfo} ml={2} color="gray.500" />
                      </Tooltip>
                    </FormLabel>
                    <Controller
                      name="customizationLevel"
                      control={control}
                      render={({ field }) => (
                        <Slider {...field} min={1} max={10} step={1}>
                          <SliderMark value={1} mt={2} fontSize="sm">Simple</SliderMark>
                          <SliderMark value={10} mt={2} fontSize="sm">Advanced</SliderMark>
                          <SliderTrack>
                            <SliderFilledTrack />
                          </SliderTrack>
                          <SliderThumb />
                        </Slider>
                      )}
                    />
                    <FormErrorMessage>{errors.customizationLevel?.message}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>

            {/* Communication Preferences */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiMessageCircle} color="green.500" />
                  <Text fontSize="lg" fontWeight="semibold">Communication Preferences</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl isInvalid={!!errors.communicationPreferences}>
                    <FormLabel>Preferred Communication Methods</FormLabel>
                    <Controller
                      name="communicationPreferences"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {communicationOptions.map((option) => (
                              <Checkbox key={option} value={option}>
                                {option}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.communicationPreferences?.message}</FormErrorMessage>
                  </FormControl>

                  <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Working Hours</Text>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl isInvalid={!!errors.workingHours?.timezone}>
                        <FormLabel>Timezone</FormLabel>
                        <Select {...register('workingHours.timezone')}>
                          {timezones.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </Select>
                        <FormErrorMessage>{errors.workingHours?.timezone?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.workingHours?.preferredDays}>
                        <FormLabel>Preferred Days</FormLabel>
                        <Controller
                          name="workingHours.preferredDays"
                          control={control}
                          render={({ field }) => (
                            <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                              <VStack align="start" spacing={1}>
                                {daysOfWeek.map((day) => (
                                  <Checkbox key={day} value={day} size="sm">
                                    {day}
                                  </Checkbox>
                                ))}
                              </VStack>
                            </CheckboxGroup>
                          )}
                        />
                        <FormErrorMessage>{errors.workingHours?.preferredDays?.message}</FormErrorMessage>
                      </FormControl>
                    </SimpleGrid>

                    <HStack spacing={4} mt={4}>
                      <FormControl isInvalid={!!errors.workingHours?.startTime}>
                        <FormLabel>Start Time</FormLabel>
                        <Select {...register('workingHours.startTime')}>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0');
                            return (
                              <option key={hour} value={`${hour}:00`}>
                                {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                              </option>
                            );
                          })}
                        </Select>
                        <FormErrorMessage>{errors.workingHours?.startTime?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.workingHours?.endTime}>
                        <FormLabel>End Time</FormLabel>
                        <Select {...register('workingHours.endTime')}>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0');
                            return (
                              <option key={hour} value={`${hour}:00`}>
                                {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                              </option>
                            );
                          })}
                        </Select>
                        <FormErrorMessage>{errors.workingHours?.endTime?.message}</FormErrorMessage>
                      </FormControl>
                    </HStack>
                  </Box>

                  <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Notification Settings</Text>
                    <VStack spacing={4} align="stretch">
                      <HStack spacing={6}>
                        <Checkbox {...register('notificationSettings.email')}>Email</Checkbox>
                        <Checkbox {...register('notificationSettings.sms')}>SMS</Checkbox>
                        <Checkbox {...register('notificationSettings.push')}>Push Notifications</Checkbox>
                      </HStack>

                      <FormControl isInvalid={!!errors.notificationSettings?.frequency}>
                        <FormLabel>Notification Frequency</FormLabel>
                        <Select {...register('notificationSettings.frequency')}>
                          <option value="immediate">Immediate</option>
                          <option value="daily">Daily Digest</option>
                          <option value="weekly">Weekly Summary</option>
                          <option value="monthly">Monthly Report</option>
                          <option value="milestone">Milestone Only</option>
                        </Select>
                        <FormErrorMessage>{errors.notificationSettings?.frequency?.message}</FormErrorMessage>
                      </FormControl>
                    </VStack>
                  </Box>
                </VStack>
              </CardBody>
            </Card>

            {/* Document & Support Preferences */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiShield} color="purple.500" />
                  <Text fontSize="lg" fontWeight="semibold">Document & Support Preferences</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Document Preferences</Text>
                    <SimpleGrid columns={3} spacing={4}>
                      <FormControl isInvalid={!!errors.documentPreferences?.format}>
                        <FormLabel>Format</FormLabel>
                        <Select {...register('documentPreferences.format')}>
                          <option value="pdf">PDF</option>
                          <option value="docx">Word Document</option>
                          <option value="html">HTML</option>
                          <option value="both">Multiple Formats</option>
                        </Select>
                        <FormErrorMessage>{errors.documentPreferences?.format?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.documentPreferences?.delivery}>
                        <FormLabel>Delivery</FormLabel>
                        <Select {...register('documentPreferences.delivery')}>
                          <option value="email">Email</option>
                          <option value="download">Direct Download</option>
                          <option value="cloud">Cloud Storage</option>
                          <option value="portal">Secure Portal</option>
                        </Select>
                        <FormErrorMessage>{errors.documentPreferences?.delivery?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.documentPreferences?.retention}>
                        <FormLabel>Retention</FormLabel>
                        <Select {...register('documentPreferences.retention')}>
                          <option value="cloud">Cloud Storage</option>
                          <option value="local">Local Only</option>
                          <option value="both">Both</option>
                          <option value="none">No Retention</option>
                        </Select>
                        <FormErrorMessage>{errors.documentPreferences?.retention?.message}</FormErrorMessage>
                      </FormControl>
                    </SimpleGrid>
                  </Box>

                  <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Support Preferences</Text>
                    <SimpleGrid columns={3} spacing={4}>
                      <FormControl isInvalid={!!errors.supportPreferences?.preferredMethod}>
                        <FormLabel>Preferred Method</FormLabel>
                        <Select {...register('supportPreferences.preferredMethod')}>
                          <option value="email">Email</option>
                          <option value="chat">Live Chat</option>
                          <option value="phone">Phone</option>
                          <option value="video">Video Call</option>
                          <option value="self-service">Self-Service</option>
                        </Select>
                        <FormErrorMessage>{errors.supportPreferences?.preferredMethod?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.supportPreferences?.responseTime}>
                        <FormLabel>Expected Response Time</FormLabel>
                        <Select {...register('supportPreferences.responseTime')}>
                          <option value="immediate">Immediate</option>
                          <option value="1-hour">Within 1 Hour</option>
                          <option value="4-hours">Within 4 Hours</option>
                          <option value="24-hours">Within 24 Hours</option>
                          <option value="48-hours">Within 48 Hours</option>
                        </Select>
                        <FormErrorMessage>{errors.supportPreferences?.responseTime?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.supportPreferences?.complexity}>
                        <FormLabel>Support Complexity</FormLabel>
                        <Select {...register('supportPreferences.complexity')}>
                          <option value="simple">Simple Answers</option>
                          <option value="detailed">Detailed Explanations</option>
                          <option value="technical">Technical Details</option>
                          <option value="step-by-step">Step-by-Step Guides</option>
                        </Select>
                        <FormErrorMessage>{errors.supportPreferences?.complexity?.message}</FormErrorMessage>
                      </FormControl>
                    </SimpleGrid>
                  </Box>
                </VStack>
              </CardBody>
            </Card>

            {/* Integration & Accessibility */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiZap} color="orange.500" />
                  <Text fontSize="lg" fontWeight="semibold">Integration & Accessibility</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl>
                    <FormLabel>Integration Preferences</FormLabel>
                    <Controller
                      name="integrationPreferences"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={3} spacing={2}>
                            {integrationOptions.map((integration) => (
                              <Checkbox key={integration} value={integration}>
                                {integration}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Accessibility Needs</FormLabel>
                    <Controller
                      name="accessibilityNeeds"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {accessibilityOptions.map((need) => (
                              <Checkbox key={need} value={need}>
                                {need}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>

            {/* Submit Button */}
            <Box pt={6}>
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                isDisabled={!isValid}
                leftIcon={<FiCheck />}
              >
                Save Preferences
              </Button>
            </Box>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};
