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
  Icon
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiDollarSign } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { VeteranStatus } from '../../types';

// Validation schema - Made more flexible for better UX
const schema = yup.object().shape({
  serviceStatus: yup.string().required('Service status is required'),
  branch: yup.string().required('Military branch is required'),
  serviceStartDate: yup.date().nullable(), // Made optional for better UX
  serviceEndDate: yup.date().nullable(), // Made optional for better UX
  dischargeType: yup.string().when('serviceStatus', {
    is: 'veteran',
    then: (schema) => schema.required('Discharge type is required'),
    otherwise: (schema) => schema.nullable()
  }),
  disabilityRating: yup.number().min(0).max(100).nullable(),
  ratingType: yup.string().when('disabilityRating', {
    is: (val: number) => val > 0,
    then: (schema) => schema.required('Rating type is required when disability rating is provided'),
    otherwise: (schema) => schema.nullable()
  }),
  hasGiBill: yup.boolean(),
  giBillType: yup.string().when('hasGiBill', {
    is: true,
    then: (schema) => schema.required('GI Bill type is required'),
    otherwise: (schema) => schema.nullable()
  }),
  giBillMonthsUsed: yup.number().min(0).max(36).when('hasGiBill', {
    is: true,
    then: (schema) => schema.required('Months used is required'),
    otherwise: (schema) => schema.nullable()
  }),
  hasVrAndE: yup.boolean(),
  veteranCertifications: yup.array().of(yup.string()),
  militaryOccupationalSpecialty: yup.string(),
  securityClearance: yup.string(),
  combatVeteran: yup.boolean(),
  deployments: yup.number().min(0).nullable()
});

type FormData = yup.InferType<typeof schema>;

const militaryBranches = [
  { value: 'army', label: 'Army' },
  { value: 'navy', label: 'Navy' },
  { value: 'air-force', label: 'Air Force' },
  { value: 'marines', label: 'Marines' },
  { value: 'coast-guard', label: 'Coast Guard' },
  { value: 'space-force', label: 'Space Force' },
  { value: 'national-guard', label: 'National Guard' },
  { value: 'reserves', label: 'Reserves' }
];

const dischargeTypes = [
  { value: 'honorable', label: 'Honorable' },
  { value: 'general', label: 'General (Under Honorable Conditions)' },
  { value: 'other-than-honorable', label: 'Other Than Honorable' },
  { value: 'bad-conduct', label: 'Bad Conduct' },
  { value: 'dishonorable', label: 'Dishonorable' },
  { value: 'entry-level', label: 'Entry Level Separation' }
];

const giBillTypes = [
  { value: 'post-911', label: 'Post-9/11 GI Bill (Chapter 33)' },
  { value: 'montgomery-active', label: 'Montgomery GI Bill - Active Duty (Chapter 30)' },
  { value: 'montgomery-selected-reserve', label: 'Montgomery GI Bill - Selected Reserve (Chapter 1606)' },
  { value: 'reserve-educational-assistance', label: 'Reserve Educational Assistance Program (Chapter 1607)' },
  { value: 'survivors-dependents', label: 'Survivors and Dependents Educational Assistance (Chapter 35)' }
];

const veteranCertificationOptions = [
  'Veteran-Owned Small Business (VOSB)',
  'Service-Disabled Veteran-Owned Small Business (SDVOSB)',
  'HUBZone Certified',
  'SBA 8(a) Business Development',
  'Women-Owned Small Business (WOSB)',
  'Minority Business Enterprise (MBE)'
];

