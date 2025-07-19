import React, { useEffect } from 'react';
import {
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  Input,
  Select,
  Button,
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useWizardStore } from '@store/wizardStore';
import { PersonalInfo, Address } from '../../types';

// Validation schema
const schema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string().required('Phone number is required'),
  address: yup.object({
    street: yup.string().required('Street address is required'),
    city: yup.string().required('City is required'),
    state: yup.string().required('State is required'),
    zipCode: yup.string().required('ZIP code is required'),
    county: yup.string().required('County is required')
  })
});

type FormData = PersonalInfo;

export const UserProfileStep: React.FC = () => {
  const toast = useToast();
  const { userProfile, updateUserProfile, completeStep } = useWizardStore();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: userProfile.personalInfo || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: 'TX', // Default to Texas
        zipCode: '',
        county: ''
      }
    }
  });

  const watchedValues = watch();

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value: any) => {
      updateUserProfile({
        personalInfo: value as PersonalInfo
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
      personalInfo: data
    });
    
    completeStep('user-profile');
    
    toast({
      title: 'Profile saved',
      description: 'Your personal information has been saved successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // US States for dropdown
  const states = [
    { value: 'TX', label: 'Texas' },
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    // Add more states as needed
  ];

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={2}>
          Let's start with your basic information
        </Text>
        <Text color="gray.600">
          This information will be used to personalize your experience and generate legal documents.
          All data is stored locally and encrypted for your privacy.
        </Text>
      </Box>

      <Alert status="info" rounded="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Privacy First!</AlertTitle>
          <AlertDescription>
            Your personal information is stored locally on your device and never sent to external servers
            without your explicit consent.
          </AlertDescription>
        </Box>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack spacing={6} align="stretch">
          {/* Personal Information */}
          <Box>
            <Text fontSize="md" fontWeight="medium" mb={4}>
              Personal Information
            </Text>
            <VStack spacing={4} align="stretch">
              <HStack spacing={4}>
                <FormControl isInvalid={!!errors.firstName}>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    {...register('firstName')}
                    placeholder="Enter your first name"
                  />
                  {errors.firstName && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.firstName.message}
                    </Text>
                  )}
                </FormControl>

                <FormControl isInvalid={!!errors.lastName}>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    {...register('lastName')}
                    placeholder="Enter your last name"
                  />
                  {errors.lastName && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.lastName.message}
                    </Text>
                  )}
                </FormControl>
              </HStack>

              <HStack spacing={4}>
                <FormControl isInvalid={!!errors.email}>
                  <FormLabel>Email Address</FormLabel>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="your.email@example.com"
                  />
                  {errors.email && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.email.message}
                    </Text>
                  )}
                </FormControl>

                <FormControl isInvalid={!!errors.phone}>
                  <FormLabel>Phone Number</FormLabel>
                  <Input
                    {...register('phone')}
                    type="tel"
                    placeholder="(555) 123-4567"
                  />
                  {errors.phone && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.phone.message}
                    </Text>
                  )}
                </FormControl>
              </HStack>
            </VStack>
          </Box>

          {/* Address Information */}
          <Box>
            <Text fontSize="md" fontWeight="medium" mb={4}>
              Address Information
            </Text>
            <VStack spacing={4} align="stretch">
              <FormControl isInvalid={!!errors.address?.street}>
                <FormLabel>Street Address</FormLabel>
                <Input
                  {...register('address.street')}
                  placeholder="123 Main Street"
                />
                {errors.address?.street && (
                  <Text color="red.500" fontSize="sm" mt={1}>
                    {errors.address.street.message}
                  </Text>
                )}
              </FormControl>

              <HStack spacing={4}>
                <FormControl isInvalid={!!errors.address?.city}>
                  <FormLabel>City</FormLabel>
                  <Input
                    {...register('address.city')}
                    placeholder="Houston"
                  />
                  {errors.address?.city && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.address.city.message}
                    </Text>
                  )}
                </FormControl>

                <FormControl isInvalid={!!errors.address?.state}>
                  <FormLabel>State</FormLabel>
                  <Select {...register('address.state')}>
                    {states.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </Select>
                  {errors.address?.state && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.address.state.message}
                    </Text>
                  )}
                </FormControl>
              </HStack>

              <HStack spacing={4}>
                <FormControl isInvalid={!!errors.address?.zipCode}>
                  <FormLabel>ZIP Code</FormLabel>
                  <Input
                    {...register('address.zipCode')}
                    placeholder="77001"
                  />
                  {errors.address?.zipCode && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.address.zipCode.message}
                    </Text>
                  )}
                </FormControl>

                <FormControl isInvalid={!!errors.address?.county}>
                  <FormLabel>County</FormLabel>
                  <Input
                    {...register('address.county')}
                    placeholder="Harris County"
                  />
                  {errors.address?.county && (
                    <Text color="red.500" fontSize="sm" mt={1}>
                      {errors.address.county.message}
                    </Text>
                  )}
                </FormControl>
              </HStack>
            </VStack>
          </Box>

          <Button
            type="submit"
            colorScheme="blue"
            size="lg"
            isDisabled={!isValid}
            alignSelf="flex-start"
          >
            Save and Continue
          </Button>
        </VStack>
      </form>
    </VStack>
  );
};
