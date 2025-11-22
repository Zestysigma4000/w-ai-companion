import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themes = [
  { name: "Emerald Night", value: "dark-blue", label: "Emerald Night" },
  { name: "Crimson Dusk", value: "crimson", label: "Crimson Dusk" },
  { name: "Sapphire Deep", value: "sapphire", label: "Sapphire Deep" },
  { name: "Amber Shadow", value: "amber", label: "Amber Shadow" },
  { name: "Violet Noir", value: "violet", label: "Violet Noir" },
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
        <span className="flex-1 text-left">Theme</span>
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
