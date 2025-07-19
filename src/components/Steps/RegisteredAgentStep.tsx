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
  Radio,
  RadioGroup,
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
  SimpleGrid,
  List,
  ListItem,
  ListIcon,
  Divider,
  Select,
  Checkbox
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiMapPin, FiUser, FiDollarSign, FiShield } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { RegisteredAgent } from '../../types';

// Validation schema
const schema = yup.object().shape({
  agentType: yup.string().oneOf(['self', 'service', 'attorney']).required('Agent type is required'),
  agentName: yup.string().required('Agent name is required'),
  agentAddress: yup.object().shape({
    street: yup.string().required('Street address is required'),
    city: yup.string().required('City is required'),
    state: yup.string().required('State is required'),
    zipCode: yup.string().required('ZIP code is required').matches(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
  }),
  agentPhone: yup.string().required('Phone number is required'),
  agentEmail: yup.string().email('Invalid email format').required('Email is required'),
  serviceProvider: yup.string().when('agentType', {
    is: 'service',
    then: (schema) => schema.required('Service provider is required'),
    otherwise: (schema) => schema.nullable()
  }),
  annualFee: yup.number().when('agentType', {
    is: 'service',
    then: (schema) => schema.required('Annual fee is required'),
    otherwise: (schema) => schema.nullable()
  }),
  acceptsService: yup.boolean().oneOf([true], 'You must confirm the agent accepts service'),
  businessHours: yup.object().shape({
    monday: yup.boolean(),
    tuesday: yup.boolean(),
    wednesday: yup.boolean(),
    thursday: yup.boolean(),
    friday: yup.boolean(),
    saturday: yup.boolean(),
    sunday: yup.boolean()
  }),
  specialInstructions: yup.string()
});

type FormData = yup.InferType<typeof schema>;

const registeredAgentServices = [
  {
    name: 'Northwest Registered Agent',
    fee: 39,
    features: ['Mail forwarding', 'Online dashboard', 'Compliance alerts'],
    rating: 4.8
  },
  {
    name: 'Incfile',
    fee: 119,
    features: ['Document storage', 'Compliance calendar', 'Phone support'],
    rating: 4.6
  },
  {
    name: 'LegalZoom',
    fee: 159,
    features: ['Legal document review', 'Business consultation', 'Priority support'],
    rating: 4.4
  },
  {
    name: 'ZenBusiness',
    fee: 99,
    features: ['Worry-free compliance', 'Document alerts', 'Email support'],
    rating: 4.7
  }
];

const texasStates = [
  'Texas', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
  'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
  'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export const RegisteredAgentStep: React.FC = () => {
  const toast = useToast();
  const { userProfile, updateUserProfile, completeStep } = useWizardStore();
  const [selectedService, setSelectedService] = useState<string>('');
  
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
    defaultValues: userProfile.registeredAgent || {
      agentType: 'self',
      agentName: '',
      agentAddress: {
        street: '',
        city: '',
        state: 'Texas',
        zipCode: ''
      },
      agentPhone: '',
      agentEmail: '',
      serviceProvider: '',
      annualFee: null,
      acceptsService: false,
      businessHours: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      },
      specialInstructions: ''
    }
  });

  const watchedValues = watch();
  const agentType = watch('agentType');

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value) => {
      updateUserProfile({
        registeredAgent: value as RegisteredAgent
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, updateUserProfile]);

  // Auto-fill user info when selecting self as agent
  useEffect(() => {
    if (agentType === 'self' && userProfile.personalInfo) {
      setValue('agentName', `${userProfile.personalInfo.firstName} ${userProfile.personalInfo.lastName}`);
      setValue('agentEmail', userProfile.personalInfo.email);
      setValue('agentPhone', userProfile.personalInfo.phone || '');
      if (userProfile.personalInfo.address) {
        setValue('agentAddress.street', userProfile.personalInfo.address.street);
        setValue('agentAddress.city', userProfile.personalInfo.address.city);
        setValue('agentAddress.state', userProfile.personalInfo.address.state);
        setValue('agentAddress.zipCode', userProfile.personalInfo.address.zipCode);
      }
    }
  }, [agentType, userProfile.personalInfo, setValue]);

  const handleServiceSelection = (serviceName: string, fee: number) => {
    setSelectedService(serviceName);
    setValue('serviceProvider', serviceName);
    setValue('annualFee', fee);
  };

  const onSubmit = (data: FormData) => {
    updateUserProfile({
      registeredAgent: data as RegisteredAgent
    });
    
    completeStep('registered-agent');
    
    toast({
      title: 'Registered agent saved',
      description: 'Your registered agent information has been saved successfully.',
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
            Registered Agent Selection
          </Text>
          <Text color="gray.600" mb={4}>
            Every Texas LLC must have a registered agent to receive legal documents and official 
            correspondence. You can serve as your own agent or hire a professional service.
          </Text>
          
          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Registered Agent Requirements</AlertTitle>
              <AlertDescription>
                Your registered agent must have a Texas street address (no P.O. boxes) and be 
                available during normal business hours to receive legal documents.
              </AlertDescription>
            </Box>
          </Alert>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} align="stretch">
            
            {/* Agent Type Selection */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiUser} color="blue.500" />
                  <Text fontSize="lg" fontWeight="semibold">Agent Type</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <FormControl isInvalid={!!errors.agentType}>
                  <FormLabel>Who will serve as your registered agent?</FormLabel>
                  <Controller
                    name="agentType"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup {...field}>
                        <VStack spacing={4} align="stretch">
                          <Card
                            variant={agentType === 'self' ? 'filled' : 'outline'}
                            cursor="pointer"
                            onClick={() => field.onChange('self')}
                          >
                            <CardBody>
                              <HStack align="start" spacing={4}>
                                <Radio value="self" size="lg" mt={1} />
                                <Box flex={1}>
                                  <HStack justify="space-between" mb={2}>
                                    <Text fontWeight="bold">Serve as My Own Agent</Text>
                                    <Badge colorScheme="green">FREE</Badge>
                                  </HStack>
                                  <Text fontSize="sm" color="gray.600" mb={2}>
                                    You'll receive legal documents directly at your business address.
                                  </Text>
                                  <List fontSize="xs" spacing={0}>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      No ongoing fees
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      Direct control over documents
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiInfo} color="orange.500" />
                                      Must be available during business hours
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiInfo} color="orange.500" />
                                      Address becomes public record
                                    </ListItem>
                                  </List>
                                </Box>
                              </HStack>
                            </CardBody>
                          </Card>

                          <Card
                            variant={agentType === 'service' ? 'filled' : 'outline'}
                            cursor="pointer"
                            onClick={() => field.onChange('service')}
                          >
                            <CardBody>
                              <HStack align="start" spacing={4}>
                                <Radio value="service" size="lg" mt={1} />
                                <Box flex={1}>
                                  <HStack justify="space-between" mb={2}>
                                    <Text fontWeight="bold">Professional Service</Text>
                                    <Badge colorScheme="blue">$39-159/year</Badge>
                                  </HStack>
                                  <Text fontSize="sm" color="gray.600" mb={2}>
                                    Hire a professional service to handle document receipt and forwarding.
                                  </Text>
                                  <List fontSize="xs" spacing={0}>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      Privacy protection for your address
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      Professional document handling
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      Compliance alerts and reminders
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiInfo} color="orange.500" />
                                      Annual fee required
                                    </ListItem>
                                  </List>
                                </Box>
                              </HStack>
                            </CardBody>
                          </Card>

                          <Card
                            variant={agentType === 'attorney' ? 'filled' : 'outline'}
                            cursor="pointer"
                            onClick={() => field.onChange('attorney')}
                          >
                            <CardBody>
                              <HStack align="start" spacing={4}>
                                <Radio value="attorney" size="lg" mt={1} />
                                <Box flex={1}>
                                  <HStack justify="space-between" mb={2}>
                                    <Text fontWeight="bold">Attorney or Law Firm</Text>
                                    <Badge colorScheme="purple">Varies</Badge>
                                  </HStack>
                                  <Text fontSize="sm" color="gray.600" mb={2}>
                                    Have your business attorney serve as your registered agent.
                                  </Text>
                                  <List fontSize="xs" spacing={0}>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      Legal expertise included
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiCheck} color="green.500" />
                                      Immediate legal consultation
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiInfo} color="orange.500" />
                                      Higher cost than services
                                    </ListItem>
                                    <ListItem>
                                      <ListIcon as={FiInfo} color="orange.500" />
                                      May require retainer agreement
                                    </ListItem>
                                  </List>
                                </Box>
                              </HStack>
                            </CardBody>
                          </Card>
                        </VStack>
                      </RadioGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.agentType?.message}</FormErrorMessage>
                </FormControl>
              </CardBody>
            </Card>

            {/* Service Provider Selection */}
            {agentType === 'service' && (
              <Card>
                <CardHeader>
                  <HStack>
                    <Icon as={FiDollarSign} color="green.500" />
                    <Text fontSize="lg" fontWeight="semibold">Service Provider Options</Text>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={1} spacing={4}>
                    {registeredAgentServices.map((service) => (
                      <Card
                        key={service.name}
                        variant={selectedService === service.name ? 'filled' : 'outline'}
                        cursor="pointer"
                        onClick={() => handleServiceSelection(service.name, service.fee)}
                      >
                        <CardBody>
                          <HStack justify="space-between" mb={2}>
                            <Text fontWeight="bold">{service.name}</Text>
                            <VStack align="end" spacing={0}>
                              <Text fontWeight="bold" color="green.600">${service.fee}/year</Text>
                              <Text fontSize="xs" color="gray.500">Rating: {service.rating}/5</Text>
                            </VStack>
                          </HStack>
                          <HStack wrap="wrap" spacing={2}>
                            {service.features.map((feature, index) => (
                              <Badge key={index} variant="subtle" colorScheme="blue">
                                {feature}
                              </Badge>
                            ))}
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                </CardBody>
              </Card>
            )}

            {/* Agent Information */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiMapPin} color="purple.500" />
                  <Text fontSize="lg" fontWeight="semibold">Agent Information</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <FormControl isInvalid={!!errors.agentName}>
                    <FormLabel>Agent Name</FormLabel>
                    <Input
                      {...register('agentName')}
                      placeholder="Full name of the registered agent"
                    />
                    <FormErrorMessage>{errors.agentName?.message}</FormErrorMessage>
                  </FormControl>

                  <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={3}>Agent Address (Must be Texas street address)</Text>
                    <VStack spacing={3} align="stretch">
                      <FormControl isInvalid={!!errors.agentAddress?.street}>
                        <FormLabel>Street Address</FormLabel>
                        <Input
                          {...register('agentAddress.street')}
                          placeholder="123 Main Street"
                        />
                        <FormErrorMessage>{errors.agentAddress?.street?.message}</FormErrorMessage>
                      </FormControl>

                      <HStack spacing={4}>
                        <FormControl isInvalid={!!errors.agentAddress?.city}>
                          <FormLabel>City</FormLabel>
                          <Input
                            {...register('agentAddress.city')}
                            placeholder="Austin"
                          />
                          <FormErrorMessage>{errors.agentAddress?.city?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!errors.agentAddress?.state}>
                          <FormLabel>State</FormLabel>
                          <Select {...register('agentAddress.state')}>
                            {texasStates.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </Select>
                          <FormErrorMessage>{errors.agentAddress?.state?.message}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!errors.agentAddress?.zipCode}>
                          <FormLabel>ZIP Code</FormLabel>
                          <Input
                            {...register('agentAddress.zipCode')}
                            placeholder="78701"
                          />
                          <FormErrorMessage>{errors.agentAddress?.zipCode?.message}</FormErrorMessage>
                        </FormControl>
                      </HStack>
                    </VStack>
                  </Box>

                  <HStack spacing={4}>
                    <FormControl isInvalid={!!errors.agentPhone}>
                      <FormLabel>Phone Number</FormLabel>
                      <Input
                        {...register('agentPhone')}
                        placeholder="(555) 123-4567"
                        type="tel"
                      />
                      <FormErrorMessage>{errors.agentPhone?.message}</FormErrorMessage>
                    </FormControl>

                    <FormControl isInvalid={!!errors.agentEmail}>
                      <FormLabel>Email Address</FormLabel>
                      <Input
                        {...register('agentEmail')}
                        placeholder="agent@example.com"
                        type="email"
                      />
                      <FormErrorMessage>{errors.agentEmail?.message}</FormErrorMessage>
                    </FormControl>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Business Hours */}
            {agentType === 'self' && (
              <Card>
                <CardHeader>
                  <Text fontSize="lg" fontWeight="semibold">Availability</Text>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <Text fontSize="sm" color="gray.600">
                      Select the days you'll be available to receive legal documents:
                    </Text>
                    <SimpleGrid columns={4} spacing={2}>
                      {Object.entries({
                        monday: 'Monday',
                        tuesday: 'Tuesday',
                        wednesday: 'Wednesday',
                        thursday: 'Thursday',
                        friday: 'Friday',
                        saturday: 'Saturday',
                        sunday: 'Sunday'
                      }).map(([key, label]) => (
                        <Checkbox key={key} {...register(`businessHours.${key}` as any)}>
                          {label}
                        </Checkbox>
                      ))}
                    </SimpleGrid>
                  </VStack>
                </CardBody>
              </Card>
            )}

            {/* Special Instructions */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Special Instructions (Optional)</Text>
              </CardHeader>
              <CardBody>
                <FormControl>
                  <FormLabel>Additional Instructions</FormLabel>
                  <Input
                    {...register('specialInstructions')}
                    placeholder="Any special delivery instructions or notes..."
                  />
                </FormControl>
              </CardBody>
            </Card>

            {/* Confirmation */}
            <FormControl isInvalid={!!errors.acceptsService}>
              <Checkbox {...register('acceptsService')}>
                I confirm that the designated registered agent accepts service of process and 
                has agreed to serve in this capacity for the LLC.
              </Checkbox>
              <FormErrorMessage>{errors.acceptsService?.message}</FormErrorMessage>
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
                Save Registered Agent
              </Button>
            </Box>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};
