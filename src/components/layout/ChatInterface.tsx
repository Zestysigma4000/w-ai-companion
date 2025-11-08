import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "../chat/MessageBubble";
import { Send } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { VoiceInput } from "../chat/VoiceInput";
import { FileAttachment } from "../chat/FileAttachment";

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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
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
    const loadMessages = async () => {
      if (currentConversationId) {
        // Fetch messages for this conversation from the database
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', currentConversationId)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error loading messages:', error);
          return;
        }
        
        if (messagesData && messagesData.length > 0) {
          const loadedMessages: Message[] = messagesData.map((msg) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role as "user" | "assistant",
            timestamp: new Date(msg.created_at),
          }));
          setMessages(loadedMessages);
        } else {
          setMessages([]);
        }
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
    };
    
    loadMessages();
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
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to send messages");
      }

      // Call the AI backend via Supabase function
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: currentInput,
          conversationId: currentConversationId || null
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        // Handle specific error codes
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (error.message?.includes('402') || error.message?.includes('Payment')) {
          throw new Error("Payment required. Please add credits to your account.");
        }
        throw error;
      }
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = error instanceof Error ? error.message : "I'm experiencing technical difficulties. Please try again in a moment.";
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: errorMessage,
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

  const handleVoiceTranscript = (text: string) => {
    if (text) {
      setInputValue(text);
    }
  };

  const handleFileSelect = (files: File[]) => {
    setAttachedFiles(files);
    // TODO: Implement file upload and processing
    // This would require creating storage buckets and handling file uploads
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
              <FileAttachment onFileSelect={handleFileSelect} />
              
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
                <VoiceInput onTranscript={handleVoiceTranscript} />
                
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