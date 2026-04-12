import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export default function EsimPieChart({ disponibles, usadas }) {
  const data = [
    { name: "Disponibles", value: disponibles },
    { name: "Usadas", value: usadas },
  ];
  const COLORS = ["#00fff7", "#ff3c2f"];

  if (disponibles + usadas === 0) {
    return (
      <div style={{ width: "100%", height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#00fff7" }}>
        Sin datos para graficar
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 250 }}>
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
          <Tooltip formatter={(value) => value + " eSIMs"} />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
