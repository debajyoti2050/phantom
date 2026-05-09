import {
  ResponseLength,
  LanguageSelector,
  AutoScrollToggle,
} from "./components";
import { PageLayout } from "@/layouts";

const Responses = () => {
  return (
    <PageLayout
      title="Response Settings"
      description="Tune response length, output language, and the streaming response panel."
    >
      <ResponseLength />
      <LanguageSelector />
      <AutoScrollToggle />
    </PageLayout>
  );
};

export default Responses;
