"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Gmail
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");

  // GitHub
  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  // Locatie & Bereik
  const [location, setLocation] = useState("Nederland");
  const [radius, setRadius] = useState(50);

  // Automatisering
  const [autoSend, setAutoSend] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(20);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((json) => {
        const data = json.data;
        if (data) {
          setGmailConnected(!!data.gmailRefreshToken);
          setConnectedEmail(data.gmailEmail ?? "");
          setGithubToken(data.githubToken ?? "");
          setGithubRepo(data.githubRepo ?? "");
          setLocation(data.defaultLocation ?? "Nederland");
          setRadius(data.defaultRadiusKm ?? 50);
          setAutoSend(data.autoMode ?? false);
          setDailyLimit(data.dailyLimit ?? 20);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubToken,
          githubRepo,
          defaultLocation: location,
          defaultRadiusKm: radius,
          autoMode: autoSend,
          dailyLimit,
        }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Instellingen opgeslagen!" });
      } else {
        setSaveMessage({ type: "error", text: "Fout bij het opslaan." });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Fout bij het opslaan." });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleGmailConnect = async () => {
    try {
      const res = await fetch("/api/auth/gmail");
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } catch {
      // ignore
    }
  };

  const handleGmailDisconnect = async () => {
    setGmailConnected(false);
    setConnectedEmail("");
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailRefreshToken: null, gmailEmail: null }),
    });
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
        <p className="text-text-muted">Er is een fout opgetreden bij het laden van de instellingen.</p>
      </div>
    );
  }

  return (
    <div>
      <Header title="Instellingen" description="Configureer je outreach app" />

      <div className="space-y-6">
        {/* Gmail */}
        <Card>
          <CardHeader title="Gmail Verbinding" description="Koppel je Gmail account voor het versturen van mails" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {gmailConnected ? (
                <>
                  <Badge variant="success">Verbonden</Badge>
                  <span className="text-sm text-text">{connectedEmail}</span>
                </>
              ) : (
                <Badge variant="danger">Niet verbonden</Badge>
              )}
            </div>
            {gmailConnected ? (
              <Button variant="danger" size="sm" onClick={handleGmailDisconnect}>Ontkoppel</Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleGmailConnect}>Verbind Gmail</Button>
            )}
          </div>
        </Card>

        {/* GitHub */}
        <Card>
          <CardHeader title="GitHub" description="Configureer je GitHub integratie voor demo websites" />
          <div className="space-y-4">
            <Input label="Personal Access Token" type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
            <Input label="Repository" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="solidmotion/demo-sites" />
          </div>
        </Card>

        {/* Locatie */}
        <Card>
          <CardHeader title="Locatie & Bereik" description="Stel de standaard locatie en zoekradius in" />
          <div className="space-y-4">
            <Input label="Standaard locatie" value={location} onChange={(e) => setLocation(e.target.value)} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text">Radius: {radius} km</label>
              <input
                type="range" min={5} max={100} step={5} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-text-muted">
                <span>5 km</span><span>100 km</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Automatisering */}
        <Card>
          <CardHeader title="Automatisering" description="Instellingen voor automatisch mailen" />
          <div className="space-y-4">
            <Toggle
              checked={autoSend}
              onChange={setAutoSend}
              label="Automatisch versturen"
              description="Mails worden direct verstuurd in plaats van als draft opgeslagen"
            />
            <Input label="Dagelijks limiet" type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} min={1} max={50} />
          </div>
        </Card>

        {/* API Kosten */}
        <Card>
          <CardHeader title="API Kosten" description="Geschatte dagelijkse kosten" />
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-text">Claude API</span>
              <span className="text-sm font-medium text-text">{"\u20AC"}9,00/dag</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-text">Google Places</span>
              <span className="text-sm font-medium text-text">{"\u20AC"}0,80/dag</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-semibold text-text">Totaal</span>
              <span className="text-sm font-semibold text-text">{"\u20AC"}9,80/dag</span>
            </div>
            <p className="text-xs text-text-muted">Gebaseerd op {dailyLimit} bedrijven per dag</p>
          </div>
        </Card>

        {/* Opslaan */}
        <div className="flex items-center gap-4">
          <Button variant="primary" className="w-full sm:w-auto" onClick={handleSave} loading={saving}>
            Opslaan
          </Button>
          {saveMessage && (
            <span className={`text-sm ${saveMessage.type === "success" ? "text-success" : "text-danger"}`}>
              {saveMessage.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
