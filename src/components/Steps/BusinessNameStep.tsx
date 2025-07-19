import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Button,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Tooltip,
  Icon,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  List,
  ListItem,
  ListIcon,
  Divider,
  Checkbox
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiX, FiSearch, FiAlertTriangle, FiBriefcase } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { BusinessName } from '../../types';

// Validation schema
const schema = yup.object().shape({
  primaryName: yup.string().required('Primary business name is required').min(3, 'Name must be at least 3 characters'),
  alternativeNames: yup.array().of(yup.string()),
  hasTrademarks: yup.boolean(),
  trademarkDetails: yup.string().when('hasTrademarks', {
    is: true,
    then: (schema) => schema.required('Trademark details are required'),
    otherwise: (schema) => schema.nullable()
  }),
  domainPreferences: yup.array().of(yup.string()),
  socialMediaHandles: yup.object().shape({
    twitter: yup.string(),
    facebook: yup.string(),
    instagram: yup.string(),
    linkedin: yup.string(),
    youtube: yup.string(),
    tiktok: yup.string()
  }),
  nameAvailabilityChecked: yup.boolean().oneOf([true], 'You must check name availability before proceeding')
});

type FormData = yup.InferType<typeof schema>;

interface NameCheckResult {
  name: string;
  available: boolean;
  issues: string[];
  suggestions: string[];
}

const domainExtensions = ['.com', '.org', '.net', '.edu', '.gov', '.io', '.ai', '.co'];

const nameRequirements = [
  'Must be distinguishable from existing Texas business names',
  'Cannot contain restricted words without proper authorization',
  'Must include "LLC" or "Limited Liability Company"',
  'Cannot be misleading about the nature of business',
  'Cannot imply government affiliation without authorization'
];

const restrictedWords = [
  'bank', 'banking', 'insurance', 'university', 'college', 'corporation', 'corp',
  'government', 'federal', 'state', 'national', 'department', 'bureau', 'agency'
];

