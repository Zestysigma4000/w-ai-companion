import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "../chat/MessageBubble";
import { Send, File, Brain, Loader2, Search, Code, Sparkles } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { VoiceInput } from "../chat/VoiceInput";
import { FileAttachment } from "../chat/FileAttachment";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import { requestQueue } from "@/utils/requestQueue";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isTyping?: boolean;
  modelUsed?: string;
  isVisionModel?: boolean;
  attachments?: Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>;
}

export function ChatInterface() {
  const { currentConversationId, setCurrentConversationId, refreshConversations } = useConversations();
  const { settings } = useAppSettings();
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
  const [forceWebSearch, setForceWebSearch] = useState(false);
  const [toolDetails, setToolDetails] = useState<{ type: string; details: string } | null>(null);
  const [persistentToolDetails, setPersistentToolDetails] = useState<{ type: string; details: string } | null>(null);
  const [typingPreview, setTypingPreview] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Message pagination constants
  const MESSAGES_PER_PAGE = 50;

  // Subscribe to request queue changes
  useEffect(() => {
    const unsubscribe = requestQueue.subscribe((queue) => {
      setQueueLength(queue.length);
    });
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Tool indicator display - keep showing during entire loading phase
  useEffect(() => {
    if (isLoading && persistentToolDetails) {
      console.log('🎨 Displaying tool indicator:', persistentToolDetails);
      setToolDetails(persistentToolDetails);
    }
  }, [isLoading, persistentToolDetails]);

  // Retry connection when coming back online
  useEffect(() => {
    const handleOnline = () => {
      requestQueue.retryQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Debounced auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages.length, isLoading]);

  // Auto-resize textarea and handle typing preview
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
    
    // Send typing preview to backend after user stops typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (inputValue.trim().length > 3) {
      typingTimeoutRef.current = setTimeout(() => {
        setTypingPreview(inputValue);
      }, 1000); // Wait 1 second after user stops typing
    }
  }, [inputValue]);

  // Load messages with pagination when conversation changes
  const loadMessages = useCallback(async (conversationId: string, pageNum: number = 0) => {
    setLoadingMessages(true);
    try {
      const from = pageNum * MESSAGES_PER_PAGE;
      const to = from + MESSAGES_PER_PAGE - 1;

      const result = await retryWithBackoff(
        async () => {
          const response = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .range(from, to);
          return response;
        },
        {
          maxRetries: 2,
          onRetry: (attempt) => {
            console.log(`Retrying message load (attempt ${attempt})...`);
          }
        }
      );

      const { data: messagesData, error, count } = result;
      
      if (error) {
        console.error('Error loading messages:', error);
        toast.error('Failed to load conversation history', {
          description: 'Unable to connect to the server. Please check your connection.'
        });
        return;
      }
    
      if (messagesData) {
        const loadedMessages: Message[] = messagesData
          .reverse()
          .map((msg) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role as "user" | "assistant",
            timestamp: new Date(msg.created_at),
            attachments: msg.attachments as any[] || []
          }));
        
        if (pageNum === 0) {
          setMessages(loadedMessages);
        } else {
          setMessages(prev => [...loadedMessages, ...prev]);
        }
        
        setHasMore(count ? (from + MESSAGES_PER_PAGE) < count : false);
      }
    } catch (err) {
      console.error('Unexpected error loading messages:', err);
      toast.error('Failed to load messages', {
        description: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      setPage(0);
      setHasMore(true);
      loadMessages(currentConversationId, 0);
    } else {
      setMessages([
        {
          id: "welcome",
          content: "Hello! I'm W ai, your powerful AI assistant with full capabilities. I can help you write code, debug applications, create websites, games, and solve any technical challenge. I have access to the latest AI models and can provide working solutions to your problems. What would you like to build today?",
          role: "assistant",
          timestamp: new Date(),
        }
      ]);
      setPage(0);
      setHasMore(false);
    }
  }, [currentConversationId, loadMessages]);

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

    // Define the send operation
    const sendOperation = async () => {
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
          
          const uploadResult = await retryWithBackoff(
            async () => supabase.storage
              .from('chat-attachments')
              .upload(fileName, file),
            {
              maxRetries: 2,
              onRetry: (attempt) => {
                console.log(`Retrying file upload (attempt ${attempt})...`);
              }
            }
          );

          const { data: uploadData, error: uploadError } = uploadResult;

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            toast.error(`Failed to upload ${file.name}`, {
              description: 'Storage service is unavailable. Please try again.'
            });
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
          
          // Update progress after each file
          const progress = Math.round(((i + 1) / filesToUpload.length) * 100);
          setUploadProgress(progress);
          
          // Small delay to let UI update
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Keep 100% visible for a moment before clearing
        await new Promise(resolve => setTimeout(resolve, 500));
        
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

      // Call the AI backend via Supabase function with retry
      console.log(`📤 Sending message with ${uploadedFiles.length} attachments (${uploadedFiles.filter(f => f.type.startsWith('image/')).length} images)`);
      
      setToolDetails(null);
      
      const aiResult = await retryWithBackoff(
        async () => supabase.functions.invoke('chat', {
          body: {
            message: currentInput,
            conversationId: currentConversationId || null,
            attachments: uploadedFiles,
            deepThinkEnabled,
            forceWebSearch,
            typingPreview: typingPreview // Send typing preview for faster AI response
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }),
        {
          maxRetries: 2,
          onRetry: (attempt, error) => {
            console.log(`Retrying message send (attempt ${attempt})...`, error.message);
            toast.info(`Retrying... (attempt ${attempt})`);
          }
        }
      );

      const { data, error } = aiResult;

      console.log('📥 Response received from edge function');
      console.log('📊 Tool details in response:', data?.toolDetails);
      
      // Set tool details immediately when received
      if (data?.toolDetails) {
        console.log('🔧 Setting tool details:', data.toolDetails);
        setPersistentToolDetails(data.toolDetails);
        setToolDetails(data.toolDetails);
      }

      if (error) {
        // Handle specific error codes
        if (error.message?.includes('CONVERSATION_NOT_FOUND') || error.message?.includes('Conversation not found')) {
          console.log('Conversation not found, clearing conversation ID...');
          setCurrentConversationId(null);
          await refreshConversations();
          
          // Remove the user message we just added since it failed
          setMessages(prev => prev.filter(m => m.id !== userMessage.id));
          
          toast.warning('Conversation not found', {
            description: 'Please send your message again to start a new conversation.'
          });
          
          // Show error and let user retry
          const errorResponse: Message = {
            id: (Date.now() + 1).toString(),
            content: "That conversation no longer exists. Please send your message again to start a new conversation.",
            role: "assistant",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorResponse]);
          setIsLoading(false);
          return;
        }
        
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          toast.error('Rate limit exceeded', {
            description: 'Please try again in a moment.'
          });
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (error.message?.includes('402') || error.message?.includes('Payment')) {
          toast.error('Payment required', {
            description: 'Please add credits to your account.'
          });
          throw new Error("Payment required. Please add credits to your account.");
        }
        
        // Handle network/connection errors
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          toast.error('Connection failed', {
            description: 'Unable to reach the server. Please check your internet connection.'
          });
          throw new Error("Connection failed. Please check your internet connection.");
        }
        
        // Generic backend error
        toast.error('Service unavailable', {
          description: 'The AI service is temporarily unavailable. Please try again.'
        });
        throw error;
      }

      // Update current conversation ID if the backend returned a different one
      if (data.conversationId && data.conversationId !== currentConversationId) {
        setCurrentConversationId(data.conversationId);
        await refreshConversations();
      }
      
      // Reset force flags and typing preview
      setForceWebSearch(false);
      setTypingPreview("");
      
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
          modelUsed: data.modelUsed,
          isVisionModel: data.isVisionModel,
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
        const speed = Math.max(8, Math.floor(1200 / Math.max(1, fullText.length)));
        let i = 0;
        const interval = setInterval(() => {
          i = Math.min(i + 2, fullText.length);
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
      
      // Delay before clearing indicators to ensure user sees them
      await new Promise(resolve => setTimeout(resolve, 300));
    };

    // Try to send, or queue if it fails
    try {
      await sendOperation();
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Ensure minimum typing animation duration even for errors
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minTypingDuration - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      let errorMessage = "I'm experiencing technical difficulties. Please try again in a moment.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Don't show toast again if we already showed one above
      if (!error?.message?.includes('Rate limit') && 
          !error?.message?.includes('Payment') && 
          !error?.message?.includes('Connection failed') &&
          !error?.message?.includes('Conversation not found')) {
        toast.error('Failed to send message', {
          description: errorMessage
        });
      }
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: errorMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      // Always clear states whether success or error
      setIsLoading(false);
      setUploadingFiles(false);
      setPersistentToolDetails(null);
      setToolDetails(null);
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

  const handleVoiceComplete = () => {
    // Auto-send the message after voice input completes
    if (inputValue.trim()) {
      handleSendMessage();
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
      <ScrollArea className="flex-1 p-3 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
          {/* Load More Button */}
          {hasMore && currentConversationId && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  loadMessages(currentConversationId, nextPage);
                }}
                disabled={loadingMessages}
              >
                {loadingMessages ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load Earlier Messages'
                )}
              </Button>
            </div>
          )}

          {/* Queue Indicator */}
          {queueLength > 0 && (
            <div className="flex justify-center">
              <div className="bg-muted px-4 py-2 rounded-full text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{queueLength} message{queueLength > 1 ? 's' : ''} pending</span>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {/* Unified typing/tool indicator */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {toolDetails?.type === 'search' ? (
                  <Search className="w-4 h-4 text-primary animate-pulse" />
                ) : toolDetails?.type === 'code' ? (
                  <Code className="w-4 h-4 text-primary animate-bounce" />
                ) : toolDetails?.type === 'think' ? (
                  <Brain className="w-4 h-4 text-primary animate-pulse" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                )}
              </div>
              <div className="bg-card rounded-2xl p-4 max-w-[80%] border border-border">
                {toolDetails ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="text-sm text-foreground font-medium">
                      {toolDetails.details}
                    </div>
                    {toolDetails.type === 'search' && (
                      <div className="w-full h-1 bg-primary/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-3/5 animate-[shimmer_1.5s_ease-in-out_infinite]" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-sm text-muted-foreground ml-2">
                      Thinking...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto p-3 md:p-6">
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
            <div className="flex items-end gap-2 md:gap-3 bg-card border border-border rounded-xl p-2 shadow-card-custom">
              {settings.enable_file_uploads && <FileAttachment onFileSelect={handleFileSelect} />}

              <Button
                variant={forceWebSearch ? "default" : "ghost"}
                size="sm"
                onClick={() => setForceWebSearch(!forceWebSearch)}
                aria-pressed={forceWebSearch}
                title="Force Web Search"
                className="text-muted-foreground hover:text-foreground"
              >
                <Search className="w-4 h-4" />
              </Button>

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
                className="flex-1 min-h-[40px] max-h-32 resize-none border-0 bg-transparent p-2 focus-visible:ring-0 placeholder:text-muted-foreground text-sm md:text-base"
                rows={1}
              />
              
              <div className="flex items-center gap-1 md:gap-2">
                {settings.enable_voice_input && (
                  <VoiceInput 
                    onTranscript={handleVoiceTranscript}
                    onComplete={handleVoiceComplete}
                  />
                )}
                
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