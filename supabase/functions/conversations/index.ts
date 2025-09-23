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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    if (req.method === 'GET') {
      // Get all conversations
      const { data: conversations, error } = await supabaseClient
        .from('conversations')
        .select(`
          *,
          messages(content, role, created_at)
        `)
        .order('updated_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify(conversations),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (req.method === 'POST') {
      // Create new conversation
      const { title } = await req.json()
      
      const { data: conversation, error } = await supabaseClient
        .from('conversations')
        .insert({ title: title || 'New Conversation' })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(conversation),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (req.method === 'DELETE') {
      // Delete conversation
      const url = new URL(req.url)
      const conversationId = url.searchParams.get('id')
      
      if (!conversationId) {
        throw new Error('Conversation ID is required')
      }

      const { error } = await supabaseClient
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    throw new Error('Method not allowed')
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