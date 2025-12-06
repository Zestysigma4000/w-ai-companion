import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ChatInterface } from "./ChatInterface";
import { Button } from "@/components/ui/button";
import { Menu, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConversationsProvider } from "@/hooks/useConversations";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  return (
    <SidebarProvider>
      <ConversationsProvider>
        <div className="h-[100dvh] w-full flex bg-background overflow-hidden">
          {/* Main Header */}
          <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-lg border-b border-border flex items-center px-3 md:px-4 gap-2 md:gap-3 safe-area-top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-primary rounded-lg flex items-center justify-center glow-primary">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </div>
              <h1 className="text-lg md:text-xl font-bold gradient-text">W ai</h1>
            </div>
  
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block text-xs text-muted-foreground">
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
          </div>
  
          {/* Sidebar - Overlay on mobile, static on desktop */}
          {sidebarOpen && (
            <>
              {/* Mobile overlay backdrop */}
              <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                style={{ top: '3.5rem' }}
                onClick={() => setSidebarOpen(false)}
              />
              {/* Sidebar - fixed on mobile, static on desktop */}
              <AppSidebar />
            </>
          )}
          
          {/* Main Content Area */}
          <main className="flex-1 pt-14 flex flex-col min-w-0 h-full overflow-hidden">
            <ChatInterface />
          </main>
        </div>
      </ConversationsProvider>
    </SidebarProvider>
  );
}