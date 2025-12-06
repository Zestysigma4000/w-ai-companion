import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Copy, ThumbsUp, ThumbsDown, User, Sparkles, File, Download, Eye, Type } from "lucide-react";
import { useState, useEffect, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from "./CodeBlock";

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

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load signed URLs for images
  useEffect(() => {
    const loadImageUrls = async () => {
      if (!message.attachments) return;
      
      const imageAttachments = message.attachments.filter(att => att.type.startsWith('image/'));
      if (imageAttachments.length === 0) return;

      const urlMap: Record<string, string> = {};
      
      for (const attachment of imageAttachments) {
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(attachment.path, 3600); // 1 hour expiry
        
        if (data && !error) {
          urlMap[attachment.path] = data.signedUrl;
        }
      }
      
      setImageUrls(urlMap);
    };

    loadImageUrls();
  }, [message.attachments]);

  const handleDownloadAttachment = async (path: string, name: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .download(path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const isImageFile = (type: string) => {
    return type.startsWith('image/');
  };

  const TypingIndicator = () => (
    <div className="flex items-center gap-2">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 bg-primary rounded-full animate-[bounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2.5 h-2.5 bg-primary rounded-full animate-[bounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }}></div>
        <div className="w-2.5 h-2.5 bg-primary rounded-full animate-[bounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: '400ms' }}></div>
      </div>
      <span className="text-sm text-muted-foreground">W ai is thinking...</span>
    </div>
  );

  return (
    <div className={`flex gap-2 md:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      <Avatar className={`w-7 h-7 md:w-8 md:h-8 flex-shrink-0 ${isUser ? 'bg-muted' : 'bg-gradient-primary glow-primary'}`}>
        <AvatarFallback className={`${isUser ? 'text-foreground' : 'text-white'}`}>
          {isUser ? <User className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className={`flex-1 max-w-4xl ${isUser ? 'flex flex-col items-end' : ''}`}>
        {isUser ? (
          <div className="relative px-3 py-2 md:px-4 md:py-3 rounded-2xl shadow-sm bg-primary text-primary-foreground ml-8 md:ml-12">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-sm leading-relaxed m-0">
                {message.content}
              </p>
            </div>
            
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.attachments.map((attachment, index) => {
                  const isImage = isImageFile(attachment.type);
                  
                  if (isImage) {
                    const imageUrl = imageUrls[attachment.path];
                    if (!imageUrl) return null;
                    
                    return (
                      <div key={index} className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={imageUrl}
                          alt={attachment.name}
                          className="max-w-full h-auto max-h-96 object-contain"
                        />
                        <div className="flex items-center gap-2 p-2 bg-muted/30">
                          <File className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs flex-1 truncate">{attachment.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadAttachment(attachment.path, attachment.name)}
                            className="h-5 w-5 p-0"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs flex-1 truncate">{attachment.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(attachment.size / 1024).toFixed(1)}KB
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadAttachment(attachment.path, attachment.name)}
                        className="h-6 w-6 p-0"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {message.isTyping ? (
              message.content && message.content.length > 0 ? (
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <CodeBlock language={match[1]}>
                            {String(children).replace(/\n$/, '')}
                          </CodeBlock>
                        ) : (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  <span className="ml-1 inline-block w-2 h-4 bg-foreground/60 align-baseline animate-pulse"></span>
                </div>
              ) : (
                <TypingIndicator />
              )
            ) : (
              <>
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <CodeBlock language={match[1]}>
                            {String(children).replace(/\n$/, '')}
                          </CodeBlock>
                        ) : (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.attachments.map((attachment, index) => {
                      const isImage = isImageFile(attachment.type);
                      
                      if (isImage) {
                        const imageUrl = imageUrls[attachment.path];
                        if (!imageUrl) return null;
                        
                        return (
                          <div key={index} className="rounded-lg overflow-hidden border border-border">
                            <img
                              src={imageUrl}
                              alt={attachment.name}
                              className="max-w-full h-auto max-h-96 object-contain"
                            />
                            <div className="flex items-center gap-2 p-2 bg-muted/30">
                              <File className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs flex-1 truncate">{attachment.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadAttachment(attachment.path, attachment.name)}
                                className="h-5 w-5 p-0"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                        >
                          <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs flex-1 truncate">{attachment.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(attachment.size / 1024).toFixed(1)}KB
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadAttachment(attachment.path, attachment.name)}
                            className="h-6 w-6 p-0"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Message Actions */}
        {!message.isTyping && (
          <div className={`flex items-center gap-1 mt-2 opacity-0 md:group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>
            
            {!isUser && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ThumbsUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ThumbsDown className="w-3 h-3" />
                </Button>
              </>
            )}
            
            <span className="text-xs text-muted-foreground ml-2">
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            
            {/* Model Indicator - Only show for assistant messages */}
            {!isUser && message.modelUsed && (
              <div 
                className={`flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs ${
                  message.isVisionModel 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
                title={message.modelUsed}
              >
                {message.isVisionModel ? (
                  <>
                    <Eye className="w-3 h-3" />
                    <span className="hidden sm:inline">Vision</span>
                  </>
                ) : (
                  <>
                    <Type className="w-3 h-3" />
                    <span className="hidden sm:inline">Text</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isTyping === nextProps.message.isTyping &&
    prevProps.message.modelUsed === nextProps.message.modelUsed
  );
});