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
    
    // Parse results using improved regex patterns
    const results: any[] = [];
    
    // More flexible regex patterns to match DuckDuckGo's HTML structure
    const resultBlocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>[\s\S]*?<\/div>/g) || [];
    
    const maxResults = 5;
    
    for (let i = 0; i < Math.min(resultBlocks.length, maxResults); i++) {
      const block = resultBlocks[i];
      
      // Extract URL
      const urlMatch = block.match(/href="([^"]+)"/);
      const url = urlMatch ? decodeURIComponent(urlMatch[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0]) : '';
      
      // Extract title
      const titleMatch = block.match(/class="result__a"[^>]*>(.*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'No title';
      
      // Extract snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>(.*?)<\/a>/);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : 'No description available';
      
      if (url && title) {
        results.push({ title, url, snippet });
      }
    }
    
    // If no results found, try alternative API approach
    if (results.length === 0) {
      console.log('⚠️ HTML parsing failed, trying API approach...');
      
      // Use DuckDuckGo Instant Answer API as fallback
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const apiResponse = await fetch(apiUrl);
      const apiData = await apiResponse.json();
      
      // Extract related topics as results
      const relatedTopics = apiData.RelatedTopics || [];
      for (let i = 0; i < Math.min(relatedTopics.length, maxResults); i++) {
        const topic = relatedTopics[i];
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      }
    }
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

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