export const BusinessNameStep: React.FC = () => {
  const toast = useToast();
  const { userProfile, updateUserProfile, completeStep } = useWizardStore();
  const [nameCheckResults, setNameCheckResults] = useState<NameCheckResult[]>([]);
  const [isCheckingNames, setIsCheckingNames] = useState(false);
  const [domainAvailability, setDomainAvailability] = useState<Record<string, boolean>>({});
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    getValues
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: userProfile.businessName || {
      primaryName: '',
      alternativeNames: [],
      hasTrademarks: false,
      trademarkDetails: '',
      domainPreferences: ['.com'],
      socialMediaHandles: {
        twitter: '',
        facebook: '',
        instagram: '',
        linkedin: '',
        youtube: '',
        tiktok: ''
      },
      nameAvailabilityChecked: false
    }
  });

  const watchedValues = watch();
  const primaryName = watch('primaryName');
  const hasTrademarks = watch('hasTrademarks');

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value) => {
      updateUserProfile({
        businessName: value as BusinessName
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, updateUserProfile]);

  const checkNameAvailability = async (name: string): Promise<NameCheckResult> => {
    // Simulate API call to Texas SOS business name search
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check for restricted words
    const lowerName = name.toLowerCase();
    const foundRestrictedWords = restrictedWords.filter(word => lowerName.includes(word));
    if (foundRestrictedWords.length > 0) {
      issues.push(`Contains restricted words: ${foundRestrictedWords.join(', ')}`);
    }
    
    // Check if name ends with LLC
    if (!lowerName.includes('llc') && !lowerName.includes('limited liability company')) {
      issues.push('Must include "LLC" or "Limited Liability Company"');
      suggestions.push(`${name} LLC`);
      suggestions.push(`${name} Limited Liability Company`);
    }
    
    // Check length
    if (name.length < 3) {
      issues.push('Name must be at least 3 characters long');
    }
    
    // Simulate availability check (random for demo)
    const available = Math.random() > 0.3 && issues.length === 0;
    
    if (!available && issues.length === 0) {
      issues.push('Name is already taken by another business');
      suggestions.push(`${name} Solutions LLC`);
      suggestions.push(`${name} Enterprises LLC`);
      suggestions.push(`${name} Group LLC`);
    }
    
    return {
      name,
      available,
      issues,
      suggestions
    };
  };

  const checkDomainAvailability = async (baseName: string, extensions: string[]) => {
    // Simulate domain availability check
    const results: Record<string, boolean> = {};
    
    for (const ext of extensions) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const domain = `${baseName.toLowerCase().replace(/\s+/g, '')}${ext}`;
      results[domain] = Math.random() > 0.4; // Random availability for demo
    }
    
    setDomainAvailability(results);
  };

  const handleNameCheck = async () => {
    if (!primaryName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a business name to check availability.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsCheckingNames(true);
    
    try {
      const names = [primaryName, ...(watchedValues.alternativeNames || [])].filter(name => name.trim());
      const results = await Promise.all(names.map(name => checkNameAvailability(name.trim())));
      setNameCheckResults(results);
      
      // Check domain availability for primary name
      const baseName = primaryName.replace(/\s+llc$/i, '').replace(/\s+limited liability company$/i, '').trim();
      await checkDomainAvailability(baseName, watchedValues.domainPreferences || ['.com']);
      
      // Mark as checked if primary name is available
      if (results[0]?.available) {
        setValue('nameAvailabilityChecked', true);
        toast({
          title: 'Name available!',
          description: 'Your primary business name is available for registration.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        setValue('nameAvailabilityChecked', false);
        toast({
          title: 'Name unavailable',
          description: 'Your primary business name has issues. Please review and try alternatives.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Check failed',
        description: 'Unable to check name availability. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsCheckingNames(false);
    }
  };

  const addAlternativeName = () => {
    const currentAlternatives = getValues('alternativeNames') || [];
    setValue('alternativeNames', [...currentAlternatives, '']);
  };

  const removeAlternativeName = (index: number) => {
    const currentAlternatives = getValues('alternativeNames') || [];
    setValue('alternativeNames', currentAlternatives.filter((_, i) => i !== index));
  };

  const onSubmit = (data: FormData) => {
    updateUserProfile({
      businessName: data as BusinessName
    });
    
    completeStep('business-name');
    
    toast({
      title: 'Business name saved',
      description: 'Your business name information has been saved successfully.',
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
            Business Name Selection
          </Text>
          <Text color="gray.600" mb={4}>
            Choose a unique and memorable name for your AI education platform. We'll help you check 
            availability and ensure compliance with Texas business naming requirements.
          </Text>
          
          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Texas LLC Naming Requirements</AlertTitle>
              <AlertDescription>
                Your business name must be distinguishable from existing Texas businesses and 
                include "LLC" or "Limited Liability Company".
              </AlertDescription>
            </Box>
          </Alert>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} align="stretch">
            
            {/* Primary Business Name */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiBriefcase} color="blue.500" />
                  <Text fontSize="lg" fontWeight="semibold">Primary Business Name</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <FormControl isInvalid={!!errors.primaryName}>
                    <FormLabel>Business Name</FormLabel>
                    <HStack>
                      <Input
                        {...register('primaryName')}
                        placeholder="e.g., Grumpified Designs OGGVCT LLC"
                        size="lg"
                      />
                      <Button
                        onClick={handleNameCheck}
                        isLoading={isCheckingNames}
                        loadingText="Checking"
                        leftIcon={<FiSearch />}
                        colorScheme="blue"
                        minW="120px"
                      >
                        Check
                      </Button>
                    </HStack>
                    <FormErrorMessage>{errors.primaryName?.message}</FormErrorMessage>
                  </FormControl>

                  {/* Name Requirements */}
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Texas LLC Naming Requirements:</Text>
                    <List spacing={1} fontSize="sm">
                      {nameRequirements.map((req, index) => (
                        <ListItem key={index}>
                          <ListIcon as={FiInfo} color="blue.500" />
                          {req}
                        </ListItem>
                      ))}
                    </List>
                  </Box>

                  {/* Name Check Results */}
                  {nameCheckResults.length > 0 && (
                    <Box>
                      <Text fontSize="md" fontWeight="semibold" mb={3}>Name Availability Results:</Text>
                      {nameCheckResults.map((result, index) => (
                        <Card key={index} mb={3} variant={result.available ? 'outline' : 'filled'}>
                          <CardBody py={3}>
                            <HStack justify="space-between" mb={2}>
                              <Text fontWeight="semibold">{result.name}</Text>
                              <Badge colorScheme={result.available ? 'green' : 'red'}>
                                <Icon as={result.available ? FiCheck : FiX} mr={1} />
                                {result.available ? 'Available' : 'Unavailable'}
                              </Badge>
                            </HStack>
                            
                            {result.issues.length > 0 && (
                              <Box mb={2}>
                                <Text fontSize="sm" color="red.600" fontWeight="semibold">Issues:</Text>
                                <List fontSize="sm">
                                  {result.issues.map((issue, i) => (
                                    <ListItem key={i}>
                                      <ListIcon as={FiAlertTriangle} color="red.500" />
                                      {issue}
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                            
                            {result.suggestions.length > 0 && (
                              <Box>
                                <Text fontSize="sm" color="blue.600" fontWeight="semibold">Suggestions:</Text>
                                <List fontSize="sm">
                                  {result.suggestions.map((suggestion, i) => (
                                    <ListItem key={i}>
                                      <ListIcon as={FiInfo} color="blue.500" />
                                      {suggestion}
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </CardBody>
                        </Card>
                      ))}
                    </Box>
                  )}

                  {/* Domain Availability */}
                  {Object.keys(domainAvailability).length > 0 && (
                    <Box>
                      <Text fontSize="md" fontWeight="semibold" mb={3}>Domain Availability:</Text>
                      <HStack wrap="wrap" spacing={2}>
                        {Object.entries(domainAvailability).map(([domain, available]) => (
                          <Badge
                            key={domain}
                            colorScheme={available ? 'green' : 'red'}
                            variant="subtle"
                            p={2}
                          >
                            <Icon as={available ? FiCheck : FiX} mr={1} />
                            {domain}
                          </Badge>
                        ))}
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </CardBody>
            </Card>

            {/* Alternative Names */}
            <Card>
              <CardHeader>
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="semibold">Alternative Names (Optional)</Text>
                  <Button size="sm" onClick={addAlternativeName}>Add Alternative</Button>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  {(watchedValues.alternativeNames || []).map((_, index) => (
                    <HStack key={index}>
                      <Input
                        {...register(`alternativeNames.${index}`)}
                        placeholder={`Alternative name ${index + 1}`}
                      />
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => removeAlternativeName(index)}
                      >
                        Remove
                      </Button>
                    </HStack>
                  ))}
                  {(!watchedValues.alternativeNames || watchedValues.alternativeNames.length === 0) && (
                    <Text color="gray.500" fontSize="sm">
                      No alternative names added. Click "Add Alternative" to include backup options.
                    </Text>
                  )}
                </VStack>
              </CardBody>
            </Card>

            {/* Trademark Information */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Trademark Information</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <Checkbox {...register('hasTrademarks')} isChecked={hasTrademarks}>
                      I have existing trademarks related to this business name
                    </Checkbox>
                  </FormControl>

                  {hasTrademarks && (
                    <FormControl isInvalid={!!errors.trademarkDetails}>
                      <FormLabel>Trademark Details</FormLabel>
                      <Input
                        {...register('trademarkDetails')}
                        placeholder="Describe your existing trademarks..."
                      />
                      <FormErrorMessage>{errors.trademarkDetails?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                </VStack>
              </CardBody>
            </Card>

            {/* Domain Preferences */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Domain Preferences</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Text fontSize="sm" color="gray.600">
                    Select which domain extensions you'd like to check for availability:
                  </Text>
                  <HStack wrap="wrap" spacing={2}>
                    {domainExtensions.map((ext) => (
                      <Checkbox
                        key={ext}
                        value={ext}
                        {...register('domainPreferences')}
                      >
                        {ext}
                      </Checkbox>
                    ))}
                  </HStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Social Media Handles */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Social Media Handles (Optional)</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Text fontSize="sm" color="gray.600">
                    Reserve your preferred social media handles for brand consistency:
                  </Text>
                  <HStack spacing={4} wrap="wrap">
                    <FormControl>
                      <FormLabel fontSize="sm">Twitter</FormLabel>
                      <Input
                        {...register('socialMediaHandles.twitter')}
                        placeholder="@yourbusiness"
                        size="sm"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">Facebook</FormLabel>
                      <Input
                        {...register('socialMediaHandles.facebook')}
                        placeholder="facebook.com/yourbusiness"
                        size="sm"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">Instagram</FormLabel>
                      <Input
                        {...register('socialMediaHandles.instagram')}
                        placeholder="@yourbusiness"
                        size="sm"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">LinkedIn</FormLabel>
                      <Input
                        {...register('socialMediaHandles.linkedin')}
                        placeholder="linkedin.com/company/yourbusiness"
                        size="sm"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">YouTube</FormLabel>
                      <Input
                        {...register('socialMediaHandles.youtube')}
                        placeholder="youtube.com/@yourbusiness"
                        size="sm"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">TikTok</FormLabel>
                      <Input
                        {...register('socialMediaHandles.tiktok')}
                        placeholder="@yourbusiness"
                        size="sm"
                      />
                    </FormControl>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Availability Check Confirmation */}
            <FormControl isInvalid={!!errors.nameAvailabilityChecked}>
              <Checkbox {...register('nameAvailabilityChecked')}>
                I have checked the availability of my primary business name and confirmed it meets Texas requirements
              </Checkbox>
              <FormErrorMessage>{errors.nameAvailabilityChecked?.message}</FormErrorMessage>
            </FormControl>

            {/* Submit Button */}
            <Box pt={6}>
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                isDisabled={!isValid}
                leftIcon={<FiCheck />}
              >
                Save Business Name
              </Button>
            </Box>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};
