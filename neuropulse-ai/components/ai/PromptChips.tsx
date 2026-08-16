export function PromptChips({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((prompt) => (
        <button
          key={prompt}
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="glass-pill rounded-full border-neural/25 px-3 py-1.5 text-xs text-neural transition-all duration-300 hover:border-neural/50 hover:bg-neural/15 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
