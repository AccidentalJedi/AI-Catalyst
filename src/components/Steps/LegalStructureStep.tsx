import React, { useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  FormErrorMessage,
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiShield, FiDollarSign, FiUsers, FiFileText } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { LegalStructure } from '../../types';

// Validation schema
const schema = yup.object().shape({
  entityType: yup.string().required('Entity type is required'),
  taxElection: yup.string().required('Tax election is required'),
  managementStructure: yup.string().required('Management structure is required'),
  ownershipStructure: yup.string().required('Ownership structure is required'),
  filingState: yup.string().required('Filing state is required')
});

type FormData = yup.InferType<typeof schema>;

const entityTypes = [
  {
    value: 'llc',
    label: 'Limited Liability Company (LLC)',
    description: 'Flexible structure with liability protection and tax benefits',
    pros: [
      'Limited personal liability protection',
      'Flexible management structure',
      'Pass-through taxation (no double taxation)',
      'Fewer compliance requirements',
      'Credibility with customers and vendors'
    ],
    cons: [
      'Self-employment taxes on all income',
      'Limited life in some states',
      'Difficulty raising capital from investors'
    ],
    bestFor: 'Small to medium businesses, social enterprises, veteran-owned businesses',
    texasFilingFee: '$300 (waived for qualifying veterans)',
    recommended: true
  },
  {
    value: 'corporation',
    label: 'C-Corporation',
    description: 'Traditional corporate structure with shareholders',
    pros: [
      'Strong liability protection',
      'Easier to raise capital',
      'Perpetual existence',
      'Tax-deductible employee benefits',
      'Credibility with investors'
    ],
    cons: [
      'Double taxation (corporate and personal)',
      'Complex compliance requirements',
      'Rigid management structure',
      'More expensive to maintain'
    ],
    bestFor: 'Businesses planning to raise significant capital or go public',
    texasFilingFee: '$300',
    recommended: false
  },
  {
    value: 's-corp',
    label: 'S-Corporation',
    description: 'Corporation with pass-through taxation',
    pros: [
      'Pass-through taxation',
      'Limited liability protection',
      'Potential tax savings on self-employment',
      'Credibility with lenders'
    ],
    cons: [
      'Strict ownership restrictions',
      'Limited to 100 shareholders',
      'Complex payroll requirements',
      'IRS scrutiny on salary vs. distributions'
    ],
    bestFor: 'Profitable businesses with few owners',
    texasFilingFee: '$300 + S-Corp election',
    recommended: false
  },
  {
    value: 'nonprofit',
    label: 'Nonprofit Corporation',
    description: 'Tax-exempt organization for charitable purposes',
    pros: [
      'Tax-exempt status',
      'Eligible for grants and donations',
      'Public trust and credibility',
      'Potential property tax exemptions'
    ],
    cons: [
      'Complex compliance requirements',
      'Restrictions on activities and compensation',
      'No personal financial benefit',
      'Lengthy IRS approval process'
    ],
    bestFor: 'Pure charitable or educational missions',
    texasFilingFee: '$25',
    recommended: false
  }
];

const taxElections = [
  {
    value: 'default',
    label: 'Default Tax Treatment',
    description: 'LLC taxed as sole proprietorship (single member) or partnership (multi-member)'
  },
  {
    value: 's-corp',
    label: 'S-Corporation Election',
    description: 'LLC elects to be taxed as S-Corporation for potential payroll tax savings'
  },
  {
    value: 'c-corp',
    label: 'C-Corporation Election',
    description: 'LLC elects to be taxed as C-Corporation (rarely beneficial for small businesses)'
  }
];

const managementStructures = [
  {
    value: 'member-managed',
    label: 'Member-Managed',
    description: 'All members participate in day-to-day management decisions'
  },
  {
    value: 'manager-managed',
    label: 'Manager-Managed',
    description: 'Designated managers handle daily operations, members are passive investors'
  }
];

const ownershipStructures = [
  {
    value: 'single-member',
    label: 'Single-Member LLC',
    description: 'One owner (individual or entity)'
  },
  {
    value: 'multi-member',
    label: 'Multi-Member LLC',
    description: 'Multiple owners with defined ownership percentages'
  }
];

