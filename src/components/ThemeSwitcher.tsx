import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themes = [
  { name: "Dark Blue", value: "dark-blue", label: "Original Dark" },
  { name: "Light", value: "light", label: "Light Mode" },
  { name: "Dark Purple", value: "dark-purple", label: "Purple Dark" },
  { name: "Ocean", value: "ocean", label: "Ocean Blue" },
  { name: "Forest", value: "forest", label: "Forest Green" },
];

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState("dark-blue");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark-blue";
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (theme: string) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Palette className="w-4 h-4" />
          Theme
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.value}
            onClick={() => handleThemeChange(theme.value)}
            className={currentTheme === theme.value ? "bg-muted" : ""}
          >
            {theme.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
