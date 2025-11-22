import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "../chat/MessageBubble";
import { Send, File, Brain } from "lucide-react";
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
  attachments?: Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>;
}

export function ChatInterface() {
  const { currentConversationId, setCurrentConversationId, refreshConversations } = useConversations();
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  // Load messages when conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      if (currentConversationId) {
        setLoadingMessages(true);
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', currentConversationId)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error loading messages:', error);
          setMessages([]);
          setLoadingMessages(false);
          return;
        }
        
        if (messagesData && messagesData.length > 0) {
          const loadedMessages: Message[] = messagesData.map((msg) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role as "user" | "assistant",
            timestamp: new Date(msg.created_at),
            attachments: msg.attachments as any[] || []
          }));
          setMessages(loadedMessages);
        } else {
          setMessages([]);
        }
        setLoadingMessages(false);
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

    const currentInput = inputValue;
    const filesToUpload = [...attachedFiles];
    
    // Clear input and files immediately for better UX
    setInputValue("");
    setIsLoading(true);
    
    // Track start time for minimum typing animation duration
    const startTime = Date.now();
    const minTypingDuration = 800; // milliseconds

    try {
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to send messages");
      }

      // Upload attached files FIRST before sending message
      let uploadedFiles: any[] = [];
      if (filesToUpload.length > 0) {
        setUploadingFiles(true);
        setUploadProgress(0);
        
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            setUploadingFiles(false);
            setUploadProgress(0);
            throw new Error(`Failed to upload ${file.name}`);
          }

          uploadedFiles.push({
            name: file.name,
            path: uploadData.path,
            type: file.type,
            size: file.size
          });
          
          // Update progress
          setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
        }
        
        setUploadingFiles(false);
        setUploadProgress(0);
        // Clear files immediately after successful upload
        setAttachedFiles([]);
      }

      // Now add the user message with uploaded files
      const userMessage: Message = {
        id: Date.now().toString(),
        content: currentInput,
        role: "user",
        timestamp: new Date(),
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      };

      setMessages(prev => [...prev, userMessage]);

      // Call the AI backend via Supabase function
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: currentInput,
          conversationId: currentConversationId || null,
          attachments: uploadedFiles,
          deepThinkEnabled
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        // Handle specific error codes
        if (error.message?.includes('CONVERSATION_NOT_FOUND') || error.message?.includes('Conversation not found')) {
          console.log('Conversation not found, resetting and retrying...');
          setCurrentConversationId(null);
          // Retry without conversation ID
          const retryBody = {
            message: currentInput,
            conversationId: null,
            attachments: uploadedFiles,
            deepThinkEnabled
          };
          const { data: retryData, error: retryError } = await supabase.functions.invoke('chat', {
            body: retryBody,
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          
          if (retryError) {
            throw retryError;
          }
          
          // Update with new conversation ID
          if (retryData.conversationId) {
            setCurrentConversationId(retryData.conversationId);
            await refreshConversations();
          }
          
          // Continue with the response
          const typingMessageId = (Date.now() + 1).toString();
          const fullText: string = retryData.response || '';

          setMessages(prev => [
            ...prev,
            {
              id: typingMessageId,
              content: '',
              role: 'assistant',
              timestamp: new Date(),
              isTyping: true,
            },
          ]);

          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minTypingDuration - elapsedTime);
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }

          await new Promise<void>((resolve) => {
            const speed = Math.max(8, Math.floor(1200 / Math.max(1, fullText.length))); // even faster
            let i = 0;
            const interval = setInterval(() => {
              i = Math.min(i + 2, fullText.length); // 2 characters at a time
              setMessages(prev => prev.map(m =>
                m.id === typingMessageId ? { ...m, content: fullText.slice(0, i) } : m
              ));
              if (i >= fullText.length) {
                clearInterval(interval);
                setMessages(prev => prev.map(m =>
                  m.id === typingMessageId ? { ...m, isTyping: false } : m
                ));
                resolve();
              }
            }, speed);
          });
          
          setIsLoading(false);
          return;
        }
        
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (error.message?.includes('402') || error.message?.includes('Payment')) {
          throw new Error("Payment required. Please add credits to your account.");
        }
        throw error;
      }

      // Update current conversation ID if the backend returned a different one
      if (data.conversationId && data.conversationId !== currentConversationId) {
        setCurrentConversationId(data.conversationId);
        await refreshConversations();
      }
      
      // Typewriter effect: progressively reveal the AI response
      const typingMessageId = (Date.now() + 1).toString();
      const fullText: string = data.response || '';

      // Add a placeholder assistant message that will be updated
      setMessages(prev => [
        ...prev,
        {
          id: typingMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          isTyping: true,
        },
      ]);

      // Ensure minimum typing animation duration
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minTypingDuration - elapsedTime);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Animate content reveal
      await new Promise<void>((resolve) => {
        const speed = Math.max(8, Math.floor(1200 / Math.max(1, fullText.length))); // even faster
        let i = 0;
        const interval = setInterval(() => {
          i = Math.min(i + 2, fullText.length); // 2 characters at a time
          setMessages(prev => prev.map(m =>
            m.id === typingMessageId ? { ...m, content: fullText.slice(0, i) } : m
          ));
          if (i >= fullText.length) {
            clearInterval(interval);
            // Mark done typing
            setMessages(prev => prev.map(m =>
              m.id === typingMessageId ? { ...m, isTyping: false } : m
            ));
            resolve();
          }
        }, speed);
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Ensure minimum typing animation duration even for errors
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minTypingDuration - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
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
      setUploadingFiles(false);
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
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Check file size (20MB max per file)
    const maxSize = 20 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      return;
    }

    // Check max files (10 max)
    if (files.length > 10) {
      return;
    }

    setAttachedFiles(files);
  };

  return (
    <div 
      className="flex flex-col h-full max-h-screen"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-primary">
          <div className="text-center">
            <File className="w-16 h-16 text-primary mx-auto mb-4" />
            <p className="text-2xl font-semibold text-primary">Drop files here to upload</p>
            <p className="text-muted-foreground mt-2">Up to 10 files, 20MB each</p>
          </div>
        </div>
      )}
      
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {/* Thinking animation */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card rounded-2xl p-4 max-w-[80%] border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-sm text-muted-foreground ml-2">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto p-6">
          {/* Upload progress indicator */}
          {uploadingFiles && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading files...</span>
                <span className="text-primary font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-primary transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Show attached files preview */}
          {attachedFiles.length > 0 && !uploadingFiles && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => {
                const isImage = file.type.startsWith('image/');
                
                if (isImage) {
                  const previewUrl = URL.createObjectURL(file);
                  return (
                    <div
                      key={index}
                      className="relative rounded-lg border border-border overflow-hidden"
                    >
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="max-h-32 w-auto object-contain"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="absolute top-1 right-1 h-6 w-6 p-0 bg-background/80 hover:bg-destructive/80 hover:text-destructive-foreground"
                      >
                        ×
                      </Button>
                      <div className="px-2 py-1 bg-background/80 text-xs truncate max-w-[150px]">
                        {file.name}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm"
                  >
                    <File className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)}KB
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                      className="h-5 w-5 p-0 hover:bg-destructive/20 hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="relative">
            <div className="flex items-end gap-3 bg-card border border-border rounded-xl p-2 shadow-card-custom">
              <FileAttachment onFileSelect={handleFileSelect} />

              <Button
                variant={deepThinkEnabled ? "default" : "ghost"}
                size="sm"
                onClick={() => setDeepThinkEnabled(!deepThinkEnabled)}
                aria-pressed={deepThinkEnabled}
                title="Deep Think"
                className="text-muted-foreground hover:text-foreground"
              >
                <Brain className="w-4 h-4" />
              </Button>
              
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask W ai anything... I have full capabilities!"
                className="flex-1 min-h-[40px] max-h-32 resize-none border-0 bg-transparent p-2 focus-visible:ring-0 placeholder:text-muted-foreground"
                rows={1}
              />
              
              <div className="flex items-center gap-2">
                <VoiceInput onTranscript={handleVoiceTranscript} />
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || uploadingFiles}
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