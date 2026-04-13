"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Business {
  id: number;
  name: string;
  nicheName: string | null;
  status: string;
  updatedAt: string;
}

interface ColumnData {
  status: string;
  label: string;
  color: string;
  businesses: {
    id: number;
    name: string;
    niche: string;
    nicheVariant: "default" | "primary" | "success" | "warning" | "danger" | "outline";
    timeInStage: string;
  }[];
}

const columnConfig = [
  { status: "discovered", label: "Ontdekt", color: "bg-primary" },
  { status: "researching", label: "Onderzoek", color: "bg-[var(--color-warning)]" },
  { status: "designing", label: "Design", color: "bg-[var(--color-secondary)]" },
  { status: "copywriting", label: "Copywriting", color: "bg-[var(--color-success)]" },
  { status: "reviewing", label: "Review", color: "bg-[var(--color-danger)]" },
  { status: "ready", label: "Klaar", color: "bg-primary" },
  { status: "sent", label: "Verstuurd", color: "bg-[var(--color-text-muted)]" },
  { status: "replied", label: "Beantwoord", color: "bg-[var(--color-success)]" },
];

const nicheVariants: ("default" | "primary" | "success" | "warning" | "danger" | "outline")[] = [
  "primary", "success", "warning", "danger", "outline", "default",
];

function getNicheVariant(niche: string): "default" | "primary" | "success" | "warning" | "danger" | "outline" {
  let hash = 0;
  for (let i = 0; i < niche.length; i++) {
    hash = niche.charCodeAt(i) + ((hash << 5) - hash);
  }
  return nicheVariants[Math.abs(hash) % nicheVariants.length];
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

export default function PipelinePage() {
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const stopRef = useRef(false);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [{ time, message, type }, ...prev]);
  };

  const fetchData = useCallback(() => {
    fetch("/api/businesses?limit=200")
      .then((res) => res.json())
      .then((json) => {
        const businessList: Business[] = json.data ?? [];
        const grouped: ColumnData[] = columnConfig.map((col) => {
          const matching = businessList.filter((b) => b.status === col.status);
          return {
            ...col,
            businesses: matching.map((b) => ({
              id: b.id,
              name: b.name,
              niche: b.nicheName ?? "Onbekend",
              nicheVariant: getNicheVariant(b.nicheName ?? ""),
              timeInStage: formatTimeAgo(b.updatedAt),
            })),
          };
        });
        setColumns(grouped);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const processBusinesses = async () => {
    setProcessing(true);
    stopRef.current = false;
    setLogs([]);
    setCompletedCount(0);

    const TARGET = 20;
    let completed = 0;

    addLog(`Start verwerking van ${TARGET} bedrijven...`, "info");

    for (let i = 0; i < TARGET; i++) {
      if (stopRef.current) {
        addLog("Verwerking gestopt door gebruiker.", "warning");
        break;
      }

      addLog(`Zoek bedrijf ${i + 1}/${TARGET}...`, "info");

      // Keep calling process-next for the same business until it reaches terminal status
      let businessName = "";
      let businessId: number | null = null;
      let stepCount = 0;
      const MAX_STEPS = 15; // Safety limit

      while (stepCount < MAX_STEPS) {
        if (stopRef.current) break;

        try {
          const res = await fetch("/api/pipeline/process-next", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(businessId ? { businessId } : {}),
          });

          const json = await res.json();

          if (!res.ok) {
            addLog(`Fout: ${json.error ?? "Onbekende fout"}`, "error");
            break;
          }

          const data = json.data;

          // No more businesses to process
          if (data.status === "idle") {
            addLog("Geen bedrijven meer om te verwerken.", "warning");
            stopRef.current = true;
            break;
          }

          // Track which business we're working on
          if (!businessId) {
            businessId = data.businessId;
          }
          if (!businessName && data.businessId) {
            // Fetch business name
            businessName = `#${data.businessId}`;
          }

          stepCount++;
          const icon = data.success ? "✅" : "❌";
          addLog(
            `${icon} ${businessName} — ${data.agentName} → ${data.newStatus}`,
            data.success ? "success" : "error"
          );

          // Refresh pipeline view
          fetchData();

          // Check if done (terminal status)
          if (data.terminal) {
            completed++;
            setCompletedCount(completed);
            addLog(
              `🎉 ${businessName} volledig verwerkt! (${completed}/${TARGET})`,
              "success"
            );
            break;
          }

          // If there was an error, move on to next business
          if (!data.success) {
            addLog(
              `⚠️ ${businessName} overgeslagen wegens fout.`,
              "warning"
            );
            break;
          }
        } catch (err) {
          addLog(
            `Netwerkfout: ${err instanceof Error ? err.message : "Onbekend"}`,
            "error"
          );
          break;
        }
      }

      if (stepCount >= MAX_STEPS) {
        addLog(
          `⚠️ ${businessName} — maximaal aantal stappen bereikt, ga door met volgende.`,
          "warning"
        );
      }

      // Reset for next business
      businessId = null;
      businessName = "";
    }

    addLog(
      `Klaar! ${completed} bedrijven volledig verwerkt.`,
      completed > 0 ? "success" : "warning"
    );
    setProcessing(false);
    fetchData();
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted">Er is een fout opgetreden bij het laden van de pipeline.</p>
      </div>
    );
  }

  return (
    <div>
      <Header title="Pipeline" description="Volg de voortgang van elk bedrijf" />

      <div className="flex items-center gap-3 mb-4">
        {!processing ? (
          <button
            onClick={processBusinesses}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Verwerken (20 bedrijven)
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Stoppen
          </button>
        )}
        {processing && (
          <span className="text-sm text-text-muted">
            {completedCount}/20 bedrijven klaar...
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mb-4 bg-surface border border-border rounded-lg p-3 max-h-60 overflow-y-auto">
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="text-xs font-mono flex gap-2">
                <span className="text-text-muted shrink-0">{log.time}</span>
                <span
                  className={
                    log.type === "error"
                      ? "text-red-500"
                      : log.type === "success"
                        ? "text-green-500"
                        : log.type === "warning"
                          ? "text-yellow-500"
                          : "text-text-muted"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-2 px-2 pb-4">
        <div className="inline-flex gap-4 min-w-full">
          {columns.map((col) => (
            <div key={col.status} className="flex flex-col w-72 shrink-0">
              <div className="mb-3">
                <div className={`h-1.5 rounded-full ${col.color} mb-3`} />
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text">{col.label}</h3>
                  <Badge variant="outline">{col.businesses.length}</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-350px)] pr-1">
                {col.businesses.map((biz) => (
                  <Card key={biz.id} padding="sm">
                    <p className="text-sm font-medium text-text">{biz.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant={biz.nicheVariant}>{biz.niche}</Badge>
                      <span className="text-xs text-text-muted">{biz.timeInStage}</span>
                    </div>
                  </Card>
                ))}
                {col.businesses.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-8">Geen bedrijven</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
