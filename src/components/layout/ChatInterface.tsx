import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "../chat/MessageBubble";
import { Send, Paperclip, Mic } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isTyping?: boolean;
}

export function ChatInterface() {
  const { currentConversationId } = useConversations();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Hello! I'm W ai, your powerful AI assistant with full capabilities. I can help you write code, debug applications, create websites, games, and solve any technical challenge. I have access to the latest AI models and can provide working solutions to your problems. What would you like to build today?",
      role: "assistant",
      timestamp: new Date(),
    }
  ]);
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  // Reset messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      // In a real implementation, you'd fetch messages for this conversation
      setMessages([]);
    } else {
      setMessages([
        {
          id: "welcome",
          content: "Hello! I'm W ai, your powerful AI assistant with full capabilities. I can help you write code, debug applications, create websites, games, and solve any technical challenge. I have access to the latest AI models and can provide working solutions to your problems. What would you like to build today?",
          role: "assistant",
          timestamp: new Date(),
        }
      ]);
    }
  }, [currentConversationId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the real AI backend
      const response = await fetch('/functions/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          conversationId: currentConversationId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm experiencing technical difficulties. Please check that your OpenAI API key is properly configured in the Supabase secrets, or try again in a moment.",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <MessageBubble 
              message={{
                id: "typing",
                content: "",
                role: "assistant",
                timestamp: new Date(),
                isTyping: true
              }} 
            />
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto p-6">
          <div className="relative">
            <div className="flex items-end gap-3 bg-card border border-border rounded-xl p-4 shadow-card-custom">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask W ai anything... I have full capabilities!"
                className="flex-1 min-h-[20px] max-h-32 resize-none border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground"
                rows={1}
              />
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Mic className="w-4 h-4" />
                </Button>
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-gradient-primary hover:opacity-90 text-white glow-primary transition-all duration-300"
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground text-center">
            W ai can make mistakes. Verify important information and code outputs.
          </div>
        </div>
      </div>
    </div>
  );
}