"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { VolatilitySurface } from "@/components/volatility-surface";
import { fetchSurface, type SurfaceResponse } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [ticker, setTicker] = useState("AAPL");
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surfaceData, setSurfaceData] = useState<SurfaceResponse | null>(null);

  const handleFetch = useCallback(
    async (t?: string, ot?: "call" | "put") => {
      const useTicker = t ?? ticker;
      const useOptionType = ot ?? optionType;

      if (!useTicker.trim()) {
        setError("Please enter a ticker symbol");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchSurface(useTicker, useOptionType);
        setSurfaceData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setSurfaceData(null);
      } finally {
        setLoading(false);
      }
    },
    [ticker, optionType],
  );

  const handleToggleType = (type: "call" | "put") => {
    setOptionType(type);
    if (surfaceData) {
      handleFetch(undefined, type);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {/* Header + Controls */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Volatility Surface
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Implied volatility via Black-Scholes inversion
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="w-32">
              <label className="text-[11px] font-medium mb-1 block text-muted-foreground uppercase tracking-wider">
                Ticker
              </label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="AAPL"
                className="h-9 font-mono uppercase text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium mb-1 block text-muted-foreground uppercase tracking-wider">
                Type
              </label>
              <div className="flex h-9 rounded-md border border-input overflow-hidden">
                <button
                  onClick={() => handleToggleType("call")}
                  className={`px-3 text-xs font-medium transition-colors ${
                    optionType === "call"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Calls
                </button>
                <button
                  onClick={() => handleToggleType("put")}
                  className={`px-3 text-xs font-medium transition-colors ${
                    optionType === "put"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Puts
                </button>
              </div>
            </div>

            <Button
              onClick={() => handleFetch()}
              disabled={loading}
              className="h-9"
              size="sm"
            >
              {loading && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {loading ? "Building…" : "Build"}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/5 px-4 py-2.5">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Stats bar */}
        {surfaceData && !loading && (
          <div className="flex items-center gap-6 mb-4 px-1 text-sm">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>
                <span className="text-foreground font-mono font-medium">
                  {surfaceData.ticker}
                </span>
              </span>
              <span className="text-border">|</span>
              <span>
                Spot{" "}
                <span className="text-foreground font-mono">
                  ${surfaceData.spot_price.toFixed(2)}
                </span>
              </span>
              <span className="text-border">|</span>
              <span>
                Rate{" "}
                <span className="text-foreground font-mono">
                  {(surfaceData.risk_free_rate * 100).toFixed(2)}%
                </span>
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="text-foreground font-mono">
                  {surfaceData.data_points.toLocaleString()}
                </span>{" "}
                points
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="text-foreground font-mono">
                  {surfaceData.expirations.length}
                </span>{" "}
                expirations
              </span>
            </div>
          </div>
        )}

        {/* Surface */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading && (
            <div className="p-6">
              <Skeleton className="h-[600px] w-full rounded-lg" />
            </div>
          )}

          {surfaceData && !loading && (
            <VolatilitySurface
              data={surfaceData.surface_data}
              ticker={surfaceData.ticker}
              optionType={surfaceData.option_type as "call" | "put"}
              spotPrice={surfaceData.spot_price}
            />
          )}

          {!surfaceData && !loading && !error && (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground text-sm">
              Enter a ticker and click Build to generate the surface
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
