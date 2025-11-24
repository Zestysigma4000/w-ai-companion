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
    
    // Try multiple search strategies for better results
    let results: any[] = [];
    const maxResults = 8;
    
    // Strategy 1: Use DuckDuckGo Lite (simpler HTML, easier to parse)
    try {
      const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(enhancedQuery)}`;
      const liteResponse = await fetch(liteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (liteResponse.ok) {
        const html = await liteResponse.text();
        
        // Parse lite version - simpler structure
        const linkMatches = html.matchAll(/<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g);
        const snippetMatches = html.matchAll(/<td class="result-snippet"[^>]*>(.*?)<\/td>/gs);
        
        const links = Array.from(linkMatches);
        const snippets = Array.from(snippetMatches);
        
        for (let i = 0; i < Math.min(links.length, snippets.length, maxResults); i++) {
          const url = links[i][1];
          const title = links[i][2].replace(/<[^>]*>/g, '').trim();
          const snippet = snippets[i][1].replace(/<[^>]*>/g, '').trim();
          
          // Filter out low-quality results
          if (url && 
              title && 
              title.length > 5 && 
              !url.includes('duckduckgo.com') &&
              !title.toLowerCase().includes('more results') &&
              snippet.length > 10) {
            results.push({ 
              title: title.substring(0, 200), 
              url, 
              snippet: snippet.substring(0, 300) 
            });
          }
        }
        
        console.log(`✅ Lite search found ${results.length} results`);
      }
    } catch (error) {
      console.log('⚠️ Lite search failed:', error);
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
