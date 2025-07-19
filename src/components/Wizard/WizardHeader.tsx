import React from 'react';
import {
  Box,
  Container,
  Flex,
  Text,
  HStack,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Icon,
  Badge,
  useColorModeValue,
  useColorMode,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { 
  FiSave, 
  FiDownload, 
  FiSettings, 
  FiHelpCircle, 
  FiMoon, 
  FiSun,
  FiChevronDown,
  FiRefreshCw,
  FiFileText
} from 'react-icons/fi';
import { useWizardStore } from '@store/wizardStore';

export const WizardHeader: React.FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const {
    progress,
    generatedDocuments,
    actionItems,
    resetWizard,
    isLoading
  } = useWizardStore();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const brandColor = useColorModeValue('blue.600', 'blue.300');

  const pendingActionItems = actionItems.filter(item => !item.isComplete).length;
  const completedDocuments = generatedDocuments.length;

  const handleSaveProgress = () => {
    // Progress is automatically saved via Zustand persist
    // This could trigger a manual save or export
    console.log('Progress saved');
  };

  const handleExportData = () => {
    const exportData = {
      progress,
      generatedDocuments,
      actionItems,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-catalyst-progress-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetWizard = () => {
    if (window.confirm('Are you sure you want to reset all progress? This action cannot be undone.')) {
      resetWizard();
    }
  };

  return (
    <Box
      bg={bgColor}
      borderBottom="1px"
      borderColor={borderColor}
      position="sticky"
      top={0}
      zIndex={1000}
      shadow="sm"
    >
      <Container maxW="7xl">
        <Flex h={16} align="center" justify="space-between">
          {/* Logo and Title */}
          <HStack spacing={4}>
            <Box
              w={10}
              h={10}
              bg={brandColor}
              rounded="lg"
              display="flex"
              align="center"
              justify="center"
              color="white"
              fontWeight="bold"
              fontSize="lg"
            >
              AI
            </Box>
            <Box>
              <Text fontSize="xl" fontWeight="bold" color={brandColor}>
                AI Catalyst Launch Wizard
              </Text>
              <Text fontSize="sm" color="gray.600">
                Mission-Driven AI Education Platform Builder
              </Text>
            </Box>
          </HStack>

          {/* Status and Actions */}
          <HStack spacing={4}>
            {/* Progress Indicators */}
            <HStack spacing={3}>
              {completedDocuments > 0 && (
                <Tooltip label={`${completedDocuments} documents generated`}>
                  <Badge colorScheme="green" variant="subtle">
                    <HStack spacing={1}>
                      <Icon as={FiFileText} size="xs" />
                      <Text>{completedDocuments}</Text>
                    </HStack>
                  </Badge>
                </Tooltip>
              )}
              
              {pendingActionItems > 0 && (
                <Tooltip label={`${pendingActionItems} pending action items`}>
                  <Badge colorScheme="orange" variant="subtle">
                    <HStack spacing={1}>
                      <Icon as={FiSettings} size="xs" />
                      <Text>{pendingActionItems}</Text>
                    </HStack>
                  </Badge>
                </Tooltip>
              )}
            </HStack>

            {/* Action Buttons */}
            <HStack spacing={2}>
              <Tooltip label="Toggle dark mode">
                <IconButton
                  aria-label="Toggle color mode"
                  icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
                  variant="ghost"
                  size="sm"
                  onClick={toggleColorMode}
                />
              </Tooltip>

              <Tooltip label="Save progress">
                <IconButton
                  aria-label="Save progress"
                  icon={<FiSave />}
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveProgress}
                  isLoading={isLoading}
                />
              </Tooltip>

              <Tooltip label="Export data">
                <IconButton
                  aria-label="Export data"
                  icon={<FiDownload />}
                  variant="ghost"
                  size="sm"
                  onClick={handleExportData}
                />
              </Tooltip>

              {/* Settings Menu */}
              <Menu>
                <MenuButton
                  as={Button}
                  rightIcon={<FiChevronDown />}
                  variant="ghost"
                  size="sm"
                >
                  <Icon as={FiSettings} />
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<FiHelpCircle />}>
                    Help & Documentation
                  </MenuItem>
                  <MenuItem icon={<FiDownload />} onClick={handleExportData}>
                    Export Progress
                  </MenuItem>
                  <MenuItem icon={<FiSave />} onClick={handleSaveProgress}>
                    Save Progress
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem 
                    icon={<FiRefreshCw />} 
                    onClick={handleResetWizard}
                    color="red.500"
                  >
                    Reset Wizard
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};
