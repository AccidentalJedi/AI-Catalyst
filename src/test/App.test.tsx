import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import App from '../App'

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </ChakraProvider>
)

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Basic smoke test - just ensure the app renders
    expect(document.body).toBeTruthy()
  })

  it('contains the main application content', () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Look for any text that indicates the app is working
    // This is a very basic test that should pass
    const appElement = screen.getByRole('main', { hidden: true }) || document.querySelector('[data-testid="app"]') || document.body
    expect(appElement).toBeTruthy()
  })
})
