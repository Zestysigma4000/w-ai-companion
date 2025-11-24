import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Piston API endpoint for code execution
const PISTON_API = 'https://emkc.org/api/v2/piston';

// Supported languages and their runtime mappings
const LANGUAGE_RUNTIMES: Record<string, string> = {
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'python': 'python',
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'c++': 'cpp',
  'c': 'c',
  'csharp': 'csharp',
  'c#': 'csharp',
  'go': 'go',
  'rust': 'rust',
  'ruby': 'ruby',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'scala': 'scala',
  'r': 'r',
  'bash': 'bash',
  'shell': 'bash',
  'sh': 'bash',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, language = 'javascript' } = await req.json();
    
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Normalize language name
    const normalizedLang = language.toLowerCase();
    const runtime = LANGUAGE_RUNTIMES[normalizedLang];

    if (!runtime) {
      return new Response(
        JSON.stringify({ 
          error: `Language '${language}' not supported. Supported languages: ${Object.keys(LANGUAGE_RUNTIMES).join(', ')}` 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`⚡ Executing ${runtime} code:`, code.substring(0, 100));

    // Execute code using Piston API
    const response = await fetch(`${PISTON_API}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: runtime,
        version: '*', // Use latest version
        files: [
          {
            content: code
          }
        ],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Piston API error:', response.status, errorText);
      throw new Error('Code execution service unavailable');
    }

    const result = await response.json();
    
    console.log('✅ Execution complete');

    // Format the response
    const output = result.run?.stdout || '';
    const error = result.run?.stderr || result.compile?.stderr || '';
    const exitCode = result.run?.code;

    return new Response(
      JSON.stringify({ 
        success: exitCode === 0,
        output: output || undefined,
        error: error || undefined,
        language: runtime,
        exitCode
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Code execution error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Execution failed' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
