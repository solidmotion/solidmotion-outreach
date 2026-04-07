"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/layout/stats-cards";
import { Card, CardHeader } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [recentActivity, setRecentActivity] = useState<
    { id: number; agentName: string; status: string; createdAt: string; businessId: number }[]
  >([]);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch("/api/pipeline").then((res) => res.json()),
      fetch("/api/settings").then((res) => res.json()),
    ])
      .then(([pipelineRes, settingsRes]) => {
        const pipeline = pipelineRes.data;
        const settingsData = settingsRes.data;

        if (pipeline?.overview) {
          setByStatus(pipeline.overview.byStatus ?? {});
          setTotal(pipeline.overview.total ?? 0);
        }
        if (pipeline?.recentActivity) {
          setRecentActivity(pipeline.recentActivity);
        }
        if (settingsData) {
          setIsRunning(settingsData.active ?? false);
          setIsAutoMode(settingsData.autoMode ?? false);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleRunning = async (value: boolean) => {
    setIsRunning(value);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: value }),
      });
    } catch {
      setIsRunning(!value);
    }
  };

  const handleToggleAutoMode = async (value: boolean) => {
    setIsAutoMode(value);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoMode: value }),
      });
    } catch {
      setIsAutoMode(!value);
    }
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
        <p className="text-text-muted">
          Er is een fout opgetreden bij het laden van de data.
        </p>
      </div>
    );
  }

  const inPipeline =
    (byStatus.researching ?? 0) +
    (byStatus.designing ?? 0) +
    (byStatus.copywriting ?? 0) +
    (byStatus.reviewing ?? 0);
  const sent = byStatus.sent ?? 0;
  const replied = byStatus.replied ?? 0;
  const responseRate =
    sent + replied > 0 ? Math.round((replied / (sent + replied)) * 100) : 0;

  const agentVariants: Record<string, "primary" | "warning" | "success" | "danger" | "default"> = {
    scrape: "default",
    "research-1": "primary",
    "research-2": "primary",
    "design-1": "warning",
    "design-2": "warning",
    "copywrite-1": "success",
    "copywrite-2": "success",
    manager: "danger",
    secretary: "default",
  };

  const stats = [
    {
      label: "Totaal Gevonden",
      value: total,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      label: "In Pipeline",
      value: inPipeline,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      ),
    },
    {
      label: "Mails Verstuurd",
      value: sent,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <Header title="Dashboard" description="Overzicht van je outreach activiteiten" />
      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card padding="lg">
          <CardHeader title="Automatisering" description="Beheer de outreach agents" />
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-surface-hover">
              <div>
                <p className="font-semibold text-text">Outreach Engine</p>
                <p className="text-sm text-text-muted mt-0.5">
                  {isRunning ? "Agents zijn actief en verwerken bedrijven" : "Alle agents zijn gestopt"}
                </p>
              </div>
              <Toggle checked={isRunning} onChange={handleToggleRunning} size="lg" />
            </div>
            <div className="pl-1">
              <Toggle
                checked={isAutoMode}
                onChange={handleToggleAutoMode}
                size="md"
                label="Volledig automatisch"
                description={
                  isAutoMode
                    ? "Mails worden direct verstuurd"
                    : "Mails komen als draft in je Gmail"
                }
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? "bg-success animate-pulse" : "bg-text-muted"}`} />
              <span className="text-text-secondary">
                Status:{" "}
                <span className="font-medium text-text">
                  {isRunning ? (isAutoMode ? "Actief - Automatisch" : "Actief - Semi-automatisch") : "Gestopt"}
                </span>
              </span>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Recente Activiteit" description="Laatste acties van de agents" />
          <div className="space-y-4">
            {recentActivity.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">Geen recente activiteit</p>
            )}
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span className="text-xs text-text-muted whitespace-nowrap pt-0.5 min-w-[90px]">
                  {new Date(item.createdAt).toLocaleString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                <Badge variant={agentVariants[item.agentName] ?? "default"}>
                  {item.agentName}
                </Badge>
                <span className="text-sm text-text-secondary">
                  {item.status === "success" ? "Voltooid" : "Fout"} voor bedrijf #{item.businessId}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
