"use client";

import { InputMode } from "@/lib/types";
import { GlowPanel } from "@/components/ui/primitives";
import { useDataSource } from "@/hooks/useDataSource";
import { InputModeToggle } from "./InputModeToggle";
import { FileUploadPanel } from "./FileUploadPanel";
import { WebSocketPanel } from "./WebSocketPanel";
import { useLanguage } from "@/hooks/useLanguageContext";

export function DataInputPanel({
  mode,
  onModeChange,
  dataSource,
}: {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  dataSource: ReturnType<typeof useDataSource>;
}) {
  const { t } = useLanguage();
  return (
    <GlowPanel glow="cyan" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">{t("dash.dataInput")}</h2>
        <InputModeToggle value={mode} onChange={onModeChange} />
      </div>

      {mode === "file" && (
        <FileUploadPanel
          result={dataSource.fileIngestion.result}
          isPlaying={dataSource.fileIngestion.isPlaying}
          onFile={dataSource.fileIngestion.loadFile}
          onPasteText={dataSource.fileIngestion.loadPastedText}
          onTogglePlay={() => dataSource.fileIngestion.setIsPlaying((p) => !p)}
        />
      )}

      {mode === "websocket" && (
        <WebSocketPanel
          url={dataSource.webSocket.url}
          onUrlChange={dataSource.webSocket.setUrl}
          connectionState={dataSource.webSocket.connectionState}
          lastError={dataSource.webSocket.lastError}
          onConnect={dataSource.webSocket.connect}
          onDisconnect={dataSource.webSocket.disconnect}
        />
      )}
    </GlowPanel>
  );
}
