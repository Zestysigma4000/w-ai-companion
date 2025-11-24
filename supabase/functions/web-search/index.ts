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
    
    // Use DuckDuckGo HTML search - actual web results
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const ddgResponse = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      
      if (ddgResponse.ok) {
        const html = await ddgResponse.text();
        
        // Parse HTML results using regex patterns
        const resultRegex = /<div class="result__body">[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        
        let match;
        while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
          const url = match[1].replace(/&amp;/g, '&');
          const title = match[2].replace(/<[^>]*>/g, '').trim();
          const snippet = match[3].replace(/<[^>]*>/g, '').trim();
          
          // Filter out low-quality results
          if (url && url.startsWith('http') && title && snippet && snippet.length > 20) {
            results.push({
              title: title.substring(0, 200),
              url: url,
              snippet: snippet.substring(0, 400)
            });
          }
        }
        
        console.log(`✅ DuckDuckGo HTML search returned ${results.length} results`);
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
