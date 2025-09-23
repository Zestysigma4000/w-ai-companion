import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Plus, 
  History, 
  Settings, 
  Code, 
  FileText,
  Zap,
  Brain
} from "lucide-react";

interface ChatHistory {
  id: string;
  title: string;
  timestamp: string;
}

export function AppSidebar() {
  const [chatHistory] = useState<ChatHistory[]>([
    { id: "1", title: "Build a React component", timestamp: "2 hours ago" },
    { id: "2", title: "Debug API integration", timestamp: "Yesterday" },
    { id: "3", title: "Create landing page", timestamp: "3 days ago" },
    { id: "4", title: "Optimize performance", timestamp: "1 week ago" },
  ]);

  const capabilities = [
    { icon: Code, label: "Code Generation", desc: "Write, debug, and optimize code" },
    { icon: FileText, label: "File Management", desc: "Create, edit, and organize files" },
    { icon: Brain, label: "AI Analysis", desc: "Analyze and understand codebases" },
    { icon: Zap, label: "Real-time Updates", desc: "Instant code modifications" },
  ];

  return (
    <div className="fixed left-0 top-14 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40">
      {/* New Chat Button */}
      <div className="p-4">
        <Button className="w-full bg-gradient-primary hover:opacity-90 text-white glow-primary transition-all duration-300">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4">
        {/* Capabilities Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-sidebar-foreground mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Capabilities
          </h3>
          <div className="space-y-2">
            {capabilities.map((capability, index) => (
              <div key={index} className="glass-card p-3 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                <div className="flex items-start gap-3">
                  <capability.icon className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-sidebar-foreground">{capability.label}</div>
                    <div className="text-xs text-muted-foreground">{capability.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Chat History */}
        <div>
          <h3 className="text-sm font-semibold text-sidebar-foreground mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent Chats
          </h3>
          <div className="space-y-1">
            {chatHistory.map((chat) => (
              <Button
                key={chat.id}
                variant="ghost"
                className="w-full justify-start text-left p-3 h-auto hover:bg-sidebar-accent"
              >
                <div className="flex items-start gap-3 w-full">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-sidebar-foreground truncate">
                      {chat.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {chat.timestamp}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Bottom Settings */}
      <div className="p-4 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}