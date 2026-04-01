"use client";

import dynamic from "next/dynamic";
import type { SurfaceDataPoint } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <Skeleton className="h-[600px] w-full rounded-lg" />,
});

interface VolatilitySurfaceProps {
  data: SurfaceDataPoint[];
  ticker: string;
  optionType: "call" | "put";
  spotPrice: number;
}

export function VolatilitySurface({
  data,
  ticker,
  optionType,
  spotPrice,
}: VolatilitySurfaceProps) {
  const dteSet = [...new Set(data.map((d) => d.dte))].sort((a, b) => a - b);
  const strikeSet = [...new Set(data.map((d) => d.strike))].sort(
    (a, b) => a - b,
  );

  const ivMap = new Map<string, number>();
  for (const d of data) {
    ivMap.set(`${d.dte}-${d.strike}`, d.iv);
  }

  // Build raw matrix (rows = strikes, cols = DTEs)
  const zRaw: (number | null)[][] = strikeSet.map((strike) =>
    dteSet.map((dte) => {
      const iv = ivMap.get(`${dte}-${strike}`);
      return iv !== undefined ? Math.round(iv * 10000) / 10000 : null;
    }),
  );

  // Drop rows (strikes) and columns (DTEs) that have no data at all
  const validStrikeIdx = zRaw
    .map((row, i) => (row.some((v) => v !== null) ? i : -1))
    .filter((i) => i >= 0);
  const zPruned = validStrikeIdx.map((i) => zRaw[i]);

  const validDteIdx = dteSet
    .map((_, j) => (zPruned.some((row) => row[j] !== null) ? j : -1))
    .filter((j) => j >= 0);

  const filteredDteSet = validDteIdx.map((j) => dteSet[j]);
  const filteredStrikeSet = validStrikeIdx.map((i) => strikeSet[i]);
  const zSparse = zPruned.map((row) => validDteIdx.map((j) => row[j]));

  // Linear interpolation within a 1-D array; forward/backward-fill edges.
  function interpolateRow(row: (number | null)[]): number[] {
    const out = [...row] as (number | null)[];
    const first = out.findIndex((v) => v !== null);
    if (first === -1) return out.map(() => 0);
    for (let i = 0; i < first; i++) out[i] = out[first];
    let prev = first;
    for (let i = first + 1; i < out.length; i++) {
      if (out[i] !== null) {
        const gap = i - prev;
        for (let k = prev + 1; k < i; k++) {
          out[k] = out[prev]! + (out[i]! - out[prev]!) * ((k - prev) / gap);
        }
        prev = i;
      }
    }
    for (let i = prev + 1; i < out.length; i++) out[i] = out[prev];
    return out as number[];
  }

  // Interpolate rows (across DTEs for each strike)
  const zRowInterp = zSparse.map(interpolateRow);

  // Interpolate columns (across strikes for each DTE) to fill remaining gaps
  const cols = zRowInterp[0]?.length ?? 0;
  for (let j = 0; j < cols; j++) {
    const col = zRowInterp.map((row) => row[j] ?? null);
    const filledCol = interpolateRow(col);
    for (let i = 0; i < zRowInterp.length; i++) {
      zRowInterp[i][j] = filledCol[i];
    }
  }

  // Light 1-D Gaussian-ish smoothing pass along each row to reduce jaggedness
  function smooth(row: number[], passes = 2): number[] {
    let cur = [...row];
    for (let p = 0; p < passes; p++) {
      const next = [...cur];
      for (let i = 1; i < cur.length - 1; i++) {
        next[i] = cur[i - 1] * 0.2 + cur[i] * 0.6 + cur[i + 1] * 0.2;
      }
      cur = next;
    }
    return cur;
  }

  const z = zRowInterp.map((row) => smooth(row, 2));

  return (
    <Plot
      data={[
        {
          type: "surface",
          x: filteredDteSet,
          y: filteredStrikeSet,
          z: z,
          colorscale: [
            [0, "#0d47a1"],
            [0.2, "#1565c0"],
            [0.4, "#1e88e5"],
            [0.5, "#42a5f5"],
            [0.6, "#ffa726"],
            [0.8, "#ef5350"],
            [1, "#b71c1c"],
          ],
          colorbar: {
            title: { text: "IV", font: { color: "#71717a", size: 11 } },
            tickfont: { color: "#71717a", size: 10 },
            tickformat: ".0%",
            thickness: 14,
            len: 0.6,
            outlinewidth: 0,
          },
          hovertemplate:
            "DTE: %{x}d<br>Strike: $%{y:,.0f}<br>IV: %{z:.2%}<extra></extra>",
          lighting: {
            ambient: 0.7,
            diffuse: 0.6,
            specular: 0.15,
            roughness: 0.5,
          },
          contours: {
            z: {
              show: true,
              usecolormap: true,
              highlightcolor: "#ffffff20",
              project: { z: false },
            },
          },
        } as Record<string, unknown>,
      ]}
      layout={{
        autosize: true,
        height: 620,
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
          family: "Inter, system-ui, sans-serif",
          color: "#71717a",
          size: 11,
        },
        title: {
          text: `${ticker} ${optionType === "call" ? "Calls" : "Puts"} — $${spotPrice.toFixed(2)}`,
          font: { size: 13, color: "#a1a1aa" },
          x: 0.02,
          xanchor: "left",
        },
        scene: {
          xaxis: {
            title: { text: "DTE", font: { size: 11 } },
            gridcolor: "#27272a",
            zerolinecolor: "#27272a",
            showbackground: false,
          },
          yaxis: {
            title: { text: "Strike", font: { size: 11 } },
            gridcolor: "#27272a",
            zerolinecolor: "#27272a",
            tickprefix: "$",
            tickformat: ",",
            showbackground: false,
          },
          zaxis: {
            title: { text: "IV", font: { size: 11 } },
            gridcolor: "#27272a",
            zerolinecolor: "#27272a",
            tickformat: ".0%",
            showbackground: false,
          },
          bgcolor: "rgba(0,0,0,0)",
          camera: {
            eye: { x: 1.6, y: -1.6, z: 1.0 },
            center: { x: 0, y: 0, z: -0.1 },
          },
        },
        margin: { l: 0, r: 0, t: 36, b: 0 },
      }}
      config={{
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: [
          "toImage",
          "sendDataToCloud",
          "resetCameraLastSave3d",
        ],
      }}
      useResizeHandler
      className="w-full"
    />
  );
}
