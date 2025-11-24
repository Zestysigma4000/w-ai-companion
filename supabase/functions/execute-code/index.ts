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
    const { code, language } = await req.json();
    
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('⚡ Executing code:', code.substring(0, 100));

    // Only support JavaScript/TypeScript for safety
    if (language && !['javascript', 'typescript', 'js', 'ts'].includes(language.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          error: `Language '${language}' not supported. Only JavaScript/TypeScript is supported.` 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Security checks - block dangerous operations
    const dangerousPatterns = [
      /Deno\.(run|Command|execPath|exit|kill)/,
      /require\s*\(/,
      /import\s+.*from\s+['"](?!https:\/\/)/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /child_process/,
      /fs\./,
      /__dirname/,
      /__filename/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return new Response(
          JSON.stringify({ 
            error: 'Code contains forbidden operations (file system, process execution, or unsafe eval)' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Capture console output
    const logs: string[] = [];
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    console.log = (...args: any[]) => logs.push(args.map(a => String(a)).join(' '));
    console.error = (...args: any[]) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' '));
    console.warn = (...args: any[]) => logs.push('[WARN] ' + args.map(a => String(a)).join(' '));
    console.info = (...args: any[]) => logs.push('[INFO] ' + args.map(a => String(a)).join(' '));

    let result;
    let error;

    try {
      // Wrap code in async function to support await
      const wrappedCode = `(async () => { ${code} })()`;
      
      // Execute with timeout (5 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout (5s)')), 5000)
      );
      
      const executionPromise = eval(wrappedCode);
      result = await Promise.race([executionPromise, timeoutPromise]);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error('Execution error:', error);
    } finally {
      // Restore console
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    }

    const output = logs.join('\n');
    
    console.log('✅ Execution complete');

    return new Response(
      JSON.stringify({ 
        success: !error,
        result: result !== undefined ? String(result) : undefined,
        output: output || undefined,
        error: error || undefined
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
