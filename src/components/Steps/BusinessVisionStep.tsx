import React, { useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Textarea,
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
  CardHeader
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiTarget, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { BusinessVision } from '../../types';

// Validation schema
const schema = yup.object().shape({
  businessName: yup.string().required('Business name is required'),
  missionStatement: yup.string().required('Mission statement is required').min(50, 'Mission statement should be at least 50 characters'),
  visionStatement: yup.string().required('Vision statement is required').min(50, 'Vision statement should be at least 50 characters'),
  coreValues: yup.array().of(yup.string()).min(3, 'Please select at least 3 core values'),
  targetAudience: yup.array().of(yup.string()).min(1, 'Please select at least one target audience'),
  primaryGoals: yup.array().of(yup.string()).min(1, 'Please select at least one primary goal'),
  businessModel: yup.string().required('Business model is required'),
  revenueStreams: yup.array().of(yup.string()).min(1, 'Please select at least one revenue stream'),
  socialImpactFocus: yup.string().required('Social impact focus is required'),
  successMetrics: yup.array().of(yup.string()).min(1, 'Please select at least one success metric'),
  timelineGoals: yup.object().shape({
    sixMonths: yup.string().required('6-month goal is required'),
    oneYear: yup.string().required('1-year goal is required'),
    threeYears: yup.string().required('3-year goal is required')
  }),
  competitiveAdvantage: yup.string().required('Competitive advantage is required'),
  challengesAnticipated: yup.array().of(yup.string()),
  resourcesNeeded: yup.array().of(yup.string()),
  partnershipInterests: yup.array().of(yup.string())
});

type FormData = yup.InferType<typeof schema>;

const coreValuesOptions = [
  'Transparency', 'Innovation', 'Education', 'Accessibility', 'Integrity',
  'Community', 'Empowerment', 'Excellence', 'Collaboration', 'Authenticity',
  'Service', 'Growth', 'Impact', 'Responsibility', 'Inclusivity'
];

const targetAudienceOptions = [
  'General Public', 'Students', 'Professionals', 'Small Business Owners',
  'Veterans', 'Educators', 'Researchers', 'Policymakers', 'Skeptics',
  'Tech Enthusiasts', 'Non-Tech Users', 'Senior Citizens', 'Young Adults'
];

const primaryGoalsOptions = [
  'AI Education & Literacy', 'Public Awareness', 'Skill Development',
  'Community Building', 'Research & Development', 'Policy Advocacy',
  'Economic Empowerment', 'Digital Inclusion', 'Innovation Promotion',
  'Ethical AI Development', 'Workforce Preparation', 'Social Impact'
];

const businessModelOptions = [
  { value: 'social-enterprise', label: 'Social Enterprise (Mission-First)' },
  { value: 'b-corp', label: 'B-Corporation Model' },
  { value: 'nonprofit', label: 'Nonprofit Organization' },
  { value: 'for-profit-social', label: 'For-Profit with Social Mission' },
  { value: 'cooperative', label: 'Cooperative Model' },
  { value: 'hybrid', label: 'Hybrid Model' }
];

const revenueStreamOptions = [
  'Educational Content Subscriptions', 'Online Courses', 'Workshops & Training',
  'Consulting Services', 'Speaking Engagements', 'Digital Products',
  'Grants & Donations', 'Sponsorships', 'Affiliate Marketing',
  'Certification Programs', 'Community Memberships', 'Research Services'
];

const socialImpactOptions = [
  { value: 'education', label: 'Education & Literacy' },
  { value: 'digital-divide', label: 'Bridging Digital Divide' },
  { value: 'workforce', label: 'Workforce Development' },
  { value: 'ethics', label: 'Ethical AI Development' },
  { value: 'accessibility', label: 'Technology Accessibility' },
  { value: 'community', label: 'Community Empowerment' },
  { value: 'policy', label: 'Policy & Advocacy' },
  { value: 'research', label: 'Research & Innovation' }
];

const successMetricsOptions = [
  'People Reached', 'Course Completions', 'Community Engagement',
  'Knowledge Assessments', 'Behavior Change', 'Policy Influence',
  'Partnership Development', 'Revenue Growth', 'Social Media Impact',
  'Media Coverage', 'Testimonials & Stories', 'Research Citations'
];

const challengesOptions = [
  'Funding & Sustainability', 'Technical Complexity', 'Public Skepticism',
  'Regulatory Changes', 'Competition', 'Scaling Operations',
  'Team Building', 'Technology Evolution', 'Market Education',
  'Partnership Development', 'Content Creation', 'Quality Assurance'
];

const resourcesNeededOptions = [
  'Funding', 'Technical Expertise', 'Content Creators', 'Marketing Support',
  'Legal Guidance', 'Partnerships', 'Technology Infrastructure',
  'Research Access', 'Community Connections', 'Mentorship',
  'Administrative Support', 'Design & Branding'
];

const partnershipOptions = [
  'Educational Institutions', 'Tech Companies', 'Government Agencies',
  'Nonprofit Organizations', 'Research Institutions', 'Media Outlets',
  'Professional Associations', 'Community Groups', 'Veteran Organizations',
  'Industry Leaders', 'Funding Organizations', 'Policy Think Tanks'
];

export const BusinessVisionStep: React.FC = () => {
  const toast = useToast();
  const { userProfile, updateUserProfile, completeStep } = useWizardStore();
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
    watch
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: userProfile.businessVision || {
      businessName: '',
      missionStatement: '',
      visionStatement: '',
      coreValues: [],
      targetAudience: [],
      primaryGoals: [],
      businessModel: '',
      revenueStreams: [],
      socialImpactFocus: '',
      successMetrics: [],
      timelineGoals: {
        sixMonths: '',
        oneYear: '',
        threeYears: ''
      },
      competitiveAdvantage: '',
      challengesAnticipated: [],
      resourcesNeeded: [],
      partnershipInterests: []
    }
  });

  const watchedValues = watch();

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value) => {
      updateUserProfile({
        businessVision: value as BusinessVision
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, updateUserProfile]);

  const onSubmit = (data: FormData) => {
    updateUserProfile({
      businessVision: data as BusinessVision
    });
    
    completeStep('business-vision');
    
    toast({
      title: 'Business vision saved',
      description: 'Your business vision and mission have been saved successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <Box maxW="4xl" mx="auto" p={6}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Business Vision & Mission
          </Text>
          <Text color="gray.600" mb={4}>
            Define your AI education platform's purpose, goals, and impact. This forms the foundation 
            of your social enterprise and guides all future decisions.
          </Text>
          
          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Social Enterprise Focus</AlertTitle>
              <AlertDescription>
                As a mission-driven platform, your business vision should emphasize social impact 
                alongside sustainable operations.
              </AlertDescription>
            </Box>
          </Alert>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} align="stretch">
            
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiTarget} color="blue.500" />
                  <Text fontSize="lg" fontWeight="semibold">Basic Information</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <FormControl isInvalid={!!errors.businessName}>
                    <FormLabel>Business/Platform Name</FormLabel>
                    <Input
                      {...register('businessName')}
                      placeholder="e.g., Grumpified Designs 'OGGVCT' and Concepts"
                    />
                    <FormErrorMessage>{errors.businessName?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.missionStatement}>
                    <FormLabel>
                      Mission Statement
                      <Tooltip label="What is your platform's purpose? What problem are you solving?">
                        <Icon as={FiInfo} ml={2} color="gray.500" />
                      </Tooltip>
                    </FormLabel>
                    <Textarea
                      {...register('missionStatement')}
                      placeholder="Describe your platform's core purpose and the problem you're solving..."
                      rows={4}
                    />
                    <FormErrorMessage>{errors.missionStatement?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.visionStatement}>
                    <FormLabel>
                      Vision Statement
                      <Tooltip label="What future do you want to create? What's your long-term impact?">
                        <Icon as={FiInfo} ml={2} color="gray.500" />
                      </Tooltip>
                    </FormLabel>
                    <Textarea
                      {...register('visionStatement')}
                      placeholder="Describe the future you want to create and your long-term impact..."
                      rows={4}
                    />
                    <FormErrorMessage>{errors.visionStatement?.message}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>

            {/* Core Values & Audience */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiUsers} color="green.500" />
                  <Text fontSize="lg" fontWeight="semibold">Values & Audience</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl isInvalid={!!errors.coreValues}>
                    <FormLabel>Core Values (Select at least 3)</FormLabel>
                    <Controller
                      name="coreValues"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={(field.value?.filter(Boolean) as string[]) || []}>
                          <SimpleGrid columns={3} spacing={2}>
                            {coreValuesOptions.map((value) => (
                              <Checkbox key={value} value={value}>
                                {value}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.coreValues?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.targetAudience}>
                    <FormLabel>Target Audience</FormLabel>
                    <Controller
                      name="targetAudience"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={(field.value?.filter(Boolean) as string[]) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {targetAudienceOptions.map((audience) => (
                              <Checkbox key={audience} value={audience}>
                                {audience}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.targetAudience?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.primaryGoals}>
                    <FormLabel>Primary Goals</FormLabel>
                    <Controller
                      name="primaryGoals"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {primaryGoalsOptions.map((goal) => (
                              <Checkbox key={goal} value={goal}>
                                {goal}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.primaryGoals?.message}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>

            {/* Business Model & Revenue */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiTrendingUp} color="purple.500" />
                  <Text fontSize="lg" fontWeight="semibold">Business Model & Sustainability</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl isInvalid={!!errors.businessModel}>
                    <FormLabel>Business Model</FormLabel>
                    <Controller
                      name="businessModel"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field}>
                          <VStack align="start" spacing={2}>
                            {businessModelOptions.map((model) => (
                              <Radio key={model.value} value={model.value}>
                                {model.label}
                              </Radio>
                            ))}
                          </VStack>
                        </RadioGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.businessModel?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.revenueStreams}>
                    <FormLabel>Revenue Streams</FormLabel>
                    <Controller
                      name="revenueStreams"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {revenueStreamOptions.map((stream) => (
                              <Checkbox key={stream} value={stream}>
                                {stream}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.revenueStreams?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.socialImpactFocus}>
                    <FormLabel>Primary Social Impact Focus</FormLabel>
                    <Controller
                      name="socialImpactFocus"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup {...field}>
                          <VStack align="start" spacing={2}>
                            {socialImpactOptions.map((impact) => (
                              <Radio key={impact.value} value={impact.value}>
                                {impact.label}
                              </Radio>
                            ))}
                          </VStack>
                        </RadioGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.socialImpactFocus?.message}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>

            {/* Success Metrics & Timeline */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Success Metrics & Timeline</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl isInvalid={!!errors.successMetrics}>
                    <FormLabel>Success Metrics</FormLabel>
                    <Controller
                      name="successMetrics"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {successMetricsOptions.map((metric) => (
                              <Checkbox key={metric} value={metric}>
                                {metric}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                    <FormErrorMessage>{errors.successMetrics?.message}</FormErrorMessage>
                  </FormControl>

                  <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Timeline Goals</Text>
                    <VStack spacing={4} align="stretch">
                      <FormControl isInvalid={!!errors.timelineGoals?.sixMonths}>
                        <FormLabel>6-Month Goal</FormLabel>
                        <Input
                          {...register('timelineGoals.sixMonths')}
                          placeholder="What do you want to achieve in 6 months?"
                        />
                        <FormErrorMessage>{errors.timelineGoals?.sixMonths?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.timelineGoals?.oneYear}>
                        <FormLabel>1-Year Goal</FormLabel>
                        <Input
                          {...register('timelineGoals.oneYear')}
                          placeholder="What do you want to achieve in 1 year?"
                        />
                        <FormErrorMessage>{errors.timelineGoals?.oneYear?.message}</FormErrorMessage>
                      </FormControl>

                      <FormControl isInvalid={!!errors.timelineGoals?.threeYears}>
                        <FormLabel>3-Year Goal</FormLabel>
                        <Input
                          {...register('timelineGoals.threeYears')}
                          placeholder="What do you want to achieve in 3 years?"
                        />
                        <FormErrorMessage>{errors.timelineGoals?.threeYears?.message}</FormErrorMessage>
                      </FormControl>
                    </VStack>
                  </Box>
                </VStack>
              </CardBody>
            </Card>

            {/* Competitive Advantage & Challenges */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Strategy & Planning</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl isInvalid={!!errors.competitiveAdvantage}>
                    <FormLabel>Competitive Advantage</FormLabel>
                    <Textarea
                      {...register('competitiveAdvantage')}
                      placeholder="What makes your platform unique? What advantages do you have?"
                      rows={3}
                    />
                    <FormErrorMessage>{errors.competitiveAdvantage?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Anticipated Challenges</FormLabel>
                    <Controller
                      name="challengesAnticipated"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {challengesOptions.map((challenge) => (
                              <Checkbox key={challenge} value={challenge}>
                                {challenge}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Resources Needed</FormLabel>
                    <Controller
                      name="resourcesNeeded"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {resourcesNeededOptions.map((resource) => (
                              <Checkbox key={resource} value={resource}>
                                {resource}
                              </Checkbox>
                            ))}
                          </SimpleGrid>
                        </CheckboxGroup>
                      )}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Partnership Interests</FormLabel>
                    <Controller
                      name="partnershipInterests"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                          <SimpleGrid columns={2} spacing={2}>
                            {partnershipOptions.map((partner) => (
                              <Checkbox key={partner} value={partner}>
                                {partner}
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
                Save Business Vision
              </Button>
            </Box>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};
