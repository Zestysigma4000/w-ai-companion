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

    // Use multiple search strategies for reliability
    let results: any[] = [];
    const currentYear = new Date().getFullYear();
    
    // Strategy 1: Try SearXNG JSON API (more reliable than scraping)
    try {
      const searxUrl = `https://searx.be/search?q=${encodeURIComponent(query)}&format=json&language=en&time_range=&safesearch=0&categories=general`;
      const searxResponse = await fetch(searxUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (searxResponse.ok) {
        const data = await searxResponse.json();
        if (data.results && Array.isArray(data.results)) {
          results = data.results.slice(0, 8).map((r: any) => ({
            title: r.title || 'No title',
            url: r.url || '',
            snippet: r.content || r.snippet || 'No description available'
          }));
          console.log(`✅ SearXNG found ${results.length} results`);
        }
      }
    } catch (error) {
      console.log('⚠️ SearXNG failed:', error);
    }
    
    // Strategy 2: Fallback to DuckDuckGo Instant Answer API
    if (results.length === 0) {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
        const ddgResponse = await fetch(ddgUrl);
        const ddgData = await ddgResponse.json();
        
        // Extract from RelatedTopics
        if (ddgData.RelatedTopics && Array.isArray(ddgData.RelatedTopics)) {
          for (const topic of ddgData.RelatedTopics.slice(0, 8)) {
            if (topic.FirstURL && topic.Text) {
              results.push({
                title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
                url: topic.FirstURL,
                snippet: topic.Text
              });
            }
          }
        }
        
        // Extract from AbstractSource
        if (results.length === 0 && ddgData.AbstractURL && ddgData.Abstract) {
          results.push({
            title: ddgData.Heading || query,
            url: ddgData.AbstractURL,
            snippet: ddgData.Abstract
          });
        }
        
        console.log(`✅ DuckDuckGo API found ${results.length} results`);
      } catch (error) {
        console.log('⚠️ DuckDuckGo API failed:', error);
      }
    }
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    console.log(`✅ Returning ${results.length} total results for date: ${currentDate}`);

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
