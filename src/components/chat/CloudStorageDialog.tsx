import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cloud, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface CloudStorageDialogProps {
  onFileSelect: (files: File[]) => void;
}

export function CloudStorageDialog({ onFileSelect }: CloudStorageDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleGoogleDrive = async () => {
    toast.error("Google Drive integration coming soon!");
    // Future: Implement Google Picker API
  };

  const handleOneDrive = async () => {
    toast.error("OneDrive integration coming soon!");
    // Future: Implement OneDrive file picker
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Cloud className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from Cloud Storage</DialogTitle>
          <DialogDescription>
            Select files from your cloud storage providers
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            onClick={handleGoogleDrive}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <FolderOpen className="w-5 h-5" />
            Google Drive
          </Button>
          <Button
            onClick={handleOneDrive}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <FolderOpen className="w-5 h-5" />
            OneDrive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
