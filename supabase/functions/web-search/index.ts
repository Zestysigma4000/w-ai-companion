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

    // Add recency filter to query for more current results
    const currentYear = new Date().getFullYear();
    const enhancedQuery = `${query} ${currentYear}`;
    
    // Use DuckDuckGo HTML scraping with recency preference
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(enhancedQuery)}&df=d`; // df=d for recent results
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const html = await response.text();
    
    // Parse results using regex (simple extraction)
    const results: any[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;
    
    let match;
    let count = 0;
    const maxResults = 5;
    
    // Extract titles and URLs
    const titleMatches: any[] = [];
    while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
      const url = match[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      titleMatches.push({ url: decodeURIComponent(url), title });
      count++;
    }
    
    // Extract snippets
    count = 0;
    const snippetMatches: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null && count < maxResults) {
      const snippet = match[1].replace(/<[^>]*>/g, '').trim();
      snippetMatches.push(snippet);
      count++;
    }
    
    // Combine results with current date context
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    for (let i = 0; i < Math.min(titleMatches.length, maxResults); i++) {
      results.push({
        title: titleMatches[i].title,
        url: titleMatches[i].url,
        snippet: snippetMatches[i] || 'No description available'
      });
    }

    console.log(`✅ Found ${results.length} results for current date: ${currentDate}`);

    return new Response(
      JSON.stringify({ 
        results,
        searchDate: new Date().toISOString(),
        query: enhancedQuery
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Search failed' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
