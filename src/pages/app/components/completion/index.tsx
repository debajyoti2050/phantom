import { useCompletion } from "@/hooks";
import { Screenshot } from "./Screenshot";
import { Files } from "./Files";
import { Audio } from "./Audio";
import { Input } from "./Input";
import { useEffect } from "react";

export const Completion = ({ isHidden }: { isHidden: boolean }) => {
  const completion = useCompletion();

  useEffect(() => {
    if (completion.isLoading || completion.isScreenshotLoading) {
      document.body.setAttribute("data-phantom-thinking", "true");
    } else {
      document.body.removeAttribute("data-phantom-thinking");
    }
  }, [completion.isLoading, completion.isScreenshotLoading]);

  return (
    <>
      <Input {...completion} isHidden={isHidden} />
      <Audio {...completion} />
      <Screenshot {...completion} />
      <Files {...completion} />
    </>
  );
};