export const LegalStructureStep: React.FC = () => {
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
    defaultValues: userProfile.legalStructure || {
      entityType: 'llc',
      taxElection: 'default',
      managementStructure: 'member-managed',
      ownershipStructure: 'single-member',
      filingState: 'texas'
    }
  });

  const watchedValues = watch();
  const selectedEntityType = watch('entityType');
  const selectedTaxElection = watch('taxElection');
  const selectedOwnership = watch('ownershipStructure');

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value) => {
      updateUserProfile({
        legalStructure: value as LegalStructure
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, updateUserProfile]);

  const onSubmit = (data: FormData) => {
    updateUserProfile({
      legalStructure: data as LegalStructure
    });
    
    completeStep('legal-structure');
    
    toast({
      title: 'Legal structure saved',
      description: 'Your business legal structure has been saved successfully.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const getSelectedEntityDetails = () => {
    return entityTypes.find(type => type.value === selectedEntityType);
  };

  const isVeteranEligible = () => {
    return userProfile.veteranStatus?.dischargeType === 'honorable' && 
           userProfile.veteranStatus?.serviceStatus === 'veteran';
  };

  return (
    <Box maxW="6xl" mx="auto" p={6}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Legal Structure Selection
          </Text>
          <Text color="gray.600" mb={4}>
            Choose the best legal structure for your AI education platform. We recommend an LLC 
            for most social enterprises due to its flexibility and liability protection.
          </Text>
          
          {isVeteranEligible() && (
            <Alert status="success" mb={4}>
              <AlertIcon />
              <Box>
                <AlertTitle>Veteran Filing Fee Waiver Available!</AlertTitle>
                <AlertDescription>
                  As an honorably discharged veteran, you're eligible for a waiver of the $300 
                  Texas LLC filing fee, saving you money on business formation.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} align="stretch">
            
            {/* Entity Type Selection */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiShield} color="blue.500" />
                  <Text fontSize="lg" fontWeight="semibold">Business Entity Type</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <FormControl isInvalid={!!errors.entityType}>
                  <Controller
                    name="entityType"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup {...field}>
                        <VStack spacing={4} align="stretch">
                          {entityTypes.map((type) => (
                            <Card
                              key={type.value}
                              variant={selectedEntityType === type.value ? 'filled' : 'outline'}
                              cursor="pointer"
                              onClick={() => field.onChange(type.value)}
                              position="relative"
                            >
                              <CardBody>
                                <HStack align="start" spacing={4}>
                                  <Radio value={type.value} size="lg" mt={1} />
                                  <Box flex={1}>
                                    <HStack justify="space-between" mb={2}>
                                      <Text fontWeight="bold" fontSize="lg">
                                        {type.label}
                                        {type.recommended && (
                                          <Badge colorScheme="green" ml={2}>Recommended</Badge>
                                        )}
                                      </Text>
                                      <VStack align="end" spacing={1}>
                                        <Text fontSize="sm" color="gray.600">Texas Filing Fee</Text>
                                        <Text fontWeight="bold" color={type.value === 'llc' && isVeteranEligible() ? 'green.600' : 'inherit'}>
                                          {type.value === 'llc' && isVeteranEligible() ? 'FREE (Veteran Waiver)' : type.texasFilingFee}
                                        </Text>
                                      </VStack>
                                    </HStack>
                                    <Text color="gray.600" mb={3}>{type.description}</Text>
                                    <Text fontSize="sm" color="blue.600" mb={2}>
                                      <strong>Best for:</strong> {type.bestFor}
                                    </Text>
                                    
                                    <SimpleGrid columns={2} spacing={4}>
                                      <Box>
                                        <Text fontSize="sm" fontWeight="semibold" color="green.600" mb={1}>
                                          Advantages:
                                        </Text>
                                        <List fontSize="xs" spacing={0}>
                                          {type.pros.map((pro, index) => (
                                            <ListItem key={index}>
                                              <ListIcon as={FiCheck} color="green.500" />
                                              {pro}
                                            </ListItem>
                                          ))}
                                        </List>
                                      </Box>
                                      <Box>
                                        <Text fontSize="sm" fontWeight="semibold" color="red.600" mb={1}>
                                          Considerations:
                                        </Text>
                                        <List fontSize="xs" spacing={0}>
                                          {type.cons.map((con, index) => (
                                            <ListItem key={index}>
                                              <ListIcon as={FiInfo} color="red.500" />
                                              {con}
                                            </ListItem>
                                          ))}
                                        </List>
                                      </Box>
                                    </SimpleGrid>
                                  </Box>
                                </HStack>
                              </CardBody>
                            </Card>
                          ))}
                        </VStack>
                      </RadioGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.entityType?.message}</FormErrorMessage>
                </FormControl>
              </CardBody>
            </Card>

            {/* LLC-Specific Options */}
            {selectedEntityType === 'llc' && (
              <>
                {/* Tax Election */}
                <Card>
                  <CardHeader>
                    <HStack>
                      <Icon as={FiDollarSign} color="green.500" />
                      <Text fontSize="lg" fontWeight="semibold">Tax Election</Text>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <FormControl isInvalid={!!errors.taxElection}>
                      <FormLabel>How would you like your LLC to be taxed?</FormLabel>
                      <Controller
                        name="taxElection"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup {...field}>
                            <VStack spacing={3} align="stretch">
                              {taxElections.map((election) => (
                                <Box key={election.value}>
                                  <Radio value={election.value}>
                                    <Text fontWeight="semibold">{election.label}</Text>
                                  </Radio>
                                  <Text fontSize="sm" color="gray.600" ml={6}>
                                    {election.description}
                                  </Text>
                                </Box>
                              ))}
                            </VStack>
                          </RadioGroup>
                        )}
                      />
                      <FormErrorMessage>{errors.taxElection?.message}</FormErrorMessage>
                    </FormControl>
                  </CardBody>
                </Card>

                {/* Management Structure */}
                <Card>
                  <CardHeader>
                    <HStack>
                      <Icon as={FiUsers} color="purple.500" />
                      <Text fontSize="lg" fontWeight="semibold">Management Structure</Text>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <FormControl isInvalid={!!errors.managementStructure}>
                      <FormLabel>Who will manage the day-to-day operations?</FormLabel>
                      <Controller
                        name="managementStructure"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup {...field}>
                            <VStack spacing={3} align="stretch">
                              {managementStructures.map((structure) => (
                                <Box key={structure.value}>
                                  <Radio value={structure.value}>
                                    <Text fontWeight="semibold">{structure.label}</Text>
                                  </Radio>
                                  <Text fontSize="sm" color="gray.600" ml={6}>
                                    {structure.description}
                                  </Text>
                                </Box>
                              ))}
                            </VStack>
                          </RadioGroup>
                        )}
                      />
                      <FormErrorMessage>{errors.managementStructure?.message}</FormErrorMessage>
                    </FormControl>
                  </CardBody>
                </Card>

                {/* Ownership Structure */}
                <Card>
                  <CardHeader>
                    <HStack>
                      <Icon as={FiFileText} color="orange.500" />
                      <Text fontSize="lg" fontWeight="semibold">Ownership Structure</Text>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <FormControl isInvalid={!!errors.ownershipStructure}>
                      <FormLabel>How many owners will the LLC have?</FormLabel>
                      <Controller
                        name="ownershipStructure"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup {...field}>
                            <VStack spacing={3} align="stretch">
                              {ownershipStructures.map((structure) => (
                                <Box key={structure.value}>
                                  <Radio value={structure.value}>
                                    <Text fontWeight="semibold">{structure.label}</Text>
                                  </Radio>
                                  <Text fontSize="sm" color="gray.600" ml={6}>
                                    {structure.description}
                                  </Text>
                                </Box>
                              ))}
                            </VStack>
                          </RadioGroup>
                        )}
                      />
                      <FormErrorMessage>{errors.ownershipStructure?.message}</FormErrorMessage>
                    </FormControl>
                  </CardBody>
                </Card>
              </>
            )}

            {/* Filing State */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Filing State</Text>
              </CardHeader>
              <CardBody>
                <FormControl isInvalid={!!errors.filingState}>
                  <FormLabel>Where will you file your business?</FormLabel>
                  <Controller
                    name="filingState"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup {...field}>
                        <VStack spacing={2} align="start">
                          <Radio value="texas">
                            <Text fontWeight="semibold">Texas</Text>
                            <Text fontSize="sm" color="gray.600" ml={6}>
                              Recommended for Texas-based operations. Veteran fee waivers available.
                            </Text>
                          </Radio>
                          <Radio value="delaware">
                            <Text fontWeight="semibold">Delaware</Text>
                            <Text fontSize="sm" color="gray.600" ml={6}>
                              Business-friendly laws but additional complexity for Texas operations.
                            </Text>
                          </Radio>
                          <Radio value="other">
                            <Text fontWeight="semibold">Other State</Text>
                            <Text fontSize="sm" color="gray.600" ml={6}>
                              Consider if you have specific requirements for another state.
                            </Text>
                          </Radio>
                        </VStack>
                      </RadioGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.filingState?.message}</FormErrorMessage>
                </FormControl>
              </CardBody>
            </Card>

            {/* Summary */}
            {selectedEntityType && (
              <Card bg="blue.50" borderColor="blue.200">
                <CardHeader>
                  <Text fontSize="lg" fontWeight="semibold">Your Selection Summary</Text>
                </CardHeader>
                <CardBody>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontWeight="semibold">Entity Type:</Text>
                      <Text>{getSelectedEntityDetails()?.label}</Text>
                    </HStack>
                    {selectedEntityType === 'llc' && (
                      <>
                        <HStack justify="space-between">
                          <Text fontWeight="semibold">Tax Election:</Text>
                          <Text>{taxElections.find(e => e.value === selectedTaxElection)?.label}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontWeight="semibold">Management:</Text>
                          <Text>{managementStructures.find(s => s.value === watchedValues.managementStructure)?.label}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontWeight="semibold">Ownership:</Text>
                          <Text>{ownershipStructures.find(s => s.value === selectedOwnership)?.label}</Text>
                        </HStack>
                      </>
                    )}
                    <HStack justify="space-between">
                      <Text fontWeight="semibold">Filing State:</Text>
                      <Text textTransform="capitalize">{watchedValues.filingState}</Text>
                    </HStack>
                    <Divider />
                    <HStack justify="space-between">
                      <Text fontWeight="bold">Estimated Filing Fee:</Text>
                      <Text fontWeight="bold" color={selectedEntityType === 'llc' && isVeteranEligible() ? 'green.600' : 'inherit'}>
                        {selectedEntityType === 'llc' && isVeteranEligible() 
                          ? 'FREE (Veteran Waiver)' 
                          : getSelectedEntityDetails()?.texasFilingFee || 'TBD'
                        }
                      </Text>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            )}

            {/* Submit Button */}
            <Box pt={6}>
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                isDisabled={!isValid}
                leftIcon={<FiCheck />}
              >
                Save Legal Structure
              </Button>
            </Box>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};
