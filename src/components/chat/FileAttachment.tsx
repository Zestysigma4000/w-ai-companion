import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";

interface FileAttachmentProps {
  onFileSelect: (files: File[]) => void;
}

export function FileAttachment({ onFileSelect }: FileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Block JSON secrets and config files for safety
    const blocked = files.filter(f => f.type === 'application/json' || f.name.toLowerCase().endsWith('.json'));
    if (blocked.length > 0) {
      toast.error(`JSON files are not allowed: ${blocked.map(f => f.name).join(', ')}`);
      files = files.filter(f => !blocked.includes(f));
      if (files.length === 0) return;
    }

    // Check file size (20MB max per file)
    const maxSize = 20 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast.error(`Some files exceed 20MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Check max files (10 max)
    if (files.length > 10) {
      toast.error("You can upload a maximum of 10 files at once");
      return;
    }

    toast.success(`${files.length} file(s) selected`);
    onFileSelect(files);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleClick}
        className="text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="w-4 h-4" />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.zip,.rar,.7z,.tar,.gz,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.css,.scss,.html,.xml,.yaml,.yml,.svg,.webp,.heic"
      />
    </>
  );
}
