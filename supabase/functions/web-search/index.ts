import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔍 Searching for:', query);

    let results: any[] = [];
    
    // Use DuckDuckGo Instant Answer API - simple and reliable
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
      const ddgResponse = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SearchBot/1.0)',
        }
      });
      
      if (ddgResponse.ok) {
        const data = await ddgResponse.json();
        
        // Extract from Abstract
        if (data.AbstractURL && data.Abstract && data.Abstract.length > 0) {
          results.push({
            title: data.Heading || query,
            url: data.AbstractURL,
            snippet: data.Abstract
          });
        }
        
        // Extract from RelatedTopics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics) {
            if (topic.FirstURL && topic.Text) {
              results.push({
                title: topic.Text.split(' - ')[0]?.substring(0, 150) || 'Result',
                url: topic.FirstURL,
                snippet: topic.Text.substring(0, 300)
              });
            }
            // Handle nested topics
            if (topic.Topics && Array.isArray(topic.Topics)) {
              for (const subTopic of topic.Topics) {
                if (subTopic.FirstURL && subTopic.Text) {
                  results.push({
                    title: subTopic.Text.split(' - ')[0]?.substring(0, 150) || 'Result',
                    url: subTopic.FirstURL,
                    snippet: subTopic.Text.substring(0, 300)
                  });
                }
              }
            }
          }
        }
        
        // Limit to 8 results
        results = results.slice(0, 8);
        
        console.log(`✅ DuckDuckGo API returned ${results.length} results`);
      }
    } catch (error) {
      console.error('❌ Search failed:', error);
    }

    return new Response(
      JSON.stringify({ 
        results,
        searchDate: new Date().toISOString(),
        query: query
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Search failed',
        results: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
