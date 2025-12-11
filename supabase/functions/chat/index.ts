import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const chatRequestSchema = z.object({
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(200000, 'Message must be less than 200,000 characters'),
  conversationId: z.string().uuid().optional().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    size: z.number()
  })).optional(),
  deepThinkEnabled: z.boolean().optional().default(false),
  forceWebSearch: z.boolean().optional().default(false),
  typingPreview: z.string().optional() // For typing preview feature
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = chatRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validationResult.error.errors 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    const { message, conversationId, attachments = [], deepThinkEnabled, forceWebSearch, typingPreview } = validationResult.data
    
    // Initialize Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Check user role and apply rate limiting for non-owners
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    
    const isOwner = roleData?.role === 'owner'

    // Log activity - Create admin client for logging (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Rate limiting for non-owner users
    if (!isOwner) {
      // Get app settings for rate limits
      const { data: settings } = await supabaseClient
        .from('app_settings')
        .select('key, value')
        .in('key', ['rate_limit_enabled', 'rate_limit_per_hour', 'rate_limit_per_minute'])
      
      const rateLimitEnabled = settings?.find(s => s.key === 'rate_limit_enabled')?.value || true
      const limitPerHour = settings?.find(s => s.key === 'rate_limit_per_hour')?.value || 60
      const limitPerMinute = settings?.find(s => s.key === 'rate_limit_per_minute')?.value || 10

      if (rateLimitEnabled) {
        // Check hourly limit
        const hourAgo = new Date(Date.now() - 3600000).toISOString()
        const { count: hourlyCount } = await supabaseClient
          .from('api_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', hourAgo)

        if (hourlyCount && hourlyCount >= limitPerHour) {
          return new Response(
            JSON.stringify({ 
              error: `Rate limit exceeded. Maximum ${limitPerHour} requests per hour.`,
              retryAfter: 3600 
            }),
            { 
              status: 429,
              headers: { 
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': '3600',
                'X-RateLimit-Limit': limitPerHour.toString(),
                'X-RateLimit-Remaining': '0'
              }
            }
          )
        }

        // Check per-minute limit
        const minuteAgo = new Date(Date.now() - 60000).toISOString()
        const { count: minuteCount } = await supabaseClient
          .from('api_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', minuteAgo)

        if (minuteCount && minuteCount >= limitPerMinute) {
          return new Response(
            JSON.stringify({ 
              error: `Rate limit exceeded. Maximum ${limitPerMinute} requests per minute.`,
              retryAfter: 60 
            }),
            { 
              status: 429,
              headers: { 
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': '60',
                'X-RateLimit-Limit': limitPerMinute.toString(),
                'X-RateLimit-Remaining': '0'
              }
            }
          )
        }

        // Track this request
        await supabaseClient
          .from('api_usage')
          .insert({ user_id: user.id })
      }
    } else {
      console.log('👑 Owner request - bypassing rate limits')
      await adminClient.from('activity_logs').insert({
        event_type: 'owner_request',
        event_data: { message: 'Owner bypassed rate limits' },
        user_id: user.id,
        severity: 'info'
      })
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      const { data, error: convFetchError } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      if (convFetchError || !data) {
        // If a conversation was provided but not found, return an error instead of creating a new one
        return new Response(
          JSON.stringify({ error: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }
      conversation = data
    } else {
      // Generate a smart title from the first message (max 40 chars)
      let title = message.substring(0, 40);
      
      // Try to extract a meaningful title from the message
      const sentences = message.split(/[.!?]/);
      if (sentences.length > 0 && sentences[0].trim().length > 0) {
        title = sentences[0].trim().substring(0, 40);
      }
      
      // If message is a question, keep it as is
      if (message.includes('?')) {
        const question = message.split('?')[0] + '?';
        if (question.length <= 40) {
          title = question;
        } else {
          title = question.substring(0, 37) + '...';
        }
      }
      
      // Add ellipsis if we truncated
      if (message.length > 40 && !title.endsWith('...')) {
        title = title.substring(0, 37) + '...';
      }

      const { data: newConversation, error: convError } = await supabaseClient
        .from('conversations')
        .insert({ 
          title: title,
          user_id: user.id
        })
        .select()
        .single()
      
      if (convError) throw convError
      conversation = newConversation
      
      // Log new conversation
      await adminClient.from('activity_logs').insert({
        event_type: 'conversation_created',
        event_data: { 
          conversation_id: newConversation.id,
          title: title
        },
        user_id: user.id,
        severity: 'success'
      })
    }

    // Save user message with attachments
    const { error: userMessageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: message,
        role: 'user',
        user_id: user.id,
        attachments: attachments
      })

    if (userMessageError) throw userMessageError
    
    // Log message sent
    await adminClient.from('activity_logs').insert({
      event_type: 'message_sent',
      event_data: { 
        conversation_id: conversation.id,
        message_length: message.length,
        attachments_count: attachments.length,
        has_images: attachments.some(a => a.type.startsWith('image/'))
      },
      user_id: user.id,
      severity: 'info'
    })

    // Get conversation history for context (limit to last 20 messages to prevent token overflow)
    const { data: messageHistory } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(20)
    
    // Reverse to get chronological order
    if (messageHistory) {
      messageHistory.reverse();
    }

    // Process attachments for the current message
    const imageContents: any[] = []
    let fileContextText = ''
    
    if (attachments.length > 0) {
      // Add clear header when files are attached
      fileContextText = `\n\n📎 USER UPLOADED ${attachments.length} FILE(S):\n`
      
      for (const attachment of attachments) {
        try {
          // Download the file from storage
          const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('chat-attachments')
            .download(attachment.path)
          
          if (downloadError) {
            console.error(`Error downloading ${attachment.name}:`, downloadError)
            continue
          }

          // Check if it's an image
          if (attachment.type.startsWith('image/')) {
            // Convert to base64
            const arrayBuffer = await fileData.arrayBuffer()
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
              )
            )

            imageContents.push({
              type: 'image_url',
              image_url: {
                url: `data:${attachment.type};base64,${base64}`
              }
            })
            fileContextText += `\n📷 IMAGE: ${attachment.name} (${(attachment.size / 1024).toFixed(1)}KB)\n`
          } 
          // Handle text-based files (text, code, json, etc.)
          else if (
            attachment.type.startsWith('text/') ||
            attachment.type === 'application/json' ||
            attachment.type === 'application/javascript' ||
            attachment.type === 'application/typescript' ||
            attachment.name.match(/\.(txt|md|js|ts|tsx|jsx|py|java|cpp|c|h|css|scss|html|xml|yaml|yml|csv|svg)$/i)
          ) {
            // Read as text
            const textContent = await fileData.text()
            fileContextText += `\n📄 TEXT FILE: ${attachment.name} (${attachment.type})\n--- FILE CONTENTS START ---\n${textContent}\n--- FILE CONTENTS END ---\n`
          }
          // For PDF, Office docs, and archives
          else if (
            attachment.type === 'application/pdf' ||
            attachment.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz)$/i)
          ) {
            fileContextText += `\n📦 DOCUMENT/ARCHIVE: ${attachment.name} (${attachment.type}, ${(attachment.size / 1024).toFixed(1)}KB)\n   Note: This is a binary file. The user has uploaded this file for your reference.\n`
          }
          // For video/audio files
          else if (attachment.type.startsWith('video/') || attachment.type.startsWith('audio/')) {
            fileContextText += `\n🎬 MEDIA FILE: ${attachment.name} (${attachment.type}, ${(attachment.size / 1024).toFixed(1)}KB)\n   Note: This is a media file. The user has uploaded this file for your reference.\n`
          }
          // For other file types
          else {
            fileContextText += `\n📎 FILE: ${attachment.name} (${attachment.type}, ${(attachment.size / 1024).toFixed(1)}KB)\n   Note: This is a binary file. The user has uploaded this file for your reference.\n`
          }
        } catch (err) {
          console.error(`Error processing ${attachment.name}:`, err)
          fileContextText += `\n❌ ERROR reading file: ${attachment.name}\n`
        }
      }
      
      fileContextText += `\n--- END OF UPLOADED FILES ---\n`
    }

    // Prepare messages for AI with agent tools
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Analyze query complexity for dynamic response style
    const isSimpleQuery = message.length < 50 && 
                          !message.includes('explain') && 
                          !message.includes('analyze') &&
                          !message.includes('how') &&
                          !message.includes('why');
    
    const agentToolsDescription = `\n\nAGENT MODE: You have access to these tools:
1. web_search - Search the web for current information
2. execute_code - Execute JavaScript/TypeScript code
${deepThinkEnabled ? '3. deep_think - Use enhanced reasoning for complex problems' : ''}

CRITICAL: To use a tool, you MUST output EXACTLY this XML format with NO variations:
<tool_call>
<tool_name>web_search</tool_name>
<parameters>{"query": "your search query here"}</parameters>
</tool_call>

IMPORTANT FORMAT RULES:
- Use <tool_call> and </tool_call> tags exactly (NOT </call>)
- Put tool name directly inside <tool_name> tags
- Put JSON parameters directly inside <parameters> tags
- Only one tool call per block
- Keep parameters on a single line as valid JSON

Example for web_search:
<tool_call>
<tool_name>web_search</tool_name>
<parameters>{"query": "AI car driving costs 2024"}</parameters>
</tool_call>

After receiving tool results, incorporate them naturally into your response. Do NOT output the raw tool_call syntax to the user.`;
    
    const messages = [
      {
        role: 'system',
        content: `You are W ai, a powerful AI assistant with full capabilities in AGENT MODE.

**CURRENT DATE AND TIME: ${currentDate}**

${deepThinkEnabled ? `**DEEP THINK MODE ENABLED**: You MUST provide exceptionally thorough, step-by-step reasoning for this response. Break down the problem systematically, consider multiple angles, show your thought process explicitly, and provide comprehensive analysis. Take your time to think deeply before responding.` : ''}

${isSimpleQuery && !deepThinkEnabled ? `**RESPONSE STYLE: This is a simple, straightforward question. Provide a BRIEF, DIRECT answer (2-4 sentences max). Be concise and to the point.**` : !deepThinkEnabled ? `**RESPONSE STYLE: This appears to be a complex question. Provide a thorough, detailed response with explanations and context.**` : ''}

You can:
- Write and debug code in any programming language
- Search the web for current information in real-time
- Execute code in 40+ languages
- Create websites, games, and applications
- Solve complex problems and provide detailed explanations
- Analyze images, documents, and code files uploaded by users${agentToolsDescription}

CRITICAL LANGUAGE REQUIREMENT: You MUST respond in English at all times.

IMPORTANT WEB SEARCH GUIDELINES:
- When you receive web search results, YOU MUST analyze and synthesize the information
- DO NOT simply say "no results found" or give vague responses
- Extract key facts from the search results and present them clearly
- If results are unclear or contradictory, acknowledge that and provide the best available information
- Always cite the source type (knowledge graph, answer box, or organic result)
- Be confident and direct with information found in search results
- Current date is ${currentDate} - use this to contextualize temporal information

IMPORTANT FACTUAL ACCURACY GUIDELINES:
- You are speaking on ${currentDate}, so any dates in search results that match this timeframe are CURRENT and REAL
- When making claims about current events, ALWAYS verify information
- Be skeptical of sensational claims  
- If you cannot verify something with confidence, say so explicitly
- Never invent or fabricate information

${deepThinkEnabled ? `**REMEMBER: DEEP THINK MODE is active. Provide thorough, step-by-step analysis.**` : isSimpleQuery ? `**REMEMBER: Keep your response SHORT and SIMPLE for this straightforward question.**` : ''}

Be helpful, autonomous, and proactive in using your tools when needed. But above all, be ACCURATE and acknowledge uncertainty when appropriate.`
      },
      ...(messageHistory || []).map((msg: any) => {
        // Build content array for messages with images
        if (msg.attachments && msg.attachments.length > 0) {
          const content = [{ type: 'text', text: msg.content }]
          // Note: We only include images from the current message, not history
          return { role: msg.role, content: msg.content }
        }
        return {
          role: msg.role,
          content: msg.content
        }
      })
    ]

    // For the latest user message, include file context and images
    if (imageContents.length > 0 || fileContextText) {
      let fullMessage = message
      if (fileContextText) {
        fullMessage = `${message}\n\n${fileContextText}`
      }
      
      if (imageContents.length > 0) {
        messages[messages.length - 1] = {
          role: 'user',
          content: [
            { type: 'text', text: fullMessage },
            ...imageContents
          ]
        }
      } else {
        // Only text files, no images
        messages[messages.length - 1] = {
          role: 'user',
          content: fullMessage
        }
      }
    }

    // Get API key
    const apiKey = Deno.env.get('VITE_OLLAMA_CLOUD_API_KEY')
    
    if (!apiKey) {
      throw new Error('VITE_OLLAMA_CLOUD_API_KEY is not configured')
    }
    
    // Determine which model to use based on whether images are present in CURRENT message
    const hasImages = imageContents.length > 0
    // Note: Only 235b-cloud variant is available for vision on Ollama Cloud
    const modelToUse = hasImages ? 'qwen3-vl:235b-cloud' : 'deepseek-v3.1:671b-cloud'
    
    console.log(`🤖 Model Selection: ${hasImages ? 'VISION' : 'TEXT'} model (${modelToUse})`)
    console.log(`📎 Current message has ${attachments.length} attachments, ${imageContents.length} images`)
    
    // Log model selection
    await adminClient.from('activity_logs').insert({
      event_type: 'model_selected',
      event_data: { 
        model: modelToUse,
        reason: hasImages ? 'Has images' : 'Text only',
        attachments_count: attachments.length,
        images_count: imageContents.length
      },
      user_id: user.id,
      severity: 'info'
    })
    
    // Check if client wants streaming
    const wantsStreaming = body.stream !== false;
    
    // First call - non-streaming to check for tool calls
    const initialResponse = await fetch('https://ollama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: false
      }),
    })

    if (!initialResponse.ok) {
      const errorText = await initialResponse.text()
      console.error('Ollama API error:', initialResponse.status, errorText)
      throw new Error('Failed to get response from AI. Please try again.')
    }

    const initialData = await initialResponse.json()
    let assistantMessage = initialData.choices[0].message.content

    // Agent loop - process tool calls
    let maxIterations = 5;
    let iteration = 0;
    const toolsUsed: string[] = [];
    let firstToolDetails: { type: string; details: string } | null = null;
    
    // Handle forced tools - prepend tool calls when user explicitly enables them
    if (forceWebSearch && !assistantMessage.includes('<tool_call>')) {
      // Escape quotes in message for JSON
      const safeQuery = message.replace(/"/g, '\\"').substring(0, 200);
      assistantMessage = `<tool_call>
<tool_name>web_search</tool_name>
<parameters>{"query": "${safeQuery}"}</parameters>
</tool_call>

` + assistantMessage;
    }
    
    // Handle deep think mode - modify response approach rather than adding a tool call
    // Deep think is handled in the system prompt, not as a separate tool call
    
    while (iteration < maxIterations) {
      // Check for tool calls in response - more flexible regex to handle AI formatting variations
      // Handles: </tool_call>, </call>, missing closing tags, extra whitespace
      const toolCallMatch = assistantMessage.match(/<tool_call>[\s\S]*?<tool_name>([\w_]+)<\/tool_name>[\s\S]*?<parameters>([\s\S]*?)<\/parameters>[\s\S]*?<\/(?:tool_call|call)>/i);
      
      if (!toolCallMatch) {
        // No tool calls, we're done - clean up any malformed tool syntax
        assistantMessage = assistantMessage.replace(/<tool_call>[\s\S]*?<\/(?:tool_call|call)>/gi, '').trim();
        assistantMessage = assistantMessage.replace(/<tool_call>[\s\S]*$/gi, '').trim(); // Handle unclosed tags
        break;
      }
      
      iteration++;
      const toolName = toolCallMatch[1].trim();
      toolsUsed.push(toolName);
      
      let parameters;
      
      console.log(`🔧 Agent using tool: ${toolName}`);
      
      try {
        // Clean up the parameters - handle extra whitespace and newlines
        const paramsStr = toolCallMatch[2].trim().replace(/\s+/g, ' ');
        parameters = JSON.parse(paramsStr);
      } catch (e) {
        console.error('Failed to parse tool parameters:', toolCallMatch[2]);
        // Remove the malformed tool call and continue
        assistantMessage = assistantMessage.replace(toolCallMatch[0], `I tried to search but encountered a formatting error. Let me answer based on my knowledge.`);
        continue;
      }
      
      console.log(`🔧 Agent using tool: ${toolName}`, parameters);
      
      // Capture first tool details for frontend display
      if (!firstToolDetails) {
        if (toolName === 'web_search') {
          firstToolDetails = {
            type: 'search',
            details: `🔍 Searching the web for: "${parameters.query}"`
          };
        } else if (toolName === 'execute_code') {
          const lang = parameters.language || 'javascript';
          firstToolDetails = {
            type: 'code',
            details: `⚙️ Executing ${lang} code`
          };
        } else if (toolName === 'deep_think') {
          firstToolDetails = {
            type: 'think',
            details: `🧠 Deep thinking: ${parameters.problem?.substring(0, 80)}...`
          };
        }
      }
      
      // Log tool usage
      await adminClient.from('activity_logs').insert({
        event_type: 'tool_used',
        event_data: { 
          tool: toolName,
          parameters,
          conversation_id: conversation.id
        },
        user_id: user.id,
        severity: 'info'
      });
      
      let toolResult;
      
      // Execute the tool
      try {
        if (toolName === 'web_search') {
          const searchResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/web-search`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({ query: parameters.query })
            }
          );
          
          if (searchResponse.ok) {
            const { results, searchDate } = await searchResponse.json();
            const searchDateTime = new Date(searchDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            // Format results with better context
            let formattedResults = `Web Search Results (as of ${searchDateTime}) for "${parameters.query}":\n\n`;
            
            if (results && results.length > 0) {
              results.forEach((r: any, i: number) => {
                const sourceType = r.type === 'knowledge_graph' ? '📚 [Knowledge Graph]' : 
                                 r.type === 'answer_box' ? '✅ [Direct Answer]' :
                                 r.type === 'instant_answer' ? '💡 [Instant Answer]' : 
                                 `🔗 [Result ${i + 1}]`;
                formattedResults += `${sourceType} ${r.title}\n`;
                formattedResults += `   URL: ${r.url}\n`;
                formattedResults += `   ${r.snippet}\n\n`;
              });
              
              formattedResults += `\n⚠️ CRITICAL: You have received ${results.length} search results. YOU MUST analyze and synthesize this information into a helpful, direct answer. DO NOT say "no results found" or give vague responses. Extract the key information and present it clearly to the user.`;
            } else {
              formattedResults += `No specific results found. However, you should still attempt to answer based on your training data up to your knowledge cutoff, while acknowledging the search yielded no current results.`;
            }
            
            toolResult = formattedResults;
          } else {
            toolResult = 'Search failed. Please try a different query.';
          }
        } else if (toolName === 'execute_code') {
          const execResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/execute-code`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({ 
                code: parameters.code,
                language: parameters.language || 'javascript'
              })
            }
          );
          
          if (execResponse.ok) {
            const execResult = await execResponse.json();
            if (execResult.success) {
              toolResult = `Code executed successfully (${execResult.language}):\n`;
              if (execResult.output) toolResult += `Output:\n${execResult.output}\n`;
              if (execResult.result) toolResult += `Result: ${execResult.result}`;
            } else {
              toolResult = `Code execution failed:\n${execResult.error}`;
            }
          } else {
            toolResult = 'Code execution failed. Please check your code.';
          }
        } else if (toolName === 'deep_think') {
          // Existing deep think logic would go here
          toolResult = `Deep thinking about: ${parameters.problem}\n[Enhanced reasoning applied]`;
        } else {
          toolResult = `Unknown tool: ${toolName}`;
        }
      } catch (error) {
        console.error(`Tool execution error:`, error);
        toolResult = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      console.log(`✅ Tool result:`, toolResult.substring(0, 100));
      
      // Add tool result to messages and get new response
      messages.push({
        role: 'assistant',
        content: assistantMessage
      });
      
      messages.push({
        role: 'user',
        content: `<tool_result>\n<tool_name>${toolName}</tool_name>\n<result>${toolResult}</result>\n</tool_result>\n\nPlease continue with your response, incorporating the tool results naturally.`
      });
      
      // Get next response from AI
      const nextResponse = await fetch('https://ollama.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        }),
      });
      
      if (!nextResponse.ok) {
        console.error('Failed to get continuation response');
        break;
      }
      
      const nextData = await nextResponse.json();
      assistantMessage = nextData.choices[0].message.content;
    }
    
    if (iteration >= maxIterations) {
      console.log('⚠️ Max tool iterations reached');
    }
    
    console.log(`✅ Response generated using ${modelToUse} (${assistantMessage.length} chars)`)
    console.log(`🔄 Next message will auto-select model based on attachments`)
    
    // Log response generated
    await adminClient.from('activity_logs').insert({
      event_type: 'response_generated',
      event_data: { 
        model: modelToUse,
        response_length: assistantMessage.length,
        conversation_id: conversation.id
      },
      user_id: user.id,
      severity: 'success'
    })

    // Check for tool calls and execute them only if tools are enabled
    if (deepThinkEnabled) {
      const toolCallRegex = /<tool_call>\s*<tool_name>deep_think<\/tool_name>\s*<problem>([\s\S]*?)<\/problem>\s*<\/tool_call>/
      const toolMatch = assistantMessage.match(toolCallRegex)
      
      if (toolMatch) {
        const toolInput = toolMatch[1].trim()
        console.log('Tool call detected: deep_think, Input:', toolInput)
        
        // Enhanced reasoning mode
        const toolResult = `[Deep Thinking Mode]\nAnalyze this problem step by step:\n${toolInput}\n\nBreak down:\n1. Problem understanding\n2. Key constraints\n3. Possible approaches\n4. Best solution\n5. Reasoning`
        
        // Get final response with tool results
        messages.push({
          role: 'assistant',
          content: assistantMessage
        })
        
        messages.push({
          role: 'user',
          content: `Tool result:\n${toolResult}\n\nProvide your final answer using this information.`
        })
        
        const finalResponse = await fetch('https://ollama.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000,
            stream: false
          }),
        })
        
        if (finalResponse.ok) {
          const finalData = await finalResponse.json()
          assistantMessage = finalData.choices[0].message.content
          console.log('Final response with tool:', assistantMessage)
        }
      }
    }

    // Save assistant message
    const { error: assistantMessageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: assistantMessage,
        role: 'assistant',
        user_id: user.id
      })

    if (assistantMessageError) throw assistantMessageError

    // Stream the response if requested
    if (wantsStreaming) {
      // Create a readable stream that sends the message in chunks
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Send metadata first
          const metadata = {
            conversationId: conversation.id,
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            toolDetails: firstToolDetails,
            modelUsed: modelToUse,
            isVisionModel: hasImages
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', ...metadata })}\n\n`));
          
          // Stream the content in chunks (simulate word-by-word for faster perceived response)
          const words = assistantMessage.split(/(\s+)/);
          let buffer = '';
          
          for (let i = 0; i < words.length; i++) {
            buffer += words[i];
            
            // Send every few words or at punctuation for natural flow
            if (buffer.length >= 20 || /[.!?,;:]$/.test(buffer) || i === words.length - 1) {
              const chunk = {
                type: 'content',
                choices: [{ delta: { content: buffer } }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              buffer = '';
              // Small delay for natural streaming feel
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
          
          // Send done signal
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
      });
    }

    // Non-streaming response (fallback)
    return new Response(
      JSON.stringify({
        response: assistantMessage,
        conversationId: conversation.id,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        toolDetails: firstToolDetails,
        modelUsed: modelToUse,
        isVisionModel: hasImages
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Edge function error:', error)
    // Return generic error message to prevent information leakage
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request. Please try again later.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})