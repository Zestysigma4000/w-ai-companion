import { MessageSquarePlus, History, Settings, Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useConversations } from "@/hooks/useConversations";

interface MobileNavProps {
  onOpenHistory: () => void;
}

export function MobileNav({ onOpenHistory }: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { createConversation, setCurrentConversationId } = useConversations();

  const handleNewChat = async () => {
    setCurrentConversationId(null);
    await createConversation("New Conversation");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-sidebar/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        <button
          onClick={() => {
            setCurrentConversationId(null);
            if (location.pathname !== '/') navigate('/');
          }}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[64px] ${
            isActive('/') && !location.search ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button
          onClick={handleNewChat}
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors min-w-[64px]"
        >
          <div className="w-10 h-10 -mt-4 bg-gradient-primary rounded-full flex items-center justify-center shadow-lg glow-primary">
            <MessageSquarePlus className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] font-medium -mt-1">New Chat</span>
        </button>

        <button
          onClick={onOpenHistory}
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors min-w-[64px]"
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium">History</span>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[64px] ${
            isActive('/settings') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </nav>
  );
}