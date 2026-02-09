import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface AIRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface AIResponse {
  content: string;
  usage: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  provider: string;
}

export interface AIProvider {
  name: string;
  generate(request: AIRequest): Promise<AIResponse>;
  generateStream(request: AIRequest): AsyncGenerator<string>;
  estimateCost(usage: AIResponse['usage']): number;
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  name = 'openai';

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      response_format: request.jsonMode ? { type: 'json_object' } : undefined,
    });

    return {
      content: response.choices[0].message.content || '',
      usage: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
      model: response.model,
      provider: this.name,
    };
  }

  async *generateStream(request: AIRequest): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  estimateCost(usage: AIResponse['usage']): number {
    // GPT-4.1-mini: $0.40/MTok input, $1.60/MTok output
    const inputCost = (usage.input / 1_000_000) * 0.40;
    const outputCost = (usage.output / 1_000_000) * 1.60;
    return inputCost + outputCost;
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  name = 'anthropic';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature,
      messages: request.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';

    return {
      content: textContent,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      provider: this.name,
    };
  }

  async *generateStream(request: AIRequest): AsyncGenerator<string> {
    const stream = await this.client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature,
      messages: request.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as any;
        if (delta.type === 'text_delta') {
          yield delta.text;
        }
      }
    }
  }

  estimateCost(usage: AIResponse['usage']): number {
    // Claude Haiku: $1.00/MTok input, $5.00/MTok output
    const inputCost = (usage.input / 1_000_000) * 1.00;
    const outputCost = (usage.output / 1_000_000) * 5.00;
    return inputCost + outputCost;
  }
}

export class AIRouter {
  private providers: Map<string, AIProvider>;
  private prisma: unknown;

  constructor(config: { openai: string; anthropic: string }, prisma: unknown) {
    this.providers = new Map<string, AIProvider>([
      ['openai', new OpenAIProvider(config.openai)],
      ['anthropic', new AnthropicProvider(config.anthropic)],
    ]);
    this.prisma = prisma;
  }

  async generate(
    useCase: 'chat' | 'devotional' | 'onboarding' | 'reading',
    request: AIRequest
  ): Promise<AIResponse> {
    const provider = this.selectProvider(useCase);
    
    try {
      const response = await provider.generate(request);
      await this.logUsage(useCase, response, false);
      return response;
    } catch (error) {
      console.error(`Provider ${provider.name} failed:`, error);
      
      // Try fallback
      const fallback = this.getFallbackProvider(provider.name);
      if (fallback) {
        console.log(`Trying fallback: ${fallback.name}`);
        const response = await fallback.generate(request);
        await this.logUsage(useCase, response, true);
        return response;
      }
      
      throw error;
    }
  }

  async *generateStream(
    useCase: 'chat' | 'devotional' | 'onboarding' | 'reading',
    request: AIRequest
  ): AsyncGenerator<string> {
    const provider = this.selectProvider(useCase);
    
    try {
      yield* provider.generateStream(request);
    } catch (error) {
      console.error(`Provider ${provider.name} failed:`, error);
      
      const fallback = this.getFallbackProvider(provider.name);
      if (fallback) {
        yield* fallback.generateStream(request);
      } else {
        throw error;
      }
    }
  }

  private selectProvider(useCase: string): AIProvider {
    const routing: Record<string, string> = {
      chat: 'openai',
      devotional: 'openai',
      onboarding: 'anthropic',
      reading: 'openai',
    };

    const providerName = routing[useCase] || 'openai';
    return this.providers.get(providerName)!;
  }

  private getFallbackProvider(current: string): AIProvider | null {
    const fallbackOrder = ['anthropic', 'openai'];
    const fallback = fallbackOrder.find(p => p !== current);
    return fallback ? this.providers.get(fallback) || null : null;
  }

  private async logUsage(
    useCase: string,
    response: AIResponse,
    isFallback: boolean
  ): Promise<void> {
    const provider = this.providers.get(response.provider);
    const cost = provider?.estimateCost(response.usage) || 0;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prisma as any).aIUsageLog.create({
      data: {
        provider: response.provider,
        model: response.model,
        tokensInput: response.usage.input,
        tokensOutput: response.usage.output,
        costUsd: cost,
        endpoint: useCase,
      },
    });
  }
}
