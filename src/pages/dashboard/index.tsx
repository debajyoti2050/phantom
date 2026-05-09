import { Card, CardContent, CardHeader, CardTitle } from "@/components";
import { PageLayout } from "@/layouts";
import {
  BotIcon,
  DatabaseIcon,
  KeyRoundIcon,
  OrbitIcon,
  ScanSearchIcon,
} from "lucide-react";

const Dashboard = () => {
  const cards = [
    {
      title: "Unlocked Core",
      icon: KeyRoundIcon,
      text: "Local personal build with no activation, usage gates, checkout, license checks, or account wall.",
    },
    {
      title: "Provider Matrix",
      icon: BotIcon,
      text: "Bring any supported endpoint, API key, model name, headers, and streaming mode.",
    },
    {
      title: "Local Memory",
      icon: DatabaseIcon,
      text: "Chats, prompts, and preferences stay on this machine through the local data layer.",
    },
    {
      title: "Capture Layer",
      icon: ScanSearchIcon,
      text: "Transparent top-center control surface for capture, voice, system audio, and fast prompts.",
    },
  ];

  return (
    <PageLayout
      title="Overview"
      description="A local command surface for models, capture, voice, memory, and shortcuts."
    >
      <section className="phantom-hero phantom-console-hero">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-xs text-primary">
            <OrbitIcon className="size-4" />
            <span>Local mode - all tools available</span>
          </div>
          <h2>Command surface</h2>
          <p>
            Configure providers once, then run screen capture, image prompts,
            voice, system audio, prompt presets, and local chat memory from the
            floating control strip.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.title} className="phantom-stat-card shadow-none">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="phantom-card-icon">
                <item.icon className="size-4" />
              </div>
              <CardTitle className="text-sm">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground">
              {item.text}
            </CardContent>
          </Card>
        ))}
      </div>
    </PageLayout>
  );
};

export default Dashboard;
