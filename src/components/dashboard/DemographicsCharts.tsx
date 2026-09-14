"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export type NamedCount = { name: string; value: number };

const COLORS = [
  "#fe214f",
  "#0040a8",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">{children}</div>
      </CardContent>
    </Card>
  );
}

export function DemographicsCharts({
  gender,
  ageBands,
  departments,
  employmentStatus,
  tenureBands,
  maritalStatus,
  offices,
}: {
  gender: NamedCount[];
  ageBands: NamedCount[];
  departments: NamedCount[];
  employmentStatus: NamedCount[];
  tenureBands: NamedCount[];
  maritalStatus: NamedCount[];
  offices: NamedCount[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Gender">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gender}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label
            >
              {gender.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Status Pernikahan">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={maritalStatus}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label
            >
              {maritalStatus.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Lokasi Kantor">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={offices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label
            >
              {offices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Status Kepegawaian">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={employmentStatus}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={90}
              label
            >
              {employmentStatus.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Kelompok Umur">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ageBands}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="value" fill="#fe214f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Masa Kerja">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tenureBands}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="value" fill="#0040a8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Departemen</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tinggi dinamis + interval={0} agar semua nama departemen tampil */}
            <div style={{ height: Math.max(256, departments.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departments}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    fontSize={12}
                    interval={0}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#e60840" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
