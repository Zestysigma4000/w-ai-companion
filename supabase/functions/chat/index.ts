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
      const { data } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      conversation = data
    }
    
    if (!conversation) {
      // Generate a smart title from the first message
      let title = message.substring(0, 50);
      
      // Try to extract a meaningful title from the message
      const sentences = message.split(/[.!?]/);
      if (sentences.length > 0 && sentences[0].trim().length > 0) {
        title = sentences[0].trim().substring(0, 60);
      }
      
      // If message is a question, keep it as is
      if (message.includes('?')) {
        const question = message.split('?')[0] + '?';
        if (question.length <= 60) {
          title = question;
        }
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

    // Prepare messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are W ai, a powerful AI assistant with full capabilities. You can help with:
- Writing and debugging code in any programming language
- Creating websites, games, and applications
- Solving complex problems and providing detailed explanations
- File management and project organization
- Architecture and design decisions

You are helpful, knowledgeable, and can handle any coding or technical challenge. Always provide practical, working solutions.`
      },
      ...(messageHistory || []).slice(-10).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))
    ]

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
    const assistantMessage = ollamaData.choices[0].message.content

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