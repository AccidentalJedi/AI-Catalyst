import React from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WizardLayout } from '@components/Wizard/WizardLayout';
import { WizardStepRenderer } from '@components/Wizard/WizardStepRenderer';

// Custom theme configuration
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: '#e3f2fd',
      100: '#bbdefb',
      200: '#90caf9',
      300: '#64b5f6',
      400: '#42a5f5',
      500: '#2196f3',
      600: '#1e88e5',
      700: '#1976d2',
      800: '#1565c0',
      900: '#0d47a1',
    },
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Progress: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
  },
});

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              <WizardLayout>
                <WizardStepRenderer />
              </WizardLayout>
            } 
          />
          <Route 
            path="/wizard" 
            element={
              <WizardLayout>
                <WizardStepRenderer />
              </WizardLayout>
            } 
          />
          <Route 
            path="/wizard/:phase/:step" 
            element={
              <WizardLayout>
                <WizardStepRenderer />
              </WizardLayout>
            } 
          />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
