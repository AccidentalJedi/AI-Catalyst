import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Checkbox,
  CheckboxGroup,
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
  Progress,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Textarea
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiInfo, FiCheck, FiFileText, FiDownload, FiEye, FiEdit } from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';
import { LegalDocuments } from '../../types';
import { BusinessFormationApiService, BusinessFormationRequest } from '@/services/businessFormationApi';
import { DocuSignApiService, type Form205Data, type OperatingAgreementData, type EINApplicationData } from '@/services/docusignApi';
import { EmbeddedSigningModal } from '@/components/DocuSign/EmbeddedSigningModal';

// Validation schema
const schema = yup.object().shape({
  documentsToGenerate: yup.array().of(yup.string()).min(1, 'Please select at least one document to generate'),
  operatingAgreementType: yup.string().when('documentsToGenerate', {
    is: (docs: string[]) => docs?.includes('operating-agreement'),
    then: (schema) => schema.required('Operating agreement type is required'),
    otherwise: (schema) => schema.nullable()
  }),
  customClauses: yup.array().of(yup.string()),
  signatureMethod: yup.string().required('Signature method is required'),
  documentDelivery: yup.string().required('Document delivery method is required'),
  reviewRequired: yup.boolean(),
  attorneyReview: yup.boolean(),
  expeditedProcessing: yup.boolean()
});

type FormData = yup.InferType<typeof schema>;

const availableDocuments = [
  {
    id: 'certificate-of-formation',
    name: 'Certificate of Formation (Form 205)',
    description: 'Required filing document with Texas Secretary of State',
    required: true,
    fee: 'Filing fee applies',
    timeToComplete: '1-2 business days',
    details: [
      'Legal name and registered agent information',
      'Business purpose and duration',
      'Management structure details',
      'Organizer information and signature'
    ]
  },
  {
    id: 'operating-agreement',
    name: 'Operating Agreement',
    description: 'Internal document governing LLC operations and member relationships',
    required: false,
    fee: 'No filing fee',
    timeToComplete: 'Same day',
    details: [
      'Member rights and responsibilities',
      'Profit and loss distribution',
      'Management structure and voting',
      'Transfer restrictions and dissolution procedures'
    ]
  },
  {
    id: 'ein-application',
    name: 'EIN Application (SS-4)',
    description: 'Federal tax identification number application',
    required: true,
    fee: 'Free (if filed directly)',
    timeToComplete: 'Immediate online',
    details: [
      'Business identification information',
      'Responsible party details',
      'Business activity classification',
      'Employee and tax information'
    ]
  },
  {
    id: 'initial-resolutions',
    name: 'Initial Resolutions',
    description: 'Formal decisions and authorizations for business setup',
    required: false,
    fee: 'No filing fee',
    timeToComplete: 'Same day',
    details: [
      'Banking resolutions and account authorization',
      'Business license applications',
      'Initial business decisions',
      'Officer and manager appointments'
    ]
  },
  {
    id: 'bylaws',
    name: 'Company Bylaws',
    description: 'Internal rules and procedures for business operations',
    required: false,
    fee: 'No filing fee',
    timeToComplete: 'Same day',
    details: [
      'Meeting procedures and requirements',
      'Record keeping and documentation',
      'Amendment procedures',
      'Conflict resolution processes'
    ]
  }
];

const operatingAgreementTypes = [
  {
    value: 'single-member-basic',
    label: 'Single-Member Basic',
    description: 'Simple agreement for sole owner LLCs'
  },
  {
    value: 'single-member-comprehensive',
    label: 'Single-Member Comprehensive',
    description: 'Detailed agreement with advanced provisions'
  },
  {
    value: 'multi-member-equal',
    label: 'Multi-Member Equal Ownership',
    description: 'Equal ownership and management rights'
  },
  {
    value: 'multi-member-custom',
    label: 'Multi-Member Custom',
    description: 'Custom ownership percentages and roles'
  }
];

const customClauseOptions = [
  'Non-compete agreements',
  'Confidentiality provisions',
  'Buy-sell agreements',
  'Succession planning',
  'Dispute resolution procedures',
  'Intellectual property ownership',
  'Employment terms',
  'Profit distribution formulas'
];

