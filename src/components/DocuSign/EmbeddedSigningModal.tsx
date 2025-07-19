import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Box,
  Spinner,
  useToast,
  Icon,
  Badge,
  Divider
} from '@chakra-ui/react';
import { FiCheck, FiX, FiRefreshCw, FiExternalLink } from 'react-icons/fi';

interface EmbeddedSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  signingUrl?: string;
  documentName: string;
  recipientName: string;
  onSigningComplete?: (envelopeId: string) => void;
  onSigningError?: (error: string) => void;
  envelopeId?: string;
}

export const EmbeddedSigningModal: React.FC<EmbeddedSigningModalProps> = ({
  isOpen,
  onClose,
  signingUrl,
  documentName,
  recipientName,
  onSigningComplete,
  onSigningError,
  envelopeId
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toast = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage('');
      setIsCompleted(false);
      setProgress(0);
    }
  }, [isOpen]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setProgress(100);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage('Failed to load signing interface. Please try again or use external signing.');
    onSigningError?.('Failed to load signing interface');
  };

  // Listen for DocuSign completion events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (!event.origin.includes('docusign.net') && !event.origin.includes('docusign.com')) {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (data.type === 'docusign_signing_complete') {
          setIsCompleted(true);
          setIsLoading(false);
          
          toast({
            title: 'Document Signed Successfully',
            description: `${documentName} has been signed and completed.`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
          
          if (envelopeId) {
            onSigningComplete?.(envelopeId);
          }
        } else if (data.type === 'docusign_signing_error') {
          setHasError(true);
          setErrorMessage(data.message || 'An error occurred during signing');
          onSigningError?.(data.message || 'Signing error');
        } else if (data.type === 'docusign_signing_cancelled') {
          toast({
            title: 'Signing Cancelled',
            description: 'Document signing was cancelled by the user.',
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
          onClose();
        }
      } catch (error) {
        console.error('Error parsing DocuSign message:', error);
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, documentName, envelopeId, onSigningComplete, onSigningError, onClose, toast]);

  // Handle retry
  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    setProgress(0);
    
    // Reload iframe
    if (iframeRef.current) {
      iframeRef.current.src = signingUrl || '';
    }
  };

  // Handle external signing
  const handleExternalSigning = () => {
    if (signingUrl) {
      window.open(signingUrl, '_blank', 'noopener,noreferrer');
      toast({
        title: 'External Signing Opened',
        description: 'Please complete signing in the new window and return here.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="6xl" 
      closeOnOverlayClick={false}
      closeOnEsc={!isLoading}
    >
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent maxH="90vh" bg="white">
        <ModalHeader>
          <VStack spacing={2} align="stretch">
            <HStack justify="space-between" align="center">
              <Text fontSize="lg" fontWeight="bold">
                Sign Document: {documentName}
              </Text>
              <Badge colorScheme={isCompleted ? 'green' : 'blue'} variant="subtle">
                {isCompleted ? 'Completed' : 'In Progress'}
              </Badge>
            </HStack>
            <Text fontSize="sm" color="gray.600">
              Recipient: {recipientName}
            </Text>
            {!hasError && !isCompleted && (
              <Progress 
                value={progress} 
                size="sm" 
                colorScheme="blue" 
                bg="gray.100"
                borderRadius="md"
              />
            )}
          </VStack>
        </ModalHeader>
        
        {!isCompleted && <ModalCloseButton />}

        <ModalBody p={0}>
          {/* Loading State */}
          {isLoading && !hasError && (
            <VStack spacing={4} py={12} align="center">
              <Spinner size="xl" color="blue.500" thickness="4px" />
              <Text fontSize="lg" fontWeight="medium">
                Loading Signing Interface...
              </Text>
              <Text fontSize="sm" color="gray.600" textAlign="center" maxW="md">
                Please wait while we prepare your document for signing. This may take a few moments.
              </Text>
            </VStack>
          )}

          {/* Error State */}
          {hasError && (
            <VStack spacing={6} p={8} align="center">
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <VStack spacing={2} align="start" flex={1}>
                  <AlertTitle>Signing Interface Error</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </VStack>
              </Alert>
              
              <HStack spacing={4}>
                <Button
                  leftIcon={<Icon as={FiRefreshCw} />}
                  colorScheme="blue"
                  onClick={handleRetry}
                >
                  Try Again
                </Button>
                <Button
                  leftIcon={<Icon as={FiExternalLink} />}
                  variant="outline"
                  onClick={handleExternalSigning}
                >
                  Open in New Window
                </Button>
              </HStack>
            </VStack>
          )}

          {/* Success State */}
          {isCompleted && (
            <VStack spacing={6} p={8} align="center">
              <Box
                w={16}
                h={16}
                bg="green.100"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon as={FiCheck} w={8} h={8} color="green.500" />
              </Box>
              
              <VStack spacing={2} textAlign="center">
                <Text fontSize="xl" fontWeight="bold" color="green.600">
                  Document Signed Successfully!
                </Text>
                <Text color="gray.600">
                  {documentName} has been completed and submitted.
                </Text>
              </VStack>

              <Divider />

              <VStack spacing={3} align="stretch" w="full" maxW="md">
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  Next Steps:
                </Text>
                <Text fontSize="sm" color="gray.600">
                  • Your signed document will be processed automatically
                </Text>
                <Text fontSize="sm" color="gray.600">
                  • You'll receive email confirmation shortly
                </Text>
                <Text fontSize="sm" color="gray.600">
                  • Continue with the next step in your business formation
                </Text>
              </VStack>

              <Button colorScheme="green" size="lg" onClick={onClose}>
                Continue
              </Button>
            </VStack>
          )}

          {/* DocuSign Iframe */}
          {signingUrl && !hasError && !isCompleted && (
            <Box
              position="relative"
              w="full"
              h="70vh"
              bg="gray.50"
              borderRadius="md"
              overflow="hidden"
            >
              <iframe
                ref={iframeRef}
                src={signingUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                title="DocuSign Signing Interface"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  display: isLoading ? 'none' : 'block'
                }}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
              />
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
