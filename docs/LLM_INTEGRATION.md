# LLM Integration Guide for AI Catalyst

## Overview

The AI Catalyst Launch Wizard integrates with multiple LLM providers to power intelligent grant eligibility classification. This system supports local deployment (Ollama, LMStudio) and cloud APIs (OpenRouter) for flexible deployment options.

## Supported LLM Providers

### 1. Ollama (Recommended for Local Deployment)

**Setup:**
1. Install Ollama: https://ollama.ai/
2. Pull a suitable model: `ollama pull llama3.2:3b`
3. Start Ollama server: `ollama serve`
4. Set environment variables:
   ```bash
   OLLAMA_ENABLED=true
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2:3b
   ```

**Advantages:**
- Complete privacy (no data leaves your server)
- No API costs
- Fast inference for classification tasks
- Works offline

### 2. LMStudio (Alternative Local Option)

**Setup:**
1. Download LMStudio: https://lmstudio.ai/
2. Download a compatible model (e.g., Microsoft DialoGPT)
3. Start the local server
4. Set environment variables:
   ```bash
   LMSTUDIO_ENABLED=true
   LMSTUDIO_BASE_URL=http://localhost:1234
   LMSTUDIO_MODEL=microsoft/DialoGPT-medium
   ```

**Advantages:**
- User-friendly GUI
- Easy model management
- Good for development and testing

### 3. OpenRouter (Cloud API)

**Setup:**
1. Sign up at https://openrouter.ai/
2. Get your API key
3. Set environment variables:
   ```bash
   OPENROUTER_API_KEY=your-api-key-here
   OPENROUTER_MODEL=microsoft/wizardlm-2-8x22b
   ```

**Advantages:**
- Access to state-of-the-art models
- No local hardware requirements
- Automatic scaling

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure your preferred LLM provider:

```bash
# Enable your preferred provider(s)
OLLAMA_ENABLED=true
LMSTUDIO_ENABLED=false
OPENROUTER_API_KEY=your-key-here
```

### Provider Priority

The system automatically selects providers in this order:
1. Ollama (if enabled and available)
2. LMStudio (if enabled and available)
3. OpenRouter (if API key provided)

### Health Monitoring

The system continuously monitors provider health and automatically fails over to available alternatives.

## API Endpoints

### Health Check
```bash
GET /api/v1/llm/health
```

### Test Provider
```bash
POST /api/v1/llm/test/ollama
POST /api/v1/llm/test/lmstudio
POST /api/v1/llm/test/openrouter
```

### Test Classification
```bash
POST /api/v1/llm/test/classification
```

## Grant Classification Process

### 1. Two-Stage Matching

The system uses a sophisticated two-stage approach:

**Stage 1: Rule-Based Filtering**
- Fast SQL queries eliminate obviously ineligible grants
- Filters by disability rating, geography, service era, etc.
- Reduces candidate set from hundreds to dozens

**Stage 2: LLM Classification**
- Handles complex, nuanced eligibility criteria
- Analyzes natural language requirements
- Provides confidence scores and reasoning

### 2. Prompt Engineering

The system uses carefully crafted prompts for consistent results:

```
TASK: Determine if this veteran is eligible for the specified grant.

VETERAN PROFILE:
- Disability Rating: 100% (P&T)
- Location: Harris, TX
- [Additional profile data...]

GRANT INFORMATION:
- Grant Name: Emergency Financial Assistance
- [Grant criteria...]

INSTRUCTIONS:
Analyze and respond with:
CLASSIFICATION: [eligible/ineligible/maybe]
CONFIDENCE: [0.0-1.0]
REASON: [Brief explanation]
```

### 3. Fallback Strategy

If LLM classification fails, the system falls back to advanced pattern matching to ensure reliability.

## Performance Optimization

### Model Selection

**For Local Deployment:**
- **Ollama**: llama3.2:3b (fast, efficient)
- **LMStudio**: Any 7B parameter model or smaller

**For Cloud Deployment:**
- **OpenRouter**: microsoft/wizardlm-2-8x22b (excellent reasoning)

### Caching Strategy

- LLM responses are cached to avoid redundant API calls
- Cache keys include veteran profile hash and grant criteria
- Configurable TTL (default: 24 hours)

### Rate Limiting

- Built-in rate limiting prevents API quota exhaustion
- Automatic backoff and retry logic
- Health checks prevent requests to unavailable providers

## Monitoring and Debugging

### Logs

All LLM interactions are logged with:
- Provider used
- Response time
- Classification result
- Confidence score
- Any errors

### Metrics

Track key metrics:
- Classification accuracy
- Response times by provider
- Provider availability
- API usage costs

### Debug Mode

Enable verbose logging:
```bash
DEBUG_MODE=true
VERBOSE_LOGGING=true
```

## Security Considerations

### Data Privacy

- **Local providers (Ollama/LMStudio)**: Complete data privacy
- **Cloud providers (OpenRouter)**: Data sent to third-party APIs
- All veteran data is anonymized in prompts when possible

### API Key Security

- Store API keys in environment variables
- Never commit keys to version control
- Use different keys for development/production

### Input Validation

- All inputs are sanitized before sending to LLMs
- Maximum token limits prevent abuse
- Timeout protection prevents hanging requests

## Troubleshooting

### Common Issues

**Ollama not responding:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
ollama serve
```

**LMStudio connection failed:**
- Ensure LMStudio server is started
- Check port configuration (default: 1234)
- Verify model is loaded

**OpenRouter API errors:**
- Verify API key is correct
- Check account credits/limits
- Review rate limiting

### Health Check Endpoint

Use the health check to diagnose issues:
```bash
curl http://localhost:3001/api/v1/llm/health
```

## Development

### Testing

Run the test suite:
```bash
npm run test:llm
```

### Adding New Providers

1. Add provider configuration to `llmConfigService.ts`
2. Implement health check logic
3. Add API endpoint tests
4. Update documentation

## Production Deployment

### Recommended Setup

**High-Traffic Production:**
- Primary: Ollama with GPU acceleration
- Fallback: OpenRouter for overflow

**Low-Traffic Production:**
- Primary: OpenRouter
- Fallback: Pattern matching

### Scaling Considerations

- Use load balancers for multiple Ollama instances
- Implement request queuing for high loads
- Monitor API costs and usage patterns

## Support

For issues with LLM integration:
1. Check the health endpoint
2. Review application logs
3. Test individual providers
4. Consult provider documentation

## Future Enhancements

- Custom model fine-tuning for grant classification
- Multi-model ensemble predictions
- Real-time model performance monitoring
- Automated model updates and deployment
