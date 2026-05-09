import { Loader2 } from "lucide-react";
import { Input as InputComponent } from "@/components";
import { UseCompletionReturn } from "@/types";
import { MessageHistory } from "./MessageHistory";

export const Input = ({
  isLoading,
  input,
  setInput,
  handleKeyPress,
  handlePaste,
  currentConversationId,
  conversationHistory,
  startNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
  inputRef,
  isHidden,
}: UseCompletionReturn & { isHidden: boolean }) => {
  return (
    <div className="relative flex-1">
      <div className="relative select-none">
        <InputComponent
          ref={inputRef as any}
          placeholder="Ask anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          disabled={isLoading || isHidden}
          className={`phantom-command-input ${
            currentConversationId && conversationHistory.length > 0
              ? "pr-14"
              : "pr-2"
          }`}
        />

        {currentConversationId && conversationHistory.length > 0 && !isLoading && (
          <div className="absolute select-none right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <MessageHistory
              conversationHistory={conversationHistory}
              currentConversationId={currentConversationId}
              onStartNewConversation={startNewConversation}
              messageHistoryOpen={messageHistoryOpen}
              setMessageHistoryOpen={setMessageHistoryOpen}
            />
          </div>
        )}

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
};