export const LegalDocumentsStep: React.FC = () => {
  const toast = useToast();
  const { userProfile, updateUserProfile, completeStep } = useWizardStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // DocuSign state
  const [isDocuSignAuthenticated, setIsDocuSignAuthenticated] = useState(false);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [currentSigningUrl, setCurrentSigningUrl] = useState<string>('');
  const [currentEnvelopeId, setCurrentEnvelopeId] = useState<string>('');
  const [currentDocumentName, setCurrentDocumentName] = useState<string>('');
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, string>>({});
  
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
    defaultValues: userProfile.legalDocuments || {
      documentsToGenerate: ['certificate-of-formation', 'ein-application'],
      operatingAgreementType: '',
      customClauses: [],
      signatureMethod: 'docusign',
      documentDelivery: 'email',
      reviewRequired: false,
      attorneyReview: false,
      expeditedProcessing: false
    }
  });

  const watchedValues = watch();
  const documentsToGenerate = watch('documentsToGenerate') || [];
  const includesOperatingAgreement = documentsToGenerate.includes('operating-agreement');

  // Auto-save form data as user types
  useEffect(() => {
    const subscription = watch((value) => {
      updateUserProfile({
        legalDocuments: value as LegalDocuments
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, updateUserProfile]);

  // Check DocuSign authentication status on mount
  useEffect(() => {
    const checkDocuSignAuth = async () => {
      try {
        const isAuthenticated = await DocuSignApiService.isAuthenticated();
        setIsDocuSignAuthenticated(isAuthenticated);

        if (!isAuthenticated) {
          // Attempt to authenticate
          const authResult = await DocuSignApiService.authenticate();
          if (authResult.success) {
            setIsDocuSignAuthenticated(true);
            toast({
              title: 'DocuSign Connected',
              description: 'Document signing service is ready.',
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
          }
        }
      } catch (error) {
        console.error('DocuSign authentication check failed:', error);
        setIsDocuSignAuthenticated(false);
      }
    };

    checkDocuSignAuth();
  }, [toast]);

  const handleDocumentPreview = (document: any) => {
    setSelectedDocument(document);
    onOpen();
  };

  // Create DocuSign documents based on selected documents
  const createDocuSignDocuments = async (data: FormData) => {
    const documentsToGenerate = data.documentsToGenerate || [];
    const signerEmail = userProfile.contactInfo?.email || '';
    const signerName = `${userProfile.contactInfo?.firstName || ''} ${userProfile.contactInfo?.lastName || ''}`.trim();
    const companyName = userProfile.businessName?.primaryName || '';

    if (!signerEmail || !signerName || !companyName) {
      throw new Error('Missing required information for document creation. Please complete previous steps.');
    }

    // Create Form 205 (Certificate of Formation)
    if (documentsToGenerate.includes('certificate-of-formation')) {
      setGenerationProgress(25);
      const form205Data: Form205Data = {
        documentName: 'Texas Certificate of Formation',
        signerEmail,
        signerName,
        companyName,
        registeredAgentName: userProfile.registeredAgent?.agentName || signerName,
        registeredAgentAddress: `${userProfile.registeredAgent?.agentAddress?.street || ''}, ${userProfile.registeredAgent?.agentAddress?.city || ''}, ${userProfile.registeredAgent?.agentAddress?.state || ''} ${userProfile.registeredAgent?.agentAddress?.zipCode || ''}`,
        managementStructure: userProfile.legalStructure?.managementStructure || 'Member-managed',
        purpose: userProfile.businessName?.businessPurpose || 'General business purposes'
      };

      const result = await DocuSignApiService.createForm205Envelope(form205Data);
      if (result.success && result.envelopeId) {
        setDocumentStatuses(prev => ({ ...prev, 'certificate-of-formation': 'created' }));
        await initiateDocumentSigning(result.envelopeId, 'Texas Certificate of Formation', signerEmail, signerName);
      } else {
        throw new Error(`Failed to create Certificate of Formation: ${result.error}`);
      }
    }

    // Create Operating Agreement
    if (documentsToGenerate.includes('operating-agreement')) {
      setGenerationProgress(50);
      const operatingAgreementData: OperatingAgreementData = {
        documentName: 'LLC Operating Agreement',
        signerEmail,
        signerName,
        companyName,
        memberName: signerName,
        membershipPercentage: '100',
        effectiveDate: new Date().toISOString(),
        managementStructure: userProfile.legalStructure?.managementStructure || 'Member-managed',
        initialCapital: '1000'
      };

      const result = await DocuSignApiService.createOperatingAgreementEnvelope(operatingAgreementData);
      if (result.success && result.envelopeId) {
        setDocumentStatuses(prev => ({ ...prev, 'operating-agreement': 'created' }));
        await initiateDocumentSigning(result.envelopeId, 'LLC Operating Agreement', signerEmail, signerName);
      } else {
        throw new Error(`Failed to create Operating Agreement: ${result.error}`);
      }
    }

    // Create EIN Application
    if (documentsToGenerate.includes('ein-application')) {
      setGenerationProgress(75);
      const einApplicationData: EINApplicationData = {
        documentName: 'EIN Application (SS-4)',
        signerEmail,
        signerName,
        companyName,
        businessAddress: `${userProfile.registeredAgent?.agentAddress?.street || ''}, ${userProfile.registeredAgent?.agentAddress?.city || ''}, ${userProfile.registeredAgent?.agentAddress?.state || ''} ${userProfile.registeredAgent?.agentAddress?.zipCode || ''}`,
        mailingAddress: `${userProfile.registeredAgent?.agentAddress?.street || ''}, ${userProfile.registeredAgent?.agentAddress?.city || ''}, ${userProfile.registeredAgent?.agentAddress?.state || ''} ${userProfile.registeredAgent?.agentAddress?.zipCode || ''}`,
        streetAddress: userProfile.registeredAgent?.agentAddress?.street || '',
        responsiblePartyName: signerName,
        responsiblePartySSN: 'XXX-XX-XXXX' // This would need to be collected separately
      };

      const result = await DocuSignApiService.createEINApplicationEnvelope(einApplicationData);
      if (result.success && result.envelopeId) {
        setDocumentStatuses(prev => ({ ...prev, 'ein-application': 'created' }));
        await initiateDocumentSigning(result.envelopeId, 'EIN Application (SS-4)', signerEmail, signerName);
      } else {
        throw new Error(`Failed to create EIN Application: ${result.error}`);
      }
    }

    setGenerationProgress(100);
  };

  // Initiate document signing process
  const initiateDocumentSigning = async (envelopeId: string, documentName: string, signerEmail: string, signerName: string) => {
    try {
      const signingResult = await DocuSignApiService.createEmbeddedSigningView(envelopeId, {
        email: signerEmail,
        name: signerName,
        clientUserId: '1000'
      });

      if (signingResult.success && signingResult.signingUrl) {
        setCurrentEnvelopeId(envelopeId);
        setCurrentSigningUrl(signingResult.signingUrl);
        setCurrentDocumentName(documentName);
        setIsSigningModalOpen(true);
      } else {
        throw new Error(`Failed to create signing view: ${signingResult.error}`);
      }
    } catch (error) {
      console.error('Error initiating document signing:', error);
      throw error;
    }
  };

  // Handle signing completion
  const handleSigningComplete = (envelopeId: string) => {
    setDocumentStatuses(prev => ({ ...prev, [envelopeId]: 'completed' }));
    setIsSigningModalOpen(false);

    toast({
      title: 'Document Signed Successfully',
      description: `${currentDocumentName} has been signed and submitted.`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
  };

  // Handle signing error
  const handleSigningError = (error: string) => {
    toast({
      title: 'Signing Error',
      description: error,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  const generateDocuments = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Simulate document generation progress
    const steps = documentsToGenerate.length;
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGenerationProgress(((i + 1) / steps) * 100);
    }
    
    setIsGenerating(false);
    toast({
      title: 'Documents generated',
      description: 'Your legal documents have been generated and are ready for review.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const onSubmit = async (data: FormData) => {
    setIsGenerating(true);

    try {
      // Save to local state first
      updateUserProfile({
        legalDocuments: data as LegalDocuments
      });

      // Check DocuSign authentication
      if (!isDocuSignAuthenticated) {
        const authResult = await DocuSignApiService.authenticate();
        if (!authResult.success) {
          throw new Error('Failed to authenticate with DocuSign: ' + authResult.error);
        }
        setIsDocuSignAuthenticated(true);
      }

      // Create documents with DocuSign
      await createDocuSignDocuments(data);

      // Also submit to business formation API for workflow tracking
      const businessFormationRequest: BusinessFormationRequest = {
        businessName: userProfile.businessName?.primaryName || '',
        businessType: userProfile.legalStructure?.entityType as 'llc' | 'corporation' | 'partnership' || 'llc',
        filingState: userProfile.legalStructure?.filingState || 'texas',
        registeredAgent: userProfile.registeredAgent ? {
          name: userProfile.registeredAgent.agentName || '',
          address: `${userProfile.registeredAgent.agentAddress?.street || ''}, ${userProfile.registeredAgent.agentAddress?.city || ''}`,
          city: userProfile.registeredAgent.agentAddress?.city || '',
          state: userProfile.registeredAgent.agentAddress?.state || '',
          zipCode: userProfile.registeredAgent.agentAddress?.zipCode || ''
        } : undefined,
        documents: {
          documentsToGenerate: (data.documentsToGenerate || []).filter((doc): doc is string => typeof doc === 'string'),
          signatureMethod: data.signatureMethod || 'docusign',
          documentDelivery: data.documentDelivery || 'email'
        }
      };

      const response = await BusinessFormationApiService.submitBusinessFormation(businessFormationRequest);

      if (response.success) {
        completeStep('legal-documents');

        toast({
          title: 'Business formation submitted!',
          description: `Your business formation has been initiated. Workflow ID: ${response.data?.workflowId}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Business formation failed');
      }

    } catch (error) {
      console.error('Business formation submission failed:', error);

      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Failed to submit business formation. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getEstimatedCost = () => {
    let cost = 0;
    if (documentsToGenerate.includes('certificate-of-formation')) {
      const isVeteran = userProfile.veteranStatus?.dischargeType === 'honorable';
      cost += isVeteran ? 0 : 300; // Texas filing fee
    }
    if (watchedValues.expeditedProcessing) {
      cost += 25; // Expedited processing fee
    }
    return cost;
  };

  const getEstimatedTime = () => {
    if (watchedValues.expeditedProcessing) {
      return '1-2 business days';
    }
    return '3-5 business days';
  };

  return (
    <Box maxW="4xl" mx="auto" p={6}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Legal Document Generation
          </Text>
          <Text color="gray.600" mb={4}>
            Generate the legal documents needed to establish your AI education platform. 
            We'll create customized documents based on your business structure and preferences.
          </Text>
          
          <Alert status="info" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Document Automation</AlertTitle>
              <AlertDescription>
                All documents will be automatically populated with your information and can be 
                electronically signed through DocuSign integration.
              </AlertDescription>
            </Box>
          </Alert>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={8} align="stretch">
            
            {/* Document Selection */}
            <Card>
              <CardHeader>
                <HStack>
                  <Icon as={FiFileText} color="blue.500" />
                  <Text fontSize="lg" fontWeight="semibold">Document Selection</Text>
                </HStack>
              </CardHeader>
              <CardBody>
                <FormControl isInvalid={!!errors.documentsToGenerate}>
                  <FormLabel>Select documents to generate:</FormLabel>
                  <Controller
                    name="documentsToGenerate"
                    control={control}
                    render={({ field }) => (
                      <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                        <VStack spacing={4} align="stretch">
                          {availableDocuments.map((doc) => (
                            <Card
                              key={doc.id}
                              variant={documentsToGenerate.includes(doc.id) ? 'filled' : 'outline'}
                              cursor="pointer"
                            >
                              <CardBody>
                                <HStack align="start" spacing={4}>
                                  <Checkbox
                                    value={doc.id}
                                    size="lg"
                                    mt={1}
                                    isDisabled={doc.required}
                                    isChecked={documentsToGenerate.includes(doc.id)}
                                  />
                                  <Box flex={1}>
                                    <HStack justify="space-between" mb={2}>
                                      <Text fontWeight="bold">
                                        {doc.name}
                                        {doc.required && (
                                          <Badge colorScheme="red" ml={2}>Required</Badge>
                                        )}
                                      </Text>
                                      <HStack spacing={2}>
                                        <Badge variant="subtle">{doc.fee}</Badge>
                                        <Badge variant="subtle" colorScheme="blue">{doc.timeToComplete}</Badge>
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          leftIcon={<FiEye />}
                                          onClick={() => handleDocumentPreview(doc)}
                                        >
                                          Preview
                                        </Button>
                                      </HStack>
                                    </HStack>
                                    <Text fontSize="sm" color="gray.600" mb={2}>
                                      {doc.description}
                                    </Text>
                                    <List fontSize="xs" spacing={0}>
                                      {doc.details.map((detail, index) => (
                                        <ListItem key={index}>
                                          <ListIcon as={FiCheck} color="green.500" />
                                          {detail}
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Box>
                                </HStack>
                              </CardBody>
                            </Card>
                          ))}
                        </VStack>
                      </CheckboxGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.documentsToGenerate?.message}</FormErrorMessage>
                </FormControl>
              </CardBody>
            </Card>

            {/* Operating Agreement Options */}
            {includesOperatingAgreement && (
              <Card>
                <CardHeader>
                  <Text fontSize="lg" fontWeight="semibold">Operating Agreement Options</Text>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl isInvalid={!!errors.operatingAgreementType}>
                      <FormLabel>Operating Agreement Type</FormLabel>
                      <Controller
                        name="operatingAgreementType"
                        control={control}
                        render={({ field }) => (
                          <VStack spacing={2} align="stretch">
                            {operatingAgreementTypes.map((type) => (
                              <Card
                                key={type.value}
                                variant={watchedValues.operatingAgreementType === type.value ? 'filled' : 'outline'}
                                cursor="pointer"
                                onClick={() => field.onChange(type.value)}
                              >
                                <CardBody py={3}>
                                  <HStack>
                                    <input
                                      type="radio"
                                      value={type.value}
                                      checked={field.value === type.value}
                                      onChange={() => field.onChange(type.value)}
                                    />
                                    <Box>
                                      <Text fontWeight="semibold">{type.label}</Text>
                                      <Text fontSize="sm" color="gray.600">{type.description}</Text>
                                    </Box>
                                  </HStack>
                                </CardBody>
                              </Card>
                            ))}
                          </VStack>
                        )}
                      />
                      <FormErrorMessage>{errors.operatingAgreementType?.message}</FormErrorMessage>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Custom Clauses (Optional)</FormLabel>
                      <Controller
                        name="customClauses"
                        control={control}
                        render={({ field }) => (
                          <CheckboxGroup {...field} value={field.value?.filter(Boolean) || []}>
                            <SimpleGrid columns={2} spacing={2}>
                              {customClauseOptions.map((clause) => (
                                <Checkbox key={clause} value={clause} size="sm">
                                  {clause}
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
            )}

            {/* Signature and Delivery Options */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Signature & Delivery Options</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <FormControl isInvalid={!!errors.signatureMethod}>
                    <FormLabel>Signature Method</FormLabel>
                    <Controller
                      name="signatureMethod"
                      control={control}
                      render={({ field }) => (
                        <VStack spacing={2} align="start">
                          <label>
                            <input
                              type="radio"
                              value="docusign"
                              checked={field.value === 'docusign'}
                              onChange={() => field.onChange('docusign')}
                            />
                            <Text as="span" ml={2} fontWeight="semibold">
                              DocuSign Electronic Signature
                              <Badge colorScheme="green" ml={2}>Recommended</Badge>
                            </Text>
                            <Text fontSize="sm" color="gray.600" ml={6}>
                              Secure, legally binding electronic signatures
                            </Text>
                          </label>
                          <label>
                            <input
                              type="radio"
                              value="wet-signature"
                              checked={field.value === 'wet-signature'}
                              onChange={() => field.onChange('wet-signature')}
                            />
                            <Text as="span" ml={2} fontWeight="semibold">Wet Signature (Print & Sign)</Text>
                            <Text fontSize="sm" color="gray.600" ml={6}>
                              Traditional paper signatures (slower process)
                            </Text>
                          </label>
                        </VStack>
                      )}
                    />
                    <FormErrorMessage>{errors.signatureMethod?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.documentDelivery}>
                    <FormLabel>Document Delivery</FormLabel>
                    <Controller
                      name="documentDelivery"
                      control={control}
                      render={({ field }) => (
                        <VStack spacing={2} align="start">
                          <label>
                            <input
                              type="radio"
                              value="email"
                              checked={field.value === 'email'}
                              onChange={() => field.onChange('email')}
                            />
                            <Text as="span" ml={2}>Email Delivery</Text>
                          </label>
                          <label>
                            <input
                              type="radio"
                              value="portal"
                              checked={field.value === 'portal'}
                              onChange={() => field.onChange('portal')}
                            />
                            <Text as="span" ml={2}>Secure Portal Access</Text>
                          </label>
                          <label>
                            <input
                              type="radio"
                              value="mail"
                              checked={field.value === 'mail'}
                              onChange={() => field.onChange('mail')}
                            />
                            <Text as="span" ml={2}>Physical Mail</Text>
                          </label>
                        </VStack>
                      )}
                    />
                    <FormErrorMessage>{errors.documentDelivery?.message}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>

            {/* Additional Options */}
            <Card>
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Additional Options</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Checkbox {...register('reviewRequired')}>
                    I want to review all documents before signing
                  </Checkbox>
                  <Checkbox {...register('attorneyReview')}>
                    I want attorney review before finalizing (additional fee may apply)
                  </Checkbox>
                  <Checkbox {...register('expeditedProcessing')}>
                    Expedited processing (+$25 fee)
                  </Checkbox>
                </VStack>
              </CardBody>
            </Card>

            {/* Cost Summary */}
            <Card bg="blue.50" borderColor="blue.200">
              <CardHeader>
                <Text fontSize="lg" fontWeight="semibold">Cost & Timeline Summary</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between">
                    <Text>Estimated Total Cost:</Text>
                    <Text fontWeight="bold" color="green.600">
                      ${getEstimatedCost()}
                      {getEstimatedCost() === 0 && ' (Veteran Fee Waiver Applied)'}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text>Estimated Completion Time:</Text>
                    <Text fontWeight="bold">{getEstimatedTime()}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text>Documents Selected:</Text>
                    <Text fontWeight="bold">{documentsToGenerate.length}</Text>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Generation Progress */}
            {isGenerating && (
              <Card>
                <CardBody>
                  <VStack spacing={3}>
                    <Text fontWeight="semibold">Generating Documents...</Text>
                    <Progress value={generationProgress} width="100%" colorScheme="blue" />
                    <Text fontSize="sm" color="gray.600">
                      {Math.round(generationProgress)}% Complete
                    </Text>
                  </VStack>
                </CardBody>
              </Card>
            )}

            {/* Action Buttons */}
            <HStack spacing={4} pt={6}>
              <Button
                onClick={generateDocuments}
                isLoading={isGenerating}
                loadingText="Generating"
                leftIcon={<FiDownload />}
                colorScheme="green"
                isDisabled={documentsToGenerate.length === 0}
              >
                Generate Documents
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                isLoading={isGenerating}
                loadingText="Submitting Business Formation..."
                isDisabled={!isValid || isGenerating}
                leftIcon={<FiCheck />}
              >
                Submit Business Formation
              </Button>
            </HStack>
          </VStack>
        </form>

        {/* Document Preview Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{selectedDocument?.name}</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              {selectedDocument && (
                <VStack spacing={4} align="stretch">
                  <Text>{selectedDocument.description}</Text>
                  <Divider />
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Document Includes:</Text>
                    <List spacing={1}>
                      {selectedDocument.details.map((detail: string, index: number) => (
                        <ListItem key={index}>
                          <ListIcon as={FiCheck} color="green.500" />
                          {detail}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Processing Information:</Text>
                    <Text fontSize="sm">Fee: {selectedDocument.fee}</Text>
                    <Text fontSize="sm">Time to Complete: {selectedDocument.timeToComplete}</Text>
                  </Box>
                </VStack>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* DocuSign Embedded Signing Modal */}
        <EmbeddedSigningModal
          isOpen={isSigningModalOpen}
          onClose={() => setIsSigningModalOpen(false)}
          signingUrl={currentSigningUrl}
          documentName={currentDocumentName}
          recipientName={`${userProfile.contactInfo?.firstName || ''} ${userProfile.contactInfo?.lastName || ''}`.trim()}
          onSigningComplete={handleSigningComplete}
          onSigningError={handleSigningError}
          envelopeId={currentEnvelopeId}
        />
      </VStack>
    </Box>
  );
};
