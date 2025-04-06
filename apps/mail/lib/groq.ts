import { z } from "zod";

export const groqChatCompletionSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      logprobs: z.null(),
      finish_reason: z.string(),
    })
  ),
  usage: z.object({
    queue_time: z.number(),
    prompt_tokens: z.number(),
    prompt_time: z.number(),
    completion_tokens: z.number(),
    completion_time: z.number(),
    total_tokens: z.number(),
    total_time: z.number(),
  }),
  system_fingerprint: z.string(),
  x_groq: z.object({
    id: z.string(),
  }),
});

export const groqEmbeddingSchema = z.object({
  object: z.string(),
  data: z.array(
    z.object({
      object: z.string(),
      embedding: z.array(z.number()),
      index: z.number(),
    })
  ),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number(),
    total_tokens: z.number(),
  }),
});

export type GroqChatCompletion = z.infer<typeof groqChatCompletionSchema>;
export type GroqEmbedding = z.infer<typeof groqEmbeddingSchema>;

// Define available Groq models
export const GROQ_MODELS = {
  LLAMA_8B: 'llama3-8b-8192',
  LLAMA_70B: 'llama3-70b-8192',
  MIXTRAL: 'mixtral-8x7b-32768',
  GEMMA: 'gemma-7b-it'
} as const;

// Map OpenAI models to Groq equivalents
const MODEL_MAPPING: Record<string, string> = {
  'gpt-4o-mini': GROQ_MODELS.LLAMA_8B,
  'gpt-3.5-turbo': GROQ_MODELS.LLAMA_8B,
  'gpt-4': GROQ_MODELS.LLAMA_70B,
  'gpt-4-turbo': GROQ_MODELS.LLAMA_70B
};

/**
 * Creates embeddings for text input
 */
export async function createEmbedding(text: string, model: string = GROQ_MODELS.LLAMA_8B) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API key is not configured');
  }

  if (!text || text.trim() === '') {
    throw new Error('Empty text cannot be embedded');
  }

  try {
    // Make the API request
    const response = await fetch('https://api.groq.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        input: text
      })
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Parse the JSON response
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error(`Failed to parse embedding API response: ${jsonError}`);
    }

    // Validate the response against our schema
    try {
      const validatedData = groqEmbeddingSchema.parse(data);
      
      // Check if we have embedding data
      if (!validatedData.data || validatedData.data.length === 0) {
        throw new Error('No embedding data returned from API');
      }
      
      // Return the embedding
      return validatedData.data[0]?.embedding || [];
    } catch (validationError) {
      throw new Error(`Invalid embedding API response: ${validationError}`);
    }
  } catch (error) {
    console.error('Embedding API error:', error);
    throw error;
  }
}

/**
 * Creates embeddings for multiple text inputs
 */
export async function createEmbeddings(texts: Record<string, string>, model: string = GROQ_MODELS.LLAMA_8B) {
  const embeddings: Record<string, number[]> = {};

  for (const [key, text] of Object.entries(texts)) {
    if (!text || text.trim() === '') continue;
    
    try {
      embeddings[key] = await createEmbedding(text, model);
    } catch (error) {
      console.error(`Error creating embedding for ${key}:`, error);
    }
  }
  
  return embeddings;
}

// Define model type to allow any string (developer's choice)
type CompletionsParams = {
  model: string, // Allow any model string the developer wants to use
  prompt?: string,
  systemPrompt?: string,
  temperature: number,
  max_tokens: number,
  embeddings?: Record<string, number[]>
};

// Define the request body type with proper TypeScript interface
interface GroqRequestBody {
  model: string;
  messages: Array<{role: string; content: string}>;
  temperature: number;
  max_tokens: number;
  // Add any other standard properties here
  [key: string]: any; // Allow additional properties
}

