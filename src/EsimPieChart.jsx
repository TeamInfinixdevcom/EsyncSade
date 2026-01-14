import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export default function EsimPieChart({ disponibles, usadas }) {
  const data = [
    { name: "Disponibles", value: disponibles },
    { name: "Usadas", value: usadas },
  ];
  const COLORS = ["#00fff7", "#ff3c2f"];

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            isAnimationActive={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => value + " eSIMs"} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
