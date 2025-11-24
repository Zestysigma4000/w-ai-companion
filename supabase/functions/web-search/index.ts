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
    
    let results: any[] = [];
    const maxResults = 8;
    
    // Use Google Custom Search API approach via DuckDuckGo
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(enhancedQuery)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://duckduckgo.com/'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Multiple parsing strategies for reliability
        
        // Strategy 1: Standard result blocks
        const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        const blocks = Array.from(html.matchAll(resultRegex));
        
        for (const block of blocks.slice(0, maxResults * 2)) {
          const blockHtml = block[1];
          
          // Extract title and URL
          const titleMatch = blockHtml.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/i);
          if (!titleMatch) continue;
          
          let url = titleMatch[1];
          const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
          
          // Clean up DuckDuckGo redirect URLs
          if (url.includes('duckduckgo.com/l/')) {
            const uddgMatch = url.match(/uddg=([^&]+)/);
            if (uddgMatch) {
              url = decodeURIComponent(uddgMatch[1]);
            }
          }
          
          // Extract snippet
          const snippetMatch = blockHtml.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/i);
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
          
          // Quality filters
          if (url && 
              title && 
              title.length > 3 &&
              !url.includes('duckduckgo.com') &&
              !title.toLowerCase().includes('more results') &&
              snippet.length > 5) {
            
            // Check for duplicates
            if (!results.some(r => r.url === url)) {
              results.push({
                title: title.substring(0, 200),
                url: url,
                snippet: snippet.substring(0, 400)
              });
            }
          }
          
          if (results.length >= maxResults) break;
        }
        
        console.log(`✅ Found ${results.length} quality results`);
      }
    } catch (error) {
      console.log('⚠️ Primary search failed:', error);
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
