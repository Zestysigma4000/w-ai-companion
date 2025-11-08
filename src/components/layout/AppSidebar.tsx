import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquarePlus, 
  History, 
  Settings, 
  Trash2,
  Bot
} from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useNavigate } from "react-router-dom";

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();
  const { 
    conversations, 
    currentConversationId, 
    setCurrentConversationId,
    createConversation,
    deleteConversation 
  } = useConversations();

  const handleNewConversation = async () => {
    await createConversation("New Conversation");
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    await deleteConversation(conversationId);
  };

  return (
    <div className="fixed left-0 top-14 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
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
          <h3 className="text-sm font-semibold text-sidebar-foreground mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent Conversations
          </h3>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No conversations yet
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setCurrentConversationId(conversation.id)}
                  className={`w-full flex items-center justify-between group h-auto p-2 rounded-md cursor-pointer transition-colors ${
                    currentConversationId === conversation.id 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-sidebar-accent'
                  }`}
                >
                  <span className="truncate flex-1 text-left text-sm">
                    {conversation.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                    onClick={(e) => handleDeleteConversation(e, conversation.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

      </ScrollArea>

      {/* Bottom Settings */}
      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start hover:bg-sidebar-accent"
          onClick={() => navigate("/settings")}
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        
        <div className="mt-2 text-xs text-muted-foreground text-center">
          W ai v1.0 • Full Capabilities
        </div>
      </div>
    </div>
  );
}