export const VeteranStatusStep: React.FC = () => {
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
    defaultValues: userProfile.veteranStatus || {
      serviceStatus: 'veteran', // Set a default to help with validation
      branch: 'army', // Set a default to help with validation
      serviceStartDate: undefined,
      serviceEndDate: undefined,
      dischargeType: '', // Don't set default - will be conditional based on service status
      disabilityRating: null,
      ratingType: '',
      hasGiBill: false,
      giBillType: '',
      giBillMonthsUsed: null,
      hasVrAndE: false,
      veteranCertifications: [],
      militaryOccupationalSpecialty: '',
      securityClearance: '',
      combatVeteran: false,
      deployments: null
    }
  });

  const watchedValues = watch();
  const disabilityRating = watch('disabilityRating');
  const hasGiBill = watch('hasGiBill');
  const serviceStatus = watch('serviceStatus');

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value: any) => {
      updateUserProfile({
        veteranStatus: value as VeteranStatus
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
      veteranStatus: data as VeteranStatus
    });
    
    completeStep('veteran-status');
    
    toast({
      title: 'Veteran status saved',
      description: 'Your military service information has been saved successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const calculateGiBillRemaining = () => {
    const monthsUsed = watchedValues.giBillMonthsUsed || 0;
    return 36 - monthsUsed;
  };

  const isEligibleForTexasVeteranBenefits = () => {
    return watchedValues.dischargeType === 'honorable' && 
           watchedValues.serviceStatus === 'veteran';
  };

  return (
    <Box maxW="4xl" mx="auto" p={6}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Military Service & Veteran Status
          </Text>
          <Text color="gray.600" mb={4}>
            This information helps us identify available benefits and opportunities specific to veterans, 
            including Texas veteran business benefits and federal programs.
          </Text>
          
          {isEligibleForTexasVeteranBenefits() && (
            <Alert status="success" mb={4}>
              <AlertIcon />
              <Box>
                <AlertTitle>Texas Veteran Benefits Available!</AlertTitle>
                <AlertDescription>
                  Based on your service record, you're eligible for Texas veteran business benefits including 
                  LLC filing fee waivers and franchise tax exemptions.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={6} align="stretch">
            
            {/* Service Status */}
            <FormControl isInvalid={!!errors.serviceStatus}>
              <FormLabel>Current Service Status</FormLabel>
              <Controller
                name="serviceStatus"
                control={control}
                render={({ field }) => (
                  <RadioGroup {...field}>
                    <VStack align="start" spacing={2}>
                      <Radio value="active-duty">Active Duty</Radio>
                      <Radio value="veteran">Veteran (Separated/Retired)</Radio>
                      <Radio value="national-guard">National Guard</Radio>
                      <Radio value="reserves">Reserves</Radio>
                    </VStack>
                  </RadioGroup>
                )}
              />
              <FormErrorMessage>{errors.serviceStatus?.message}</FormErrorMessage>
            </FormControl>

            {/* Military Branch */}
            <FormControl isInvalid={!!errors.branch}>
              <FormLabel>Military Branch</FormLabel>
              <Select {...register('branch')} placeholder="Select your branch">
                {militaryBranches.map((branch) => (
                  <option key={branch.value} value={branch.value}>
                    {branch.label}
                  </option>
                ))}
              </Select>
              <FormErrorMessage>{errors.branch?.message}</FormErrorMessage>
            </FormControl>

            {/* Service Dates */}
            <HStack spacing={4} align="start">
              <FormControl isInvalid={!!errors.serviceStartDate}>
                <FormLabel>Service Start Date</FormLabel>
                <Input
                  type="date"
                  {...register('serviceStartDate')}
                />
                <FormErrorMessage>{errors.serviceStartDate?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.serviceEndDate}>
                <FormLabel>Service End Date</FormLabel>
                <Input
                  type="date"
                  {...register('serviceEndDate')}
                />
                <FormErrorMessage>{errors.serviceEndDate?.message}</FormErrorMessage>
              </FormControl>
            </HStack>

            {/* Discharge Type */}
            {serviceStatus === 'veteran' && (
              <FormControl isInvalid={!!errors.dischargeType}>
                <FormLabel>Discharge Type</FormLabel>
                <Select {...register('dischargeType')} placeholder="Select discharge type">
                  {dischargeTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <FormErrorMessage>{errors.dischargeType?.message}</FormErrorMessage>
              </FormControl>
            )}

            <Divider />

            {/* Disability Rating */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>
                VA Disability Information
              </Text>
              
              <FormControl isInvalid={!!errors.disabilityRating}>
                <FormLabel>
                  VA Disability Rating (%)
                  <Tooltip label="Your combined disability rating from the VA. Leave blank if not applicable.">
                    <Icon as={FiInfo} ml={2} color="gray.500" />
                  </Tooltip>
                </FormLabel>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  {...register('disabilityRating')}
                  placeholder="Enter percentage (0-100)"
                />
                <FormErrorMessage>{errors.disabilityRating?.message}</FormErrorMessage>
              </FormControl>

              {disabilityRating && disabilityRating > 0 && (
                <FormControl isInvalid={!!errors.ratingType} mt={4}>
                  <FormLabel>Rating Type</FormLabel>
                  <Controller
                    name="ratingType"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup {...field}>
                        <VStack align="start" spacing={2}>
                          <Radio value="schedular">Schedular Rating</Radio>
                          <Radio value="tdiu">TDIU (Total Disability Individual Unemployability)</Radio>
                          <Radio value="p-and-t">P&T (Permanent and Total)</Radio>
                        </VStack>
                      </RadioGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.ratingType?.message}</FormErrorMessage>
                </FormControl>
              )}
            </Box>

            <Divider />

            {/* GI Bill Information */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>
                Education Benefits
              </Text>
              
              <FormControl>
                <Checkbox
                  {...register('hasGiBill')}
                  isChecked={hasGiBill}
                >
                  I have GI Bill benefits available
                </Checkbox>
              </FormControl>

              {hasGiBill && (
                <VStack spacing={4} mt={4} align="stretch">
                  <FormControl isInvalid={!!errors.giBillType}>
                    <FormLabel>GI Bill Type</FormLabel>
                    <Select {...register('giBillType')} placeholder="Select GI Bill type">
                      {giBillTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                    <FormErrorMessage>{errors.giBillType?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.giBillMonthsUsed}>
                    <FormLabel>Months of Benefits Used</FormLabel>
                    <Input
                      type="number"
                      min="0"
                      max="36"
                      {...register('giBillMonthsUsed')}
                      placeholder="Enter months used (0-36)"
                    />
                    <FormErrorMessage>{errors.giBillMonthsUsed?.message}</FormErrorMessage>
                    {watchedValues.giBillMonthsUsed !== null && (
                      <Text fontSize="sm" color="green.600" mt={1}>
                        <Icon as={FiCheck} mr={1} />
                        {calculateGiBillRemaining()} months remaining
                      </Text>
                    )}
                  </FormControl>
                </VStack>
              )}

              <FormControl mt={4}>
                <Checkbox {...register('hasVrAndE')}>
                  I'm eligible for or using VR&E (Chapter 31) benefits
                </Checkbox>
              </FormControl>
            </Box>

            <Divider />

            {/* Additional Information */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>
                Additional Service Information
              </Text>
              
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Military Occupational Specialty (MOS/AFSC/Rate)</FormLabel>
                  <Input
                    {...register('militaryOccupationalSpecialty')}
                    placeholder="e.g., 0651, 25B, IT"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Security Clearance</FormLabel>
                  <Select {...register('securityClearance')} placeholder="Select clearance level">
                    <option value="none">None</option>
                    <option value="confidential">Confidential</option>
                    <option value="secret">Secret</option>
                    <option value="top-secret">Top Secret</option>
                    <option value="ts-sci">Top Secret/SCI</option>
                  </Select>
                </FormControl>

                <HStack spacing={4} align="start">
                  <FormControl>
                    <Checkbox {...register('combatVeteran')}>
                      Combat Veteran
                    </Checkbox>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Number of Deployments</FormLabel>
                    <Input
                      type="number"
                      min="0"
                      {...register('deployments')}
                      placeholder="0"
                      w="100px"
                    />
                  </FormControl>
                </HStack>

                <FormControl>
                  <FormLabel>Veteran Business Certifications</FormLabel>
                  <Controller
                    name="veteranCertifications"
                    control={control}
                    render={({ field }) => (
                      <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                        <VStack align="start" spacing={2}>
                          {veteranCertificationOptions.map((cert) => (
                            <Checkbox key={cert} value={cert}>
                              {cert}
                            </Checkbox>
                          ))}
                        </VStack>
                      </CheckboxGroup>
                    )}
                  />
                </FormControl>
              </VStack>
            </Box>

            {/* Debug: Show validation errors */}
            {Object.keys(errors).length > 0 && (
              <Box p={4} bg="red.50" border="1px" borderColor="red.200" rounded="md">
                <Text fontSize="sm" fontWeight="bold" color="red.600" mb={2}>
                  Please fix the following errors:
                </Text>
                {Object.entries(errors).map(([field, error]) => (
                  <Text key={field} fontSize="sm" color="red.600">
                    • {field}: {error?.message}
                  </Text>
                ))}
              </Box>
            )}

            {/* Submit Button */}
            <Box pt={6}>
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                isDisabled={false} // Temporarily disabled validation for testing
                leftIcon={<FiCheck />}
              >
                Save Veteran Information
              </Button>
              <Text fontSize="sm" color="gray.500" mt={2}>
                Form valid: {isValid ? 'Yes' : 'No'} | Errors: {Object.keys(errors).length}
              </Text>
              <Text fontSize="xs" color="gray.400" mt={1}>
                Debug: hasGiBill={String(watch('hasGiBill'))}, giBillType="{watch('giBillType')}", giBillMonthsUsed={String(watch('giBillMonthsUsed'))}
              </Text>
            </Box>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};
