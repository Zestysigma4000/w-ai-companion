import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquarePlus,
  History,
  Settings,
  Trash2,
  Bot,
  MoreHorizontal,
  Palette
} from "lucide-react";
import { ThemeSwitcher } from "../ThemeSwitcher";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useConversations } from "@/hooks/useConversations";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function AppSidebar() {
  const navigate = useNavigate();
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const { 
    conversations, 
    currentConversationId, 
    setCurrentConversationId,
    createConversation,
    deleteConversation,
    deleteAllConversations,
  } = useConversations();

  useEffect(() => {
    checkOwnerStatus();
  }, []);

  const checkOwnerStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      setIsOwner(roleData?.role === "owner");
    }
  };

  const handleNewConversation = async () => {
    await createConversation("New Conversation");
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    // Find the conversation to show its title in the toast
    const conversation = conversations.find(c => c.id === conversationId);
    const conversationTitle = conversation?.title || 'conversation';
    
    try {
      await deleteConversation(conversationId);
      toast.success(`Deleted "${conversationTitle.length > 30 ? conversationTitle.substring(0, 30) + '...' : conversationTitle}"`);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation. Please try again.');
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllConversations();
      toast.success('All conversations deleted');
    } catch (error) {
      console.error('Failed to delete all conversations:', error);
      toast.error('Failed to delete all conversations. Please try again.');
    }
  };

  const displayedConversations = isListExpanded 
    ? conversations 
    : conversations.slice(0, 4);

  return (
    <div className="fixed md:relative left-0 top-14 md:top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center glow-primary">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold gradient-text">W ai Assistant</h2>
        </div>

        <Button 
          onClick={handleNewConversation}
          className="w-full bg-gradient-primary hover:opacity-90 text-white glow-primary transition-all duration-300"
          size="sm"
        >
          <MessageSquarePlus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4">
        {/* Recent Conversations */}
        <div className="py-4">
          <div className="text-sm font-semibold text-sidebar-foreground mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span>Recent Conversations</span>
            </div>
            {conversations.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all conversations?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove all your chats. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No conversations yet
              </div>
            ) : (
              <>
                {displayedConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setCurrentConversationId(conversation.id)}
                    className={`w-full flex items-center justify-between group h-auto p-2 rounded-md cursor-pointer transition-colors ${
                      currentConversationId === conversation.id 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-sidebar-accent'
                    }`}
                  >
                    <span className="truncate flex-1 text-left text-sm" title={conversation.title}>
                      {conversation.title.length > 35 ? conversation.title.substring(0, 35) + '...' : conversation.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive shrink-0 ml-1"
                      onClick={(e) => handleDeleteConversation(e, conversation.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                
                {conversations.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center py-2 h-auto"
                    onClick={() => setIsListExpanded(!isListExpanded)}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="ml-2 text-xs">
                      {isListExpanded ? 'Show less' : `Show ${conversations.length - 4} more`}
                    </span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

      </ScrollArea>

      {/* Bottom Settings */}
      <div className="p-4 border-t border-sidebar-border space-y-2 flex-shrink-0">
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-sidebar-accent"
        >
          <Palette className="w-4 h-4 mr-2" />
          <ThemeSwitcher />
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-sidebar-accent"
          onClick={() => navigate("/settings")}
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        
        {isOwner && (
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-sidebar-accent"
            onClick={() => navigate("/developer")}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            Developer
          </Button>
        )}
        
        <div className="mt-2 text-xs text-muted-foreground text-center">
          W ai v1.0 • Full Capabilities
        </div>
      </div>
    </div>
  );
}