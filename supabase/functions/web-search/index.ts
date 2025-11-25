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
    
    // Try multiple search strategies
    try {
      // Strategy 1: Use Google Custom Search API via RapidAPI (best quality)
      const googleUrl = `https://google-search74.p.rapidapi.com/?query=${encodeURIComponent(query)}&limit=10&related_keywords=true`;
      const googleResponse = await fetch(googleUrl, {
        headers: {
          'X-RapidAPI-Key': Deno.env.get('RAPIDAPI_KEY') || '',
          'X-RapidAPI-Host': 'google-search74.p.rapidapi.com'
        }
      }).catch(() => null);
      
      if (googleResponse?.ok) {
        const data = await googleResponse.json();
        if (data.results && Array.isArray(data.results)) {
          results = data.results.slice(0, 8).map((r: any) => ({
            title: r.title || '',
            url: r.url || '',
            snippet: r.description || ''
          }));
          console.log(`✅ Google search returned ${results.length} results`);
        }
      }
    } catch (error) {
      console.error('Google search failed:', error);
    }
    
    // Strategy 2: Fallback to DuckDuckGo Instant Answer API
    if (results.length === 0) {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const ddgResponse = await fetch(ddgUrl);
        
        if (ddgResponse.ok) {
          const data = await ddgResponse.json();
          
          // Extract instant answer if available
          if (data.Abstract) {
            results.push({
              title: data.Heading || query,
              url: data.AbstractURL || 'https://duckduckgo.com',
              snippet: data.Abstract
            });
          }
          
          // Add related topics
          if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, 7)) {
              if (topic.FirstURL && topic.Text) {
                results.push({
                  title: topic.Text.split(' - ')[0] || topic.Text,
                  url: topic.FirstURL,
                  snippet: topic.Text
                });
              }
            }
          }
          
          console.log(`✅ DuckDuckGo API returned ${results.length} results`);
        }
      } catch (error) {
        console.error('DuckDuckGo API failed:', error);
      }
    }
    
    // Strategy 3: Fallback to Wikipedia search
    if (results.length === 0) {
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json`;
        const wikiResponse = await fetch(wikiUrl);
        
        if (wikiResponse.ok) {
          const data = await wikiResponse.json();
          if (Array.isArray(data) && data.length >= 4) {
            const titles = data[1];
            const descriptions = data[2];
            const urls = data[3];
            
            for (let i = 0; i < titles.length && i < urls.length; i++) {
              results.push({
                title: titles[i],
                url: urls[i],
                snippet: descriptions[i] || 'Wikipedia article'
              });
            }
          }
          
          console.log(`✅ Wikipedia search returned ${results.length} results`);
        }
      } catch (error) {
        console.error('Wikipedia search failed:', error);
      }
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
