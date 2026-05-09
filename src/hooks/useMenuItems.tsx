import {
  Settings,
  Code,
  MessagesSquare,
  BracesIcon,
  AudioLinesIcon,
  CommandIcon,
  ScanSearchIcon,
  LayoutGridIcon,
  PowerIcon,
  GithubIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export const useMenuItems = () => {
  const menu: {
    icon: React.ElementType;
    label: string;
    href: string;
    count?: number;
  }[] = [
    {
      icon: LayoutGridIcon,
      label: "Overview",
      href: "/dashboard",
    },
    {
      icon: MessagesSquare,
      label: "Chats",
      href: "/chats",
    },
    {
      icon: BracesIcon,
      label: "Prompts",
      href: "/system-prompts",
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/settings",
    },
    {
      icon: MessageSquareTextIcon,
      label: "Responses",
      href: "/responses",
    },
    {
      icon: ScanSearchIcon,
      label: "Capture",
      href: "/screenshot",
    },
    {
      icon: AudioLinesIcon,
      label: "Audio",
      href: "/audio",
    },
    {
      icon: CommandIcon,
      label: "Shortcuts",
      href: "/shortcuts",
    },

    {
      icon: Code,
      label: "Providers",
      href: "/dev-space",
    },
  ];

  const footerItems = [
    {
      icon: PowerIcon,
      label: "Quit",
      action: async () => {
        await invoke("exit_app");
      },
    },
  ];

  const footerLinks: {
    title: string;
    icon: React.ElementType;
    link: string;
  }[] = [
    {
      title: "GitHub",
      icon: GithubIcon,
      link: "https://github.com/debajyoti2050/phantom",
    },
  ];

  return {
    menu,
    footerItems,
    footerLinks,
  };
};
