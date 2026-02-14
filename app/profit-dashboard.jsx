"use client";

import { useState, useMemo } from "react";

// ─── Theme (matches ClearView Wipers app) ───
const t = {
  primary: "#0D47A1",
  primaryLight: "#1976D2",
  accent: "#00BCD4",
  success: "#2E7D32",
  successLight: "#43A047",
  warning: "#E65100",
  danger: "#C62828",
  bg: "#F5F7FA",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textLight: "#6B7280",
  border: "#E5E7EB",
  radius: "14px",
  shadow: "0 2px 12px rgba(0,0,0,0.06)",
  font: "'DM Sans', sans-serif",
};

const fmt = (n) => Number(n).toFixed(2);
const fmtPct = (n) => (n * 100).toFixed(1) + "%";
const getWeek = (dateStr) => {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
};
const getMonthLabel = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

function MiniBarChart({ data, height = 120, barColor = t.primary, accentColor = t.success }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.revenue || 0, d.profit || 0, 1)));

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", width: "100%", gap: "2px" }}>
            <div style={{
              width: "100%", borderRadius: "4px 4px 0 0",
              background: `linear-gradient(180deg, ${barColor}dd, ${barColor})`,
              height: `${Math.max(4, (d.revenue / maxVal) * 100)}%`,
              transition: "height 0.4s ease",
              position: "relative",
            }}>
              {d.profit > 0 && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: `${(d.profit / d.revenue) * 100}%`,
                  background: accentColor,
                  borderRadius: "0 0 0 0",
                  opacity: 0.7,
                }} />
              )}
            </div>
          </div>
          <span style={{ fontSize: "9px", color: t.textLight, fontWeight: "600", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ value, total, size = 80, strokeWidth = 8, color = t.success }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? value / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={t.border} strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: t.card, borderRadius: t.radius, padding: "16px",
      boxShadow: t.shadow, border: `1px solid ${t.border}`,
      borderTop: `3px solid ${color || t.primary}`,
    }}>
      <div style={{ fontSize: "11px", fontWeight: "700", color: t.textLight, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
        {icon && <span style={{ marginRight: "4px" }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: "800", color: color || t.text }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: t.textLight, marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

export default function ProfitDashboard({
  jobs = [],
  inventory = {},
  expenses = [],
  onExpenseAdded,
}) {
  const [timeRange, setTimeRange] = useState("all");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [localExpenses, setLocalExpenses] = useState([]);
  const expenseList = onExpenseAdded ? expenses : localExpenses;
  const [newExpense, setNewExpense] = useState({ description: "", amount: "", date: "", category: "transport" });

  const metrics = useMemo(() => {
    const completed = jobs.filter(j => j.status === "completed");
    const now = new Date();
    const filtered = completed.filter(j => {
      if (timeRange === "all") return true;
      const d = new Date(j.completedAt);
      if (timeRange === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      if (timeRange === "month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const filteredExpenses = expenseList.filter(e => {
      if (timeRange === "all") return true;
      const d = new Date(e.date);
      if (timeRange === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      if (timeRange === "month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const totalRevenue = filtered.reduce((s, j) => s + (j.price || 0), 0);
    const totalBladeCost = filtered.reduce((s, j) => s + (j.bladeCosts || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const grossProfit = totalRevenue - totalBladeCost;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    const netMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
    const avgProfitPerJob = filtered.length > 0 ? grossProfit / filtered.length : 0;
    const avgRevenuePerJob = filtered.length > 0 ? totalRevenue / filtered.length : 0;

    const withMargin = filtered.map(j => ({
      ...j,
      profit: (j.price || 0) - (j.bladeCosts || 0),
      margin: j.price > 0 ? ((j.price - (j.bladeCosts || 0)) / j.price) : 0,
    })).sort((a, b) => b.margin - a.margin);

    const bestJob = withMargin[0] || null;
    const worstJob = withMargin[withMargin.length - 1] || null;

    const weeklyMap = {};
    completed.forEach(j => {
      const weekNum = getWeek(j.completedAt);
      const key = `W${weekNum}`;
      if (!weeklyMap[key]) weeklyMap[key] = { label: key, revenue: 0, profit: 0, jobs: 0 };
      weeklyMap[key].revenue += j.price || 0;
      weeklyMap[key].profit += (j.price || 0) - (j.bladeCosts || 0);
      weeklyMap[key].jobs++;
    });
    const weeklyData = Object.values(weeklyMap).slice(-8);

    const bladeSizeMap = {};
    completed.forEach(j => {
      j.blades?.forEach(b => {
        if (!bladeSizeMap[b.size]) bladeSizeMap[b.size] = { size: b.size, count: 0, totalCost: 0 };
        bladeSizeMap[b.size].count++;
        const unitCost = inventory[b.size]?.unitCost ?? 7;
        bladeSizeMap[b.size].totalCost += unitCost;
      });
    });
    const bladeBreakdown = Object.values(bladeSizeMap).sort((a, b) => b.count - a.count);

    const inventoryValue = Object.entries(inventory).reduce((s, [size, data]) => {
      const qty = typeof data === "object" ? data.qty : data;
      const cost = typeof data === "object" ? (data.unitCost ?? 7) : 7;
      return s + (qty * cost);
    }, 0);

    const pipeline = jobs.filter(j => j.status === "pending" || j.status === "scheduled");
    const pipelineRevenue = pipeline.reduce((s, j) => s + (j.price || 0), 0);

    return {
      filtered, totalRevenue, totalBladeCost, totalExpenses,
      grossProfit, netProfit, grossMargin, netMargin,
      avgProfitPerJob, avgRevenuePerJob,
      bestJob, worstJob, weeklyData,
      bladeBreakdown, inventoryValue, pipelineRevenue,
      totalJobs: filtered.length, pipelineJobs: pipeline.length,
    };
  }, [jobs, inventory, expenseList, timeRange]);

  const addExpense = () => {
    if (!newExpense.description || !newExpense.amount) return;
    const expense = {
      id: "e" + Date.now(),
      ...newExpense,
      amount: parseFloat(newExpense.amount),
      date: newExpense.date || new Date().toISOString().split("T")[0],
    };
    if (onExpenseAdded) {
      onExpenseAdded(expense);
    } else {
      setLocalExpenses(prev => [...prev, expense]);
    }
    setNewExpense({ description: "", amount: "", date: "", category: "transport" });
    setShowExpenseForm(false);
  };

  return (
    <div style={{ fontFamily: t.font, background: t.bg, minHeight: "100vh" }}>
      <div style={{
        background: "linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #1B5E20 100%)",
        padding: "24px 20px 20px", color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <span style={{ fontSize: "22px" }}>📊</span>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800" }}>Profit Tracker</h1>
        </div>
        <p style={{ margin: "4px 0 0 32px", fontSize: "13px", opacity: 0.8 }}>
          {metrics.totalJobs} completed jobs · {metrics.pipelineJobs} in pipeline
        </p>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" },
          ].map(f => (
            <button key={f.id} onClick={() => setTimeRange(f.id)} style={{
              flex: 1, padding: "10px 12px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
              border: "none", cursor: "pointer", fontFamily: t.font,
              background: timeRange === f.id ? t.primary : "white",
              color: timeRange === f.id ? "white" : t.text,
              boxShadow: timeRange === f.id ? "0 2px 8px rgba(13,71,161,0.3)" : t.shadow,
              transition: "all 0.2s",
            }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <StatCard label="Revenue" value={`$${fmt(metrics.totalRevenue)}`} icon="💰" color={t.primary}
            sub={`${metrics.totalJobs} jobs`} />
          <StatCard label="Net Profit" value={`$${fmt(metrics.netProfit)}`} icon="✨" color={t.success}
            sub={`${fmtPct(metrics.netMargin)} margin`} />
          <StatCard label="Blade Costs" value={`$${fmt(metrics.totalBladeCost)}`} icon="🔧" color={t.warning}
            sub={`Avg $${metrics.totalJobs > 0 ? fmt(metrics.totalBladeCost / metrics.totalJobs) : "0"}/job`} />
          <StatCard label="Other Expenses" value={`$${fmt(metrics.totalExpenses)}`} icon="📋" color={t.danger}
            sub="Gas, flyers, etc." />
        </div>

        <div style={{
          background: "white", borderRadius: t.radius, padding: "18px",
          boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: "16px",
        }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Profit Breakdown
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ position: "relative" }}>
              <DonutChart value={metrics.netProfit} total={Math.max(metrics.totalRevenue, 1)} color={t.success} />
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "16px", fontWeight: "800", color: t.success }}>{fmtPct(metrics.netMargin)}</div>
                <div style={{ fontSize: "9px", color: t.textLight }}>net</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {[
                { label: "Revenue", val: metrics.totalRevenue, color: t.primary },
                { label: "− Blade costs", val: metrics.totalBladeCost, color: t.warning },
                { label: "− Expenses", val: metrics.totalExpenses, color: t.danger },
                { label: "= Net profit", val: metrics.netProfit, color: t.success, bold: true },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 0",
                  borderTop: row.bold ? `2px solid ${t.border}` : "none",
                  marginTop: row.bold ? "4px" : 0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: row.color }} />
                    <span style={{ fontSize: "13px", fontWeight: row.bold ? "800" : "500", color: row.bold ? t.text : t.textLight }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: row.bold ? "800" : "600", color: row.color }}>
                    ${fmt(row.val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          background: "white", borderRadius: t.radius, padding: "18px",
          boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: "16px",
        }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Per-Job Averages
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: "800", color: t.primary }}>${fmt(metrics.avgRevenuePerJob)}</div>
              <div style={{ fontSize: "11px", color: t.textLight, fontWeight: "600" }}>Avg Charge</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: "800", color: t.success }}>${fmt(metrics.avgProfitPerJob)}</div>
              <div style={{ fontSize: "11px", color: t.textLight, fontWeight: "600" }}>Avg Profit</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: "800", color: t.accent }}>{fmtPct(metrics.grossMargin)}</div>
              <div style={{ fontSize: "11px", color: t.textLight, fontWeight: "600" }}>Gross Margin</div>
            </div>
          </div>
        </div>

        {metrics.weeklyData.length > 1 && (
          <div style={{
            background: "white", borderRadius: t.radius, padding: "18px",
            boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: "16px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Weekly Trend
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: t.primary }} />
                <span style={{ fontSize: "11px", color: t.textLight }}>Revenue</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: t.success, opacity: 0.7 }} />
                <span style={{ fontSize: "11px", color: t.textLight }}>Profit</span>
              </div>
            </div>
            <MiniBarChart data={metrics.weeklyData} />
          </div>
        )}

        {metrics.bestJob && metrics.worstJob && metrics.totalJobs >= 2 && (
          <div style={{
            background: "white", borderRadius: t.radius, padding: "18px",
            boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: "16px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Best & Worst Margin Jobs
            </div>
            {[
              { label: "🏆 Best", job: metrics.bestJob, color: t.success },
              { label: "⚠️ Worst", job: metrics.worstJob, color: t.warning },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: "10px", marginBottom: i === 0 ? "8px" : 0,
                background: i === 0 ? "#E8F5E9" : "#FFF3E0",
              }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: t.text }}>{item.job.customerName}</div>
                  <div style={{ fontSize: "11px", color: t.textLight }}>
                    {item.job.blades?.map(b => b.size).join(" + ")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: item.color }}>
                    {fmtPct(item.job.margin)}
                  </div>
                  <div style={{ fontSize: "11px", color: t.textLight }}>
                    ${fmt(item.job.profit)} profit on ${item.job.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {metrics.bladeBreakdown.length > 0 && (
          <div style={{
            background: "white", borderRadius: t.radius, padding: "18px",
            boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: "16px",
          }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Blade Size Breakdown
            </div>
            <div style={{ fontSize: "11px", color: t.textLight, marginBottom: "10px" }}>
              Which sizes you use most — helps with bulk ordering
            </div>
            {metrics.bladeBreakdown.map((b, i) => {
              const maxCount = metrics.bladeBreakdown[0]?.count || 1;
              const unitCost = inventory[b.size]?.unitCost ?? 7;
              return (
                <div key={i} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700" }}>{b.size}</span>
                    <span style={{ fontSize: "12px", color: t.textLight }}>
                      {b.count} used · ${fmt(unitCost)}/ea · ${fmt(b.totalCost)} total
                    </span>
                  </div>
                  <div style={{ background: t.border, borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "4px",
                      background: `linear-gradient(90deg, ${t.primary}, ${t.accent})`,
                      width: `${(b.count / maxCount) * 100}%`,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          background: "linear-gradient(135deg, #1A237E, #283593)", borderRadius: t.radius, padding: "18px",
          boxShadow: "0 4px 20px rgba(26,35,126,0.2)", marginBottom: "16px", color: "white",
        }}>
          <div style={{ fontSize: "13px", fontWeight: "700", opacity: 0.7, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Business Snapshot
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800" }}>${fmt(metrics.inventoryValue)}</div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Inventory Value</div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800" }}>${fmt(metrics.pipelineRevenue)}</div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Pipeline Revenue</div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800" }}>${fmt(metrics.netProfit)}</div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Earned So Far</div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800" }}>
                ${fmt(metrics.netProfit + metrics.pipelineRevenue)}
              </div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Projected Total</div>
            </div>
          </div>
        </div>

        <div style={{
          background: "white", borderRadius: t.radius, padding: "18px",
          boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: "16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Other Expenses
            </div>
            <button onClick={() => setShowExpenseForm(!showExpenseForm)} style={{
              background: showExpenseForm ? "#FFEBEE" : "#E3F2FD",
              color: showExpenseForm ? t.danger : t.primary,
              border: "none", borderRadius: "8px", padding: "6px 12px",
              fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: t.font,
            }}>
              {showExpenseForm ? "Cancel" : "+ Add"}
            </button>
          </div>

          {showExpenseForm && (
            <div style={{
              background: "#F8FAFC", borderRadius: "10px", padding: "14px", marginBottom: "12px",
              border: `1px solid ${t.border}`,
            }}>
              <input placeholder="What was it for?" value={newExpense.description}
                onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                style={{
                  width: "100%", padding: "10px 12px", border: `2px solid ${t.border}`,
                  borderRadius: "8px", fontSize: "14px", fontFamily: t.font, marginBottom: "8px",
                  outline: "none", boxSizing: "border-box",
                }} />
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input placeholder="Amount" type="number" value={newExpense.amount}
                  onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                  style={{
                    flex: 1, padding: "10px 12px", border: `2px solid ${t.border}`,
                    borderRadius: "8px", fontSize: "14px", fontFamily: t.font, outline: "none",
                  }} />
                <input type="date" value={newExpense.date}
                  onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                  style={{
                    flex: 1, padding: "10px 12px", border: `2px solid ${t.border}`,
                    borderRadius: "8px", fontSize: "14px", fontFamily: t.font, outline: "none",
                  }} />
              </div>
              <select value={newExpense.category}
                onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                style={{
                  width: "100%", padding: "10px 12px", border: `2px solid ${t.border}`,
                  borderRadius: "8px", fontSize: "14px", fontFamily: t.font, marginBottom: "10px",
                  outline: "none", boxSizing: "border-box", background: "white",
                }}>
                <option value="transport">🚗 Gas / Transport</option>
                <option value="marketing">📄 Flyers / Marketing</option>
                <option value="supplies">🧰 Supplies / Tools</option>
                <option value="other">📋 Other</option>
              </select>
              <button onClick={addExpense} style={{
                width: "100%", padding: "10px", borderRadius: "8px", border: "none",
                background: t.primary, color: "white", fontSize: "14px", fontWeight: "700",
                cursor: "pointer", fontFamily: t.font,
              }}>
                Add Expense
              </button>
            </div>
          )}

          {expenseList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: t.textLight, fontSize: "13px" }}>
              No expenses tracked yet. Add gas, flyers, or other costs.
            </div>
          ) : (
            expenseList.slice().reverse().map((e, i) => (
              <div key={e.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0",
                borderBottom: i < expenseList.length - 1 ? `1px solid ${t.border}` : "none",
              }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>{e.description}</div>
                  <div style={{ fontSize: "11px", color: t.textLight }}>
                    {e.date ? new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} · {e.category}
                  </div>
                </div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: t.danger }}>
                  −${fmt(e.amount)}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{
          background: "white", borderRadius: t.radius, padding: "18px",
          boxShadow: t.shadow, border: `1px solid ${t.border}`,
        }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: t.textLight, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Completed Job Profits
          </div>
          {metrics.filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: t.textLight, fontSize: "13px" }}>
              No completed jobs in this time range
            </div>
          ) : (
            metrics.filtered.slice().reverse().map((j, i) => {
              const profit = (j.price || 0) - (j.bladeCosts || 0);
              const margin = j.price > 0 ? profit / j.price : 0;
              return (
                <div key={j.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < metrics.filtered.length - 1 ? `1px solid ${t.border}` : "none",
                }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "600" }}>{j.customerName}</div>
                    <div style={{ fontSize: "11px", color: t.textLight }}>
                      {j.blades?.map(b => b.size).join(", ")} · {j.completedAt ? new Date(j.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: t.textLight, textDecoration: "line-through" }}>${j.price}</span>
                      <span style={{ fontSize: "15px", fontWeight: "800", color: t.success }}>${fmt(profit)}</span>
                    </div>
                    <div style={{
                      fontSize: "10px", fontWeight: "700",
                      color: margin >= 0.4 ? t.success : margin >= 0.3 ? t.warning : t.danger,
                    }}>
                      {fmtPct(margin)} margin
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
