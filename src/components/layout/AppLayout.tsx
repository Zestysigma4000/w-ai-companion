import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ChatInterface } from "./ChatInterface";
import { Button } from "@/components/ui/button";
import { Menu, Sparkles } from "lucide-react";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        {/* Main Header */}
        <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-lg border-b border-border flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-muted"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center glow-primary">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold gradient-text">W ai</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Full capabilities • No limits
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && <AppSidebar />}
        
        {/* Main Content Area */}
        <main className={`flex-1 pt-14 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
          <ChatInterface />
        </main>
      </div>
    </SidebarProvider>
  );
}