import {
  Theme,
  AlwaysOnTopToggle,
  AppIconToggle,
  AutostartToggle,
  ConversationStorage,
  DeleteChats,
} from "./components";
import { useSettings } from "@/hooks";
import { PageLayout } from "@/layouts";

const Settings = () => {
  const settings = useSettings();

  return (
    <PageLayout
      title="App Settings"
      description="Control the local overlay, startup behavior, taskbar visibility, and always-on-top mode."
    >
      {/* Theme */}
      <Theme />

      {/* Autostart Toggle */}
      <AutostartToggle />

      {/* App Icon Toggle */}
      <AppIconToggle />

      {/* Always On Top Toggle */}
      <AlwaysOnTopToggle />

      {/* Conversation Storage */}
      <ConversationStorage />

      {/* Delete Conversations */}
      <DeleteChats {...settings} />
    </PageLayout>
  );
};

export default Settings;