export async function generateCompletions({ 
  model, 
  prompt, 
  systemPrompt, 
  temperature, 
  max_tokens,
  embeddings 
}: CompletionsParams) {
  if (!process.env.GROQ_API_KEY) 
    throw new Error('Groq API Key is missing');

  // Map OpenAI model names to Groq equivalents if needed
  const groqModel = MODEL_MAPPING[model] || model;
  // Ensure we have valid messages
  const messages = [];
  
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  } else if (process.env.AI_SYSTEM_PROMPT) {
    messages.push({
      role: 'system',
      content: process.env.AI_SYSTEM_PROMPT,
    });
  }

  if (prompt && prompt.trim() !== '') {
    messages.push({ 
      role: 'user', 
      content: prompt 
    });
  } else {
    // If no prompt is provided, add a minimal prompt to avoid API errors
    messages.push({
      role: 'user',
      content: 'Please respond to this request.'
    });
  }

  // Prepare the request body with the correct type
  const requestBody: GroqRequestBody = {
    model: groqModel,
    messages,
    temperature,
    max_tokens,
  };

  // Add embeddings if provided
  if (embeddings && Object.keys(embeddings).length > 0) {
    (requestBody as any).user_context = {
      embeddings
    };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GROQ API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    try {
      const validatedData = groqChatCompletionSchema.parse(data);
      const content = validatedData.choices[0]?.message.content || '';
      
      // Only apply email-specific cleanup if the system prompt suggests email generation
      const isEmailGeneration = systemPrompt?.toLowerCase().includes('email') || false;
      const finalContent = isEmailGeneration ? cleanupEmailContent(content) : content;
      
      return { completion: finalContent };
    } catch (validationError) {
      // Fall back to using the raw response if validation fails
      const content = data.choices[0]?.message.content || '';
      const isEmailGeneration = systemPrompt?.toLowerCase().includes('email') || false;
      const finalContent = isEmailGeneration ? cleanupEmailContent(content) : content;
      
      return { completion: finalContent };
    }
  } catch (error) {
    console.error('Groq API Call Error:', error);
    throw error;
  }
}

/**
 * Helper function to truncate email thread content to fit within token limits
 */
export function truncateThreadContent(threadContent: string, maxTokens: number = 12000): string {
  const emails = threadContent.split('\n---\n');
  let truncatedContent = emails[emails.length - 1];

  for (let i = emails.length - 2; i >= 0; i--) {
    const newContent = `${emails[i]}\n---\n${truncatedContent}`;
    const estimatedTokens = newContent.length / 4;

    if (estimatedTokens > maxTokens) {
      break;
    }

    truncatedContent = newContent;
  }

  return truncatedContent ?? '';
}

// Function to clean up AI-generated email content
export function cleanupEmailContent(content: string): string {
  // Remove various forms of meta-text at the beginning
  let cleanedContent = content
    // Remove "Here is the email:" and variations
    .replace(/^(Here is|Here's|Below is|Following is|This is|Attached is)( the| an| a)? (email|message|response|reply|draft):?.*?(\n|$)/i, '')
    
    // Remove any "Subject:" lines
    .replace(/^Subject:.*?(\n|$)/i, '')
    
    // Remove any "Here's a draft..." or similar meta-text
    .replace(/^Here's (a|an|the) (draft|template|example|email).*?(\n|$)/i, '')
    
    // Remove any explanatory text at the beginning
    .replace(/^I've (created|written|prepared|drafted|composed).*?(\n|$)/i, '')
    .replace(/^I (created|wrote|prepared|drafted|composed).*?(\n|$)/i, '')
    .replace(/^As (requested|instructed|asked).*?(\n|$)/i, '')
    .replace(/^Based on (your|the) (request|instructions).*?(\n|$)/i, '')
    
    // Remove any trailing instructions or explanations
    .replace(/\n\nFeel free to.*$/i, '')
    .replace(/\n\nLet me know if.*$/i, '')
    .replace(/\n\nPlease (let me know|feel free).*$/i, '')
    .replace(/\n\nHope this (helps|works).*$/i, '')
    .replace(/\n\nIs there anything else.*$/i, '')
    
    // Remove placeholder text in brackets
    .replace(/\[.*?\]/g, '');
  
  // Trim whitespace
  cleanedContent = cleanedContent.trim();
  
  return cleanedContent;
}
