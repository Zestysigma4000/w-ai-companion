import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface FileUploadDialogProps {
  open: boolean;
  filesCount: number;
  currentFile: number;
}

export function FileUploadDialog({ open, filesCount, currentFile }: FileUploadDialogProps) {
  const progress = filesCount > 0 ? (currentFile / filesCount) * 100 : 0;
  
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            Uploading Files
          </DialogTitle>
          <DialogDescription>
            Uploading {currentFile} of {filesCount} file{filesCount > 1 ? 's' : ''}...
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground text-center">
            Please wait while we upload your files
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
