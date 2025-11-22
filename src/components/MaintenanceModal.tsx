import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wrench } from "lucide-react";

interface MaintenanceModalProps {
  open: boolean;
}

export function MaintenanceModal({ open }: MaintenanceModalProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Wrench className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-2xl">
            Website Under Maintenance
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base">
            We're currently performing scheduled maintenance to improve your experience. 
            The website will be back online shortly. Thank you for your patience!
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
