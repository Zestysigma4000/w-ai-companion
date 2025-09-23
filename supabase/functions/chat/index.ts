import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, conversationId } = await req.json()
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

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
      const { data: newConversation, error: convError } = await supabaseClient
        .from('conversations')
        .insert({ title: message.substring(0, 50) + '...' })
        .select()
        .single()
      
      if (convError) throw convError
      conversation = newConversation
    }

    // Save user message
    const { error: userMessageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: message,
        role: 'user'
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

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const openaiData = await openaiResponse.json()
    const assistantMessage = openaiData.choices[0].message.content

    // Save assistant message
    const { error: assistantMessageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: assistantMessage,
        role: 'assistant'
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
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})