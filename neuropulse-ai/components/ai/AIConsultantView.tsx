import { DiagnosticsSummary } from "./DiagnosticsSummary";
import { AIChatInterface } from "./AIChatInterface";

export function AIConsultantView() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DiagnosticsSummary insights={[]} />
      <AIChatInterface />
    </div>
  );
}
