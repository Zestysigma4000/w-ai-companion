import { Brain, Search, Code, Sparkles } from "lucide-react";

interface AgentThinkingAnimationProps {
  status: string | null;
}

export function AgentThinkingAnimation({ status }: AgentThinkingAnimationProps) {
  if (!status) return null;

  // Determine which animation to show based on status
  const isSearching = status.toLowerCase().includes('search');
  const isExecuting = status.toLowerCase().includes('code') || status.toLowerCase().includes('execut');
  const isThinking = status.toLowerCase().includes('think') || status.toLowerCase().includes('process');
  const isGenerating = status.toLowerCase().includes('generat');

  return (
    <div className="flex justify-center">
      <div className="bg-primary/10 px-6 py-4 rounded-2xl border border-primary/20 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Icon based on activity */}
          <div className="relative">
            {isSearching && (
              <div className="relative">
                <Search className="w-6 h-6 text-primary animate-pulse" />
                <div className="absolute inset-0 animate-ping">
                  <Search className="w-6 h-6 text-primary opacity-30" />
                </div>
              </div>
            )}
            {isExecuting && (
              <div className="relative">
                <Code className="w-6 h-6 text-primary animate-bounce" />
                <div className="absolute -inset-1 bg-primary/20 rounded-full animate-pulse" />
              </div>
            )}
            {isThinking && !isSearching && !isExecuting && !isGenerating && (
              <div className="relative">
                <Brain className="w-6 h-6 text-primary" />
                <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
                  <Sparkles className="w-6 h-6 text-primary opacity-40" />
                </div>
              </div>
            )}
            {isGenerating && (
              <div className="relative">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                <div className="absolute -inset-2 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 animate-[shimmer_2s_linear_infinite]" />
              </div>
            )}
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">
              {status}
            </span>
            <div className="flex gap-1">
              <div 
                className="h-2 w-2 rounded-full bg-primary animate-bounce" 
                style={{ animationDelay: '0ms', animationDuration: '1s' }} 
              />
              <div 
                className="h-2 w-2 rounded-full bg-primary animate-bounce" 
                style={{ animationDelay: '150ms', animationDuration: '1s' }} 
              />
              <div 
                className="h-2 w-2 rounded-full bg-primary animate-bounce" 
                style={{ animationDelay: '300ms', animationDuration: '1s' }} 
              />
            </div>
          </div>
        </div>

        {/* Progress bar for searching */}
        {isSearching && (
          <div className="mt-3 w-full h-1 bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-[shimmer_1.5s_ease-in-out_infinite]" 
                 style={{ width: '40%' }} />
          </div>
        )}
      </div>
    </div>
  );
}
