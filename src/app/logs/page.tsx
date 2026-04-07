"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";

const AGENT_NAMES = [
  "scrape", "research-1", "research-2", "design-1",
  "copywrite-1", "design-2", "copywrite-2", "manager", "secretary",
];

const agentOptions = [
  { value: "", label: "Alle agents" },
  ...AGENT_NAMES.map((name) => ({ value: name, label: name })),
];

const statusOptions = [
  { value: "", label: "Alle" },
  { value: "success", label: "Succes" },
  { value: "error", label: "Fout" },
];

type AgentType = "scrape" | "research" | "design" | "copywrite" | "manager" | "secretary";

function getAgentType(agent: string): AgentType {
  if (agent === "scrape") return "scrape";
  if (agent.startsWith("research")) return "research";
  if (agent.startsWith("design")) return "design";
  if (agent.startsWith("copywrite")) return "copywrite";
  if (agent === "manager") return "manager";
  return "secretary";
}

const agentBadgeVariant: Record<AgentType, "default" | "primary" | "success" | "warning" | "danger" | "outline"> = {
  scrape: "default",
  research: "primary",
  design: "warning",
  copywrite: "success",
  manager: "danger",
  secretary: "outline",
};

const modelBadgeVariant: Record<string, "default" | "primary" | "warning" | "outline"> = {
  haiku: "outline",
  sonnet: "primary",
  opus: "warning",
};

interface LogEntry {
  id: number;
  businessId: number | null;
  businessName: string | null;
  agentName: string;
  modelUsed: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costCents: string | null;
  durationMs: number | null;
  status: string;
  createdAt: string;
}

function formatTokens(count: number | null): string {
  if (count == null) return "-";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cents: string | null): string {
  if (cents == null) return "-";
  const val = parseFloat(cents) / 100;
  return `\u20AC${val.toFixed(4)}`;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchLogs = useCallback(() => {
    const params = new URLSearchParams();
    if (agentFilter) params.set("agentName", agentFilter);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/logs?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setLogs(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [agentFilter, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      key: "createdAt",
      header: "Tijdstip",
      className: "whitespace-nowrap",
      render: (log: LogEntry) => (
        <span className="text-text-secondary">
          {new Date(log.createdAt).toLocaleString("nl-NL", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "agentName",
      header: "Agent",
      render: (log: LogEntry) => (
        <Badge variant={agentBadgeVariant[getAgentType(log.agentName)]}>
          {log.agentName}
        </Badge>
      ),
    },
    {
      key: "businessName",
      header: "Bedrijf",
      render: (log: LogEntry) => (
        <span className="font-medium text-text">{log.businessName ?? `#${log.businessId}`}</span>
      ),
    },
    {
      key: "modelUsed",
      header: "Model",
      render: (log: LogEntry) => {
        const model = log.modelUsed ?? "unknown";
        // Extract short name from model ID
        const short = model.includes("haiku") ? "haiku" : model.includes("sonnet") ? "sonnet" : model.includes("opus") ? "opus" : model;
        return <Badge variant={modelBadgeVariant[short] ?? "default"}>{short}</Badge>;
      },
    },
    {
      key: "tokens",
      header: "Tokens",
      render: (log: LogEntry) => (
        <span className="text-text-secondary">
          {formatTokens(log.tokensIn)} / {formatTokens(log.tokensOut)}
        </span>
      ),
    },
    {
      key: "costCents",
      header: "Kosten",
      render: (log: LogEntry) => (
        <span className="text-text-secondary">{formatCost(log.costCents)}</span>
      ),
    },
    {
      key: "durationMs",
      header: "Duur",
      render: (log: LogEntry) => (
        <span className="text-text-secondary">{formatDuration(log.durationMs)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (log: LogEntry) => (
        <Badge variant={log.status === "success" ? "success" : log.status === "error" ? "danger" : "warning"}>
          {log.status === "success" ? "Succes" : log.status === "error" ? "Fout" : log.status}
        </Badge>
      ),
    },
  ];

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
        <p className="text-text-muted">Er is een fout opgetreden bij het laden van de logs.</p>
      </div>
    );
  }

  return (
    <div>
      <Header title="Agent Logs" description="Bekijk de activiteiten van alle agents" />

      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select label="Agent" options={agentOptions} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} />
          <Select label="Status" options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
          <Input label="Van datum" type="date" disabled />
          <Input label="Tot datum" type="date" disabled />
        </div>
      </Card>

      <Table<LogEntry> columns={columns} data={logs} emptyMessage="Geen logs gevonden" />
    </div>
  );
}
