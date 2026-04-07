"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

interface Niche {
  id: number;
  name: string;
  icon: string;
  active: boolean;
  businessCount: number;
}

export default function NichesPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  const fetchNiches = useCallback(() => {
    fetch("/api/niches")
      .then((res) => res.json())
      .then((json) => {
        setNiches(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchNiches();
  }, [fetchNiches]);

  const toggleNiche = (id: number) => {
    setNiches((prev) =>
      prev.map((n) => (n.id === id ? { ...n, active: !n.active } : n))
    );
  };

  const deleteNiche = (id: number) => {
    setNiches((prev) => prev.filter((n) => n.id !== id));
  };

  const addNiche = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/niches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          icon: newIcon.trim() || "🏢",
        }),
      });
      if (res.ok) {
        fetchNiches();
      }
    } catch {
      // Fallback: add locally
      setNiches((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: newName.trim(),
          icon: newIcon.trim() || "🏢",
          businessCount: 0,
          active: true,
        },
      ]);
    }
    setNewName("");
    setNewIcon("");
    setModalOpen(false);
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
        <p className="text-text-muted">Er is een fout opgetreden bij het laden van de niches.</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Niches"
        description="Beheer je doelgroepen"
        action={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Niche Toevoegen
          </Button>
        }
      />

      {niches.length === 0 && (
        <p className="text-text-muted text-center py-8">Geen niches gevonden</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {niches.map((niche) => (
          <Card key={niche.id} padding="md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{niche.icon}</span>
                <div>
                  <h3 className="font-semibold text-text">{niche.name}</h3>
                  <p className="text-sm text-text-muted mt-0.5">
                    {niche.businessCount} bedrijven gevonden
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => deleteNiche(niche.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <Toggle
                checked={niche.active}
                onChange={() => toggleNiche(niche.id)}
                label={niche.active ? "Actief" : "Inactief"}
                size="sm"
              />
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setNewName(""); setNewIcon(""); }}
        title="Niche Toevoegen"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setNewName(""); setNewIcon(""); }}>
              Annuleren
            </Button>
            <Button variant="primary" onClick={addNiche}>
              Toevoegen
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Naam" placeholder="bijv. Tandartsen" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input label="Emoji icoon" placeholder="bijv. 🦷" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
