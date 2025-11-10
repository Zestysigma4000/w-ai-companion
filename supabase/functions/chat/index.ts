import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const chatRequestSchema = z.object({
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must be less than 4000 characters'),
  conversationId: z.string().uuid().optional().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    size: z.number()
  })).optional()
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = chatRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validationResult.error.errors 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    const { message, conversationId, attachments = [] } = validationResult.data
    
    // Initialize Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      const { data, error: convFetchError } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      if (convFetchError || !data) {
        // If a conversation was provided but not found, return an error instead of creating a new one
        return new Response(
          JSON.stringify({ error: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }
      conversation = data
    } else {
      // Generate a smart title from the first message (max 40 chars)
      let title = message.substring(0, 40);
      
      // Try to extract a meaningful title from the message
      const sentences = message.split(/[.!?]/);
      if (sentences.length > 0 && sentences[0].trim().length > 0) {
        title = sentences[0].trim().substring(0, 40);
      }
      
      // If message is a question, keep it as is
      if (message.includes('?')) {
        const question = message.split('?')[0] + '?';
        if (question.length <= 40) {
          title = question;
        } else {
          title = question.substring(0, 37) + '...';
        }
      }
      
      // Add ellipsis if we truncated
      if (message.length > 40 && !title.endsWith('...')) {
        title = title.substring(0, 37) + '...';
      }

      const { data: newConversation, error: convError } = await supabaseClient
        .from('conversations')
        .insert({ 
          title: title,
          user_id: user.id
        })
        .select()
        .single()
      
      if (convError) throw convError
      conversation = newConversation
    }

    // Save user message with attachments
    const { error: userMessageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: message,
        role: 'user',
        user_id: user.id,
        attachments: attachments
      })

    if (userMessageError) throw userMessageError

    // Get conversation history for context
    const { data: messageHistory } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    // Process attachments for the current message
    const imageContents: any[] = []
    let fileContextText = ''
    
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          // Download the file from storage
          const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('chat-attachments')
            .download(attachment.path)
          
          if (downloadError) {
            console.error(`Error downloading ${attachment.name}:`, downloadError)
            continue
          }

          // Check if it's an image
          if (attachment.type.startsWith('image/')) {
            // Convert to base64
            const arrayBuffer = await fileData.arrayBuffer()
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
              )
            )

            imageContents.push({
              type: 'image_url',
              image_url: {
                url: `data:${attachment.type};base64,${base64}`
              }
            })
          } 
          // Handle text-based files (text, code, json, etc.)
          else if (
            attachment.type.startsWith('text/') ||
            attachment.type === 'application/json' ||
            attachment.type === 'application/javascript' ||
            attachment.type === 'application/typescript' ||
            attachment.name.match(/\.(txt|md|js|ts|tsx|jsx|py|java|cpp|c|h|css|html|xml|yaml|yml|json|csv)$/i)
          ) {
            // Read as text
            const textContent = await fileData.text()
            fileContextText += `\n\n--- File: ${attachment.name} (${attachment.type}) ---\n${textContent}\n--- End of ${attachment.name} ---\n`
          }
          // For other file types, just mention them
          else {
            fileContextText += `\n[File attached: ${attachment.name} (${attachment.type}, ${(attachment.size / 1024).toFixed(1)}KB) - binary file]`
          }
        } catch (err) {
          console.error(`Error processing ${attachment.name}:`, err)
          fileContextText += `\n[Error reading file: ${attachment.name}]`
        }
      }
    }

    // Prepare messages for AI
    const messages = [
      {
        role: 'system',
        content: `You are W ai, a powerful AI assistant with full capabilities. You can help with:
- Writing and debugging code in any programming language
- Creating websites, games, and applications
- Solving complex problems and providing detailed explanations
- File management and project organization
- Architecture and design decisions
- Analyzing images and documents

You have access to two special tools:
1. web_search - Search the web for current information you don't have
2. deep_think - Use enhanced reasoning for complex problems

When you need to use a tool, respond with EXACTLY this format:
<tool_call>
<tool_name>web_search</tool_name>
<query>search query</query>
</tool_call>

OR

<tool_call>
<tool_name>deep_think</tool_name>
<problem>problem description</problem>
</tool_call>

After receiving tool results, incorporate them naturally into your response. Be helpful and provide practical, working solutions.`
      },
      ...(messageHistory || []).slice(-10).map((msg: any) => {
        // Build content array for messages with images
        if (msg.attachments && msg.attachments.length > 0) {
          const content = [{ type: 'text', text: msg.content }]
          // Note: We only include images from the current message, not history
          return { role: msg.role, content: msg.content }
        }
        return {
          role: msg.role,
          content: msg.content
        }
      })
    ]

    // For the latest user message, include file context and images
    if (imageContents.length > 0 || fileContextText) {
      let fullMessage = message
      if (fileContextText) {
        fullMessage = `${message}\n\n${fileContextText}`
      }
      
      if (imageContents.length > 0) {
        messages[messages.length - 1] = {
          role: 'user',
          content: [
            { type: 'text', text: fullMessage },
            ...imageContents
          ]
        }
      } else {
        // Only text files, no images
        messages[messages.length - 1] = {
          role: 'user',
          content: fullMessage
        }
      }
    }

    // Get API key
    const apiKey = Deno.env.get('VITE_OLLAMA_CLOUD_API_KEY')
    
    if (!apiKey) {
      throw new Error('VITE_OLLAMA_CLOUD_API_KEY is not configured')
    }
    
    // Call Ollama Cloud API using OpenAI-compatible endpoint
    const ollamaResponse = await fetch('https://ollama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v3.1:671b-cloud',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }),
    })

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text()
      console.error('Ollama API error:', ollamaResponse.status, errorText)
      throw new Error('Failed to get response from AI. Please try again.')
    }

    const ollamaData = await ollamaResponse.json()
    let assistantMessage = ollamaData.choices[0].message.content

    // Check for tool calls and execute them
    const toolCallRegex = /<tool_call>\s*<tool_name>(web_search|deep_think)<\/tool_name>\s*(?:<query>([\s\S]*?)<\/query>|<problem>([\s\S]*?)<\/problem>)\s*<\/tool_call>/
    const toolMatch = assistantMessage.match(toolCallRegex)
    
    if (toolMatch) {
      const toolName = toolMatch[1]
      const toolInput = (toolMatch[2] || toolMatch[3]).trim()
      
      console.log('Tool call detected:', toolName, 'Input:', toolInput)
      
      let toolResult = ''
      
      if (toolName === 'web_search') {
        // Perform web search
        try {
          const searchResponse = await fetch('https://api.lovable.app/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: toolInput,
              numResults: 5
            })
          })
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            toolResult = `Web search results for "${toolInput}":\n\n${searchData.results.map((r: any, i: number) => 
              `${i + 1}. ${r.title}\n${r.description}\nSource: ${r.url}\n`
            ).join('\n')}`
          } else {
            toolResult = 'Web search temporarily unavailable.'
          }
        } catch (e) {
          console.error('Web search error:', e)
          toolResult = 'Web search encountered an error.'
        }
      } else if (toolName === 'deep_think') {
        // Enhanced reasoning mode
        toolResult = `[Deep Thinking Mode]\nAnalyze this problem step by step:\n${toolInput}\n\nBreak down:\n1. Problem understanding\n2. Key constraints\n3. Possible approaches\n4. Best solution\n5. Reasoning`
      }
      
      // Get final response with tool results
      messages.push({
        role: 'assistant',
        content: assistantMessage
      })
      
      messages.push({
        role: 'user',
        content: `Tool result:\n${toolResult}\n\nProvide your final answer using this information.`
      })
      
      const finalResponse = await fetch('https://ollama.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v3.1:671b-cloud',
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        }),
      })
      
      if (finalResponse.ok) {
        const finalData = await finalResponse.json()
        assistantMessage = finalData.choices[0].message.content
        console.log('Final response with tool:', assistantMessage)
      }
    }

    // Save assistant message
    const { error: assistantMessageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: assistantMessage,
        role: 'assistant',
        user_id: user.id
      })

    if (assistantMessageError) throw assistantMessageError

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        conversationId: conversation.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Edge function error:', error)
    // Return generic error message to prevent information leakage
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request. Please try again later.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})