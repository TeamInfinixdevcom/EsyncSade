import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import "./esim-radar.css";

export default function UsimPieChart({ usadas, devueltas }) {
  const total = usadas + devueltas;
  const hasData = total > 0;
  const data = [
    { name: "Usadas", value: usadas },
    { name: "Devueltas", value: devueltas },
  ];
  const COLORS = ["#ff0040", "#ff3c2f"];

  const disponibilidadRatio = total === 0 ? 0 : usadas / total;
  const usoRatio = total === 0 ? 0 : devueltas / total;
  const sweepDuration = `${Math.max(3.6, 8.2 - usoRatio * 4.8).toFixed(2)}s`;
  const pulseDuration = `${Math.max(1.6, 3.8 - disponibilidadRatio * 1.8).toFixed(2)}s`;
  const signalStrength = Number((0.35 + disponibilidadRatio * 0.6).toFixed(2));

  const blips = useMemo(() => {
    const safeTotal = Math.max(1, total);
    const count = Math.min(24, Math.max(6, Math.round(Math.log2(safeTotal + 1) * 4)));
    const seed = usadas * 37 + devueltas * 19 + safeTotal * 13;

    return Array.from({ length: count }, (_, index) => {
      const normalizedNoise = Math.abs(Math.sin(seed + index * 12.9898));
      const angle = (index / count) * Math.PI * 2 + normalizedNoise * 0.65;
      const distance = 0.16 + (((index * 7) % count) / count) * 0.72;
      const x = 50 + Math.cos(angle) * distance * 40;
      const y = 50 + Math.sin(angle) * distance * 40;
      const size = 3 + ((index + safeTotal) % 3);
      const delay = (index % 7) * 0.28;
      const variant = (index + devueltas) % 5 === 0 ? "is-used" : "is-available";

      return {
        id: `${index}-${Math.round(x)}-${Math.round(y)}`,
        x,
        y,
        size,
        delay,
        variant,
      };
    });
  }, [usadas, devueltas, total]);

  const radarStyle = {
    "--sweep-duration": sweepDuration,
    "--pulse-duration": pulseDuration,
    "--signal-strength": signalStrength,
  };

  return (
    <div className="esim-radar" style={radarStyle}>
      <div className="esim-radar__readout">
        <span>SCAN RATE {12 + total * 2} HZ</span>
        <span>SIGNAL {Math.round(signalStrength * 100)}%</span>
        <span>LOCK ACT {Math.round(disponibilidadRatio * 100)}%</span>
      </div>

      <div className="esim-radar__hud" aria-hidden="true">
        <div className="esim-radar__sweep" />
        <div className="esim-radar__pulse" />
        <div className="esim-radar__ring esim-radar__ring--outer" />
        <div className="esim-radar__ring esim-radar__ring--mid" />
        <div className="esim-radar__ring esim-radar__ring--inner" />
        <div className="esim-radar__ring esim-radar__ring--core" />
        <div className="esim-radar__crosshair esim-radar__crosshair--x" />
        <div className="esim-radar__crosshair esim-radar__crosshair--y" />

        {blips.map((blip) => (
          <span
            key={blip.id}
            className={`esim-radar__blip ${blip.variant}`}
            style={{
              left: `${blip.x}%`,
              top: `${blip.y}%`,
              width: `${blip.size}px`,
              height: `${blip.size}px`,
              animationDelay: `${blip.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="esim-radar__chart-layer">
        {hasData ? (
          <ResponsiveContainer>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 16 }}>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={82}
                fill="#8884d8"
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={true}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${value} uSIMs`}
                contentStyle={{
                  background: "#091317",
                  border: "1px solid #ff004066",
                  borderRadius: 8,
                  color: "#ffe0e8",
                }}
                itemStyle={{ color: "#ffe0e8" }}
                labelStyle={{ color: "#ffb0c0" }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="esim-radar__empty">Sin datos para graficar</div>
        )}
      </div>
    </div>
  );
}
