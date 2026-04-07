"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";

type Status =
  | "discovered"
  | "researching"
  | "designing"
  | "copywriting"
  | "reviewing"
  | "ready"
  | "sent"
  | "replied"
  | "converted"
  | "rejected";

type WebsiteQuality = "none" | "poor" | "decent" | "good";

interface Business {
  id: number;
  name: string;
  nicheName: string | null;
  nicheId: number | null;
  city: string | null;
  websiteQuality: WebsiteQuality | null;
  status: Status;
  email: string | null;
  responseStatus: string | null;
  updatedAt: string;
}

const statusLabels: Record<Status, string> = {
  discovered: "Ontdekt",
  researching: "Onderzoeken",
  designing: "Ontwerpen",
  copywriting: "Copywriting",
  reviewing: "Beoordelen",
  ready: "Klaar",
  sent: "Verstuurd",
  replied: "Beantwoord",
  converted: "Geconverteerd",
  rejected: "Afgewezen",
};

const statusVariants: Record<Status, "default" | "primary" | "success" | "warning" | "danger" | "outline"> = {
  discovered: "outline",
  researching: "primary",
  designing: "primary",
  copywriting: "primary",
  reviewing: "warning",
  ready: "success",
  sent: "default",
  replied: "success",
  converted: "success",
  rejected: "danger",
};

const websiteVariants: Record<string, "default" | "success" | "warning" | "danger"> = {
  none: "danger",
  poor: "warning",
  decent: "default",
  good: "success",
};

const websiteLabels: Record<string, string> = {
  none: "Geen",
  poor: "Slecht",
  decent: "Redelijk",
  good: "Goed",
};

const statusOptions = [
  { value: "", label: "Alle statussen" },
  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
];

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [nicheOptions, setNicheOptions] = useState<{ value: string; label: string }[]>([
    { value: "", label: "Alle niches" },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nicheFilter, setNicheFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stadFilter, setStadFilter] = useState("");
  const [radius, setRadius] = useState(25);
  const [scanning, setScanning] = useState(false);

  const fetchBusinesses = useCallback(() => {
    const params = new URLSearchParams();
    if (nicheFilter) params.set("nicheId", nicheFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (stadFilter) params.set("city", stadFilter);

    fetch(`/api/businesses?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setBusinesses(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [nicheFilter, statusFilter, stadFilter]);

  useEffect(() => {
    fetch("/api/niches")
      .then((res) => res.json())
      .then((json) => {
        const niches = json.data ?? [];
        setNicheOptions([
          { value: "", label: "Alle niches" },
          ...niches.map((n: { id: number; name: string }) => ({
            value: String(n.id),
            label: n.name,
          })),
        ]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBusinesses();
  }, [fetchBusinesses]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetch("/api/pipeline/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchBusinesses();
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Naam",
      render: (b: Business) => <span className="font-semibold text-text">{b.name}</span>,
    },
    {
      key: "nicheName",
      header: "Niche",
      render: (b: Business) => b.nicheName ? <Badge variant="primary">{b.nicheName}</Badge> : <span className="text-text-muted">-</span>,
    },
    { key: "city", header: "Stad", render: (b: Business) => <span>{b.city ?? "-"}</span> },
    {
      key: "websiteQuality",
      header: "Website",
      render: (b: Business) => {
        const q = b.websiteQuality ?? "none";
        return <Badge variant={websiteVariants[q] ?? "default"}>{websiteLabels[q] ?? q}</Badge>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (b: Business) => (
        <Badge variant={statusVariants[b.status]}>{statusLabels[b.status]}</Badge>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (b: Business) => <span className="text-text-secondary">{b.email ?? "-"}</span>,
    },
    {
      key: "responseStatus",
      header: "Response",
      render: (b: Business) =>
        b.responseStatus ? <Badge variant="outline">{b.responseStatus}</Badge> : <span className="text-text-muted">-</span>,
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
        <p className="text-text-muted">Er is een fout opgetreden bij het laden van de bedrijven.</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Bedrijven"
        description="Alle gevonden bedrijven"
        action={
          <Button variant="primary" onClick={handleScan} loading={scanning}>
            Scannen
          </Button>
        }
      />

      <Card padding="md" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <Select
            label="Niche"
            options={nicheOptions}
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
          />
          <Select
            label="Status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Input
            label="Stad"
            placeholder="Zoek op stad..."
            value={stadFilter}
            onChange={(e) => setStadFilter(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Radius: {radius} km</label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-primary h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-text-muted">
              <span>5 km</span>
              <span>100 km</span>
            </div>
          </div>
        </div>
      </Card>

      <Table<Business>
        columns={columns}
        data={businesses}
        emptyMessage="Geen bedrijven gevonden met deze filters"
      />
    </div>
  );
}
