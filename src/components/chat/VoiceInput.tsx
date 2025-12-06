import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onComplete?: () => void;
}

export function VoiceInput({ onTranscript, onComplete }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      // Check if browser supports Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast.error("Voice input is not supported in this browser. Try Chrome or Edge.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        toast.success("Listening...");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        toast.success("Voice input captured");
        
        // Auto-send after a short delay
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 300);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        if (event.error === 'no-speech') {
          toast.error("No speech detected. Please try again.");
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please enable it in browser settings.");
        } else {
          toast.error(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (error) {
      console.error("Error starting voice input:", error);
      toast.error("Could not start voice input. Please check permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={handleClick}
      className={`text-muted-foreground hover:text-foreground h-10 w-10 p-0 flex-shrink-0 ${isRecording ? 'text-red-500 hover:text-red-600 animate-pulse' : ''}`}
      title={isRecording ? "Stop recording" : "Start voice input"}
    >
      {isRecording ? (
        <Square className="w-4 h-4 fill-current" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
}
