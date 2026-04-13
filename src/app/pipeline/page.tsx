"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default function PipelinePage() {
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const stopRef = useRef(false);

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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const startProcessing = useCallback(async () => {
    setProcessing(true);
    stopRef.current = false;
    setProcessLog(["Pipeline gestart - elk bedrijf wordt volledig verwerkt (alle 9 agents)..."]);
    setCompletedCount(0);

    let count = 0;
    const dailyTarget = 20;

    while (count < dailyTarget && !stopRef.current) {
      setProcessLog((prev) => [...prev, `Bedrijf ${count + 1}/${dailyTarget} oppakken...`]);

      try {
        const res = await fetch("/api/pipeline/process-next", { method: "POST" });
        const json = await res.json();

        if (!res.ok) {
          setProcessLog((prev) => [...prev, "Fout: " + (json.error || "Onbekende fout")]);
          break;
        }

        const d = json.data;

        if (d.status === "completed") {
          count++;
          setCompletedCount(count);
          const steps = (d.stepsCompleted || []).join(" > ");
          setProcessLog((prev) => [
            ...prev,
            `✅ ${d.businessName}: KLAAR! (${steps})`,
            `   ${d.completedToday}/${d.dailyLimit} vandaag verstuurd`,
          ]);
          fetchData();
        } else if (d.status === "partial") {
          setProcessLog((prev) => [
            ...prev,
            `⚠️ ${d.businessName}: gestopt bij "${d.finalStatus}" (nog niet klaar)`,
            `   Stappen: ${(d.stepsCompleted || []).join(" > ")}`,
          ]);
          fetchData();
        } else if (d.status === "error") {
          setProcessLog((prev) => [
            ...prev,
            `❌ ${d.businessName || "Onbekend"}: Fout - ${d.error}`,
            `   Stappen: ${(d.stepsCompleted || []).join(" > ")}`,
          ]);
          // Continue to next business despite error
        } else if (d.status === "idle") {
          setProcessLog((prev) => [...prev, "Geen bedrijven meer om te verwerken"]);
          break;
        } else if (d.status === "limit") {
          setProcessLog((prev) => [...prev, d.reason]);
          break;
        } else if (d.status === "inactive") {
          setProcessLog((prev) => [...prev, "Engine is niet actief - zet hem aan bij Instellingen"]);
          break;
        }
      } catch {
        setProcessLog((prev) => [...prev, "Netwerkfout - probeer opnieuw..."]);
        break;
      }
    }

    setProcessLog((prev) => [...prev, `Pipeline klaar: ${count} bedrijven volledig verwerkt`]);
    setProcessing(false);
  }, [fetchData]);

  const stopProcessing = useCallback(() => {
    stopRef.current = true;
    setProcessLog((prev) => [...prev, "Stoppen na huidig bedrijf..."]);
  }, []);

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
      <Header
        title="Pipeline"
        description="Volg de voortgang van elk bedrijf"
        action={
          processing ? (
            <Button variant="danger" onClick={stopProcessing}>
              Stop ({completedCount} klaar)
            </Button>
          ) : (
            <Button variant="primary" onClick={startProcessing}>
              Verwerken (20 bedrijven)
            </Button>
          )
        }
      />

      {processLog.length > 0 && (
        <Card padding="sm" className="mb-4">
          <div className="max-h-48 overflow-y-auto text-xs font-mono space-y-0.5">
            {processLog.map((log, i) => (
              <p key={i} className={log.startsWith("✅") ? "text-green-600" : log.startsWith("❌") ? "text-red-500" : "text-text-secondary"}>
                {log}
              </p>
            ))}
            {processing && (
              <p className="text-primary animate-pulse">Bezig met verwerken...</p>
            )}
          </div>
        </Card>
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
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-340px)] pr-1">
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
