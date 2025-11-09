import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Brain, Search, Zap } from "lucide-react";
import { useState } from "react";

interface AIFeaturesProps {
  onFeatureSelect: (feature: string) => void;
}

export function AIFeatures({ onFeatureSelect }: AIFeaturesProps) {
  const [open, setOpen] = useState(false);

  const features = [
    {
      id: "deep-thinking",
      icon: Brain,
      label: "Deep Thinking",
      description: "Activate enhanced reasoning",
      prompt: "Use deep thinking to analyze: ",
    },
    {
      id: "web-search",
      icon: Search,
      label: "Web Search",
      description: "Search current information",
      prompt: "Search the web for latest information about: ",
    },
    {
      id: "quick-action",
      icon: Zap,
      label: "Quick Action",
      description: "Fast, focused response",
      prompt: "",
    },
  ];

  const handleFeatureClick = (feature: typeof features[0]) => {
    onFeatureSelect(feature.prompt);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Zap className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">AI Features</h4>
          <p className="text-xs text-muted-foreground">
            Enhance your prompts with advanced AI capabilities
          </p>
          <div className="space-y-2 pt-2">
            {features.map((feature) => (
              <Button
                key={feature.id}
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleFeatureClick(feature)}
              >
                <feature.icon className="w-5 h-5 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{feature.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {feature.description}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
