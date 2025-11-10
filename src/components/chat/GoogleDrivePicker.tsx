import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

interface GoogleDrivePickerProps {
  onFilesSelected: (files: File[]) => void;
}

export function GoogleDrivePicker({ onFilesSelected }: GoogleDrivePickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  useEffect(() => {
    const loadGoogleAPI = () => {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = () => {
        window.gapi.load("client:picker", () => {
          setIsLoaded(true);
        });
      };
      document.body.appendChild(script);

      const pickerScript = document.createElement("script");
      pickerScript.src = "https://accounts.google.com/gsi/client";
      pickerScript.onload = () => setPickerApiLoaded(true);
      document.body.appendChild(pickerScript);
    };

    loadGoogleAPI();
  }, []);

  const handleOpenPicker = async () => {
    if (!isLoaded || !pickerApiLoaded) {
      toast.error("Google Drive is still loading...");
      return;
    }

    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

      if (!clientId || !apiKey) {
        toast.error("Google Drive configuration missing");
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: async (response: any) => {
          if (response.error) {
            toast.error("Failed to authenticate with Google Drive");
            return;
          }

          const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS)
            .setOAuthToken(response.access_token)
            .setDeveloperKey(apiKey)
            .setCallback(async (data: any) => {
              if (data.action === window.google.picker.Action.PICKED) {
                const files = data.docs;
                await downloadFilesFromDrive(files, response.access_token);
              }
            })
            .build();
          picker.setVisible(true);
        },
      });

      tokenClient.requestAccessToken();
    } catch (error) {
      console.error("Error opening Google Drive picker:", error);
      toast.error("Failed to open Google Drive picker");
    }
  };

  const downloadFilesFromDrive = async (files: any[], accessToken: string) => {
    try {
      toast.info(`Downloading ${files.length} file(s) from Google Drive...`);
      
      const downloadedFiles: File[] = [];
      
      for (const file of files) {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to download file");

        const blob = await response.blob();
        const downloadedFile = new File([blob], file.name, { type: file.mimeType });
        downloadedFiles.push(downloadedFile);
      }

      toast.success(`Successfully downloaded ${downloadedFiles.length} file(s)`);
      onFilesSelected(downloadedFiles);
    } catch (error) {
      console.error("Error downloading files from Google Drive:", error);
      toast.error("Failed to download files from Google Drive");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleOpenPicker}
      disabled={!isLoaded || !pickerApiLoaded}
      className="text-muted-foreground hover:text-foreground"
    >
      <svg className="w-4 h-4 mr-1" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
        <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
      </svg>
      Drive
    </Button>
  );
}
