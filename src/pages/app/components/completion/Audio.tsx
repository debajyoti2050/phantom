import { InfoIcon, Mic2Icon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, Button } from "@/components";
import { AutoSpeechVAD } from "./AutoSpeechVad";
import { UseCompletionReturn } from "@/types";
import { useApp } from "@/contexts";

export const Audio = ({
  micOpen,
  setMicOpen,
  enableVAD,
  setEnableVAD,
  submit,
  setState,
}: UseCompletionReturn) => {
  const { selectedSttProvider, localApiEnabled, selectedAudioDevices } =
    useApp();

  const speechProviderStatus = selectedSttProvider.provider;

  return (
    <Popover open={micOpen} onOpenChange={setMicOpen}>
      <PopoverTrigger asChild>
        {(localApiEnabled || speechProviderStatus) && enableVAD ? (
          <AutoSpeechVAD
            key={selectedAudioDevices.input.id}
            submit={submit}
            setState={setState}
            setEnableVAD={setEnableVAD}
            microphoneDeviceId={selectedAudioDevices.input.id}
          />
        ) : (
          <Button
            size="icon"
            onClick={() => {
              setEnableVAD(!enableVAD);
            }}
            className="phantom-icon-button"
            title="Voice input"
          >
            <Mic2Icon className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        className={`phantom-response-panel w-80 p-3 ${
          localApiEnabled || speechProviderStatus ? "hidden" : ""
        }`}
        sideOffset={8}
      >
        <div className="text-sm select-none">
          <div className="font-semibold text-orange-600 mb-1">
            Speech Provider Configuration Required
          </div>
          <p className="text-muted-foreground">
            {!speechProviderStatus ? (
              <>
                <div className="mt-2 flex flex-row gap-1 items-center text-orange-600">
                  <InfoIcon size={16} />
                  {selectedSttProvider.provider ? null : (
                    <p>PROVIDER IS MISSING</p>
                  )}
                </div>

                <span className="block mt-2">
                  Open Provider Matrix and configure your speech provider to
                  enable voice input.
                </span>
              </>
            ) : null}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
