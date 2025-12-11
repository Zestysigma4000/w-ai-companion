import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ChatInterface } from "./ChatInterface";
import { HistorySheet } from "./HistorySheet";
import { Button } from "@/components/ui/button";
import { Menu, Sparkles, LogOut, MessageSquarePlus, History, Settings, Code } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConversationsProvider, useConversations } from "@/hooks/useConversations";

function AppLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const navigate = useNavigate();
  const { createConversation, setCurrentConversationId } = useConversations();

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const handleNewChat = async () => {
    setCurrentConversationId(null);
    await createConversation("New Conversation");
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden">
      {/* Main Header - Fixed at top */}
      <header className="flex-shrink-0 h-14 bg-background/80 backdrop-blur-lg border-b border-border flex items-center px-2 md:px-4 gap-1 md:gap-3 z-50">
        {/* Hamburger menu - Desktop only */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hover:bg-muted min-h-[44px] min-w-[44px] items-center justify-center hidden md:flex"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-primary rounded-lg flex items-center justify-center glow-primary">
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
          </div>
          <h1 className="text-lg md:text-xl font-bold gradient-text hidden sm:block">W ai</h1>
        </div>

        {/* Mobile Navigation Actions */}
        <div className="flex items-center gap-1 ml-auto md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-10 w-10 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="New Chat"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="History"
          >
            <History className="h-5 w-5" />
          </Button>

          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/developer")}
              className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Developer"
            >
              <Code className="h-5 w-5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
            className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop Right Side */}
        <div className="ml-auto hidden md:flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Full capabilities • No limits
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Content area below header */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar - Desktop only, fixed width */}
        {sidebarOpen && (
          <aside className="hidden md:flex flex-shrink-0 w-64 h-full">
            <AppSidebar />
          </aside>
        )}
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <ChatInterface />
        </main>
      </div>
      
      {/* Mobile History Sheet */}
      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <ConversationsProvider>
        <AppLayoutContent />
      </ConversationsProvider>
    </SidebarProvider>
  );
}