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
    
    // Strategy 1: Serper API (Google search quality)
    try {
      const serperKey = Deno.env.get('SERPER_API_KEY');
      if (serperKey) {
        const serperResponse = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: 10
          })
        });
        
        if (serperResponse.ok) {
          const data = await serperResponse.json();
          
          // Add knowledge graph if available (instant answer)
          if (data.knowledgeGraph) {
            const kg = data.knowledgeGraph;
            results.push({
              title: kg.title || query,
              url: kg.website || kg.descriptionLink || 'https://google.com',
              snippet: kg.description || '',
              type: 'knowledge_graph'
            });
          }
          
          // Add answer box if available
          if (data.answerBox) {
            const ab = data.answerBox;
            results.push({
              title: ab.title || 'Direct Answer',
              url: ab.link || 'https://google.com',
              snippet: ab.snippet || ab.answer || '',
              type: 'answer_box'
            });
          }
          
          // Add organic results
          if (data.organic && Array.isArray(data.organic)) {
            results.push(...data.organic.slice(0, 8).map((r: any) => ({
              title: r.title || '',
              url: r.link || '',
              snippet: r.snippet || '',
              type: 'organic'
            })));
          }
          
          console.log(`✅ Serper API returned ${results.length} results`);
        }
      }
    } catch (error) {
      console.error('Serper API failed:', error);
    }
    
    // Strategy 2: Fallback to DuckDuckGo Instant Answer
    if (results.length === 0) {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const ddgResponse = await fetch(ddgUrl);
        
        if (ddgResponse.ok) {
          const data = await ddgResponse.json();
          
          if (data.Abstract) {
            results.push({
              title: data.Heading || query,
              url: data.AbstractURL || 'https://duckduckgo.com',
              snippet: data.Abstract,
              type: 'instant_answer'
            });
          }
          
          if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, 7)) {
              if (topic.FirstURL && topic.Text) {
                results.push({
                  title: topic.Text.split(' - ')[0] || topic.Text,
                  url: topic.FirstURL,
                  snippet: topic.Text,
                  type: 'related'
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
    
    // Strategy 3: Final fallback to Wikipedia
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
                snippet: descriptions[i] || 'Wikipedia article',
                type: 'wikipedia'
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
