"use client";

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./lib/firebase";
import { WIPER_SIZES_DB } from "./data/wiper-sizes-db";
import ProfitDashboard from "./profit-dashboard";

const MAKES = [
  "Acura","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","Fiat","Ford",
  "Genesis","GMC","Honda","Hyundai","Infiniti","Jaguar","Jeep","Kia","Land Rover","Lexus",
  "Lincoln","Mazda","Mercedes","Mini","Mitsubishi","Nissan","Porsche","RAM","Subaru",
  "Tesla","Toyota","Volkswagen","Volvo"
];

const YEARS = Array.from({length: 30}, (_, i) => (2026 - i).toString());

const generateId = () => Math.random().toString(36).substring(2, 10);

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** Street-only address for cards (e.g. "7337 Earl Ave NW" from full Nominatim string). */
const simpleAddress = (addr) => {
  if (!addr || typeof addr !== "string") return "";
  const first = addr.split(",")[0].trim();
  return first || addr;
};

const STATUS_COLORS = {
  pending: { bg: "#FFF3E0", text: "#E65100", label: "Pending" },
  scheduled: { bg: "#E3F2FD", text: "#1565C0", label: "Scheduled" },
  completed: { bg: "#E8F5E9", text: "#2E7D32", label: "Completed" },
};

const DEMO_CUSTOMERS = [
  { id: "demo1", name: "Sarah Johnson", phone: "555-0123", email: "sarah@example.com", address: "142 Oak Street", vehicles: [{ make: "Toyota", model: "Camry", year: "2021", wiperSizes: { driver: '26"', passenger: '18"', rear: null } }], createdAt: new Date().toISOString() },
  { id: "demo2", name: "Mike Chen", phone: "555-0456", email: "mike@example.com", address: "88 Elm Avenue", vehicles: [{ make: "Honda", model: "CR-V", year: "2020", wiperSizes: { driver: '26"', passenger: '17"', rear: '12"' } }], createdAt: new Date().toISOString() },
];
const DEMO_JOBS = [
  { id: "j1", customerId: "demo1", customerName: "Sarah Johnson", vehicleIndex: 0, status: "scheduled", scheduledDate: "2026-02-15", blades: [{ size: '26"', position: "Driver" }, { size: '18"', position: "Passenger" }], createdAt: new Date().toISOString(), price: 35 },
  { id: "j2", customerId: "demo2", customerName: "Mike Chen", vehicleIndex: 0, status: "pending", scheduledDate: null, blades: [{ size: '26"', position: "Driver" }, { size: '17"', position: "Passenger" }, { size: '12"', position: "Rear" }], createdAt: new Date().toISOString(), price: 45 },
];
const DEMO_INVENTORY = {
  '12"': 4, '14"': 3, '16"': 5, '17"': 6, '18"': 8, '19"': 4,
  '20"': 3, '21"': 2, '22"': 5, '24"': 4, '25"': 2, '26"': 10, '28"': 3,
};

// Normalize model string for flexible matching (e.g. "F 250", "F250" -> "f250")
function normalizeModelForMatch(s) {
  if (!s || typeof s !== "string") return "";
  return s.trim().toLowerCase().replace(/[\s-]/g, "");
}

function lookupWiperSizes(make, model) {
  if (!make || !model) return null;
  const makeTrim = make.trim();
  const modelTrim = model.trim();
  const key = `${makeTrim}_${modelTrim}`;
  const keyLower = key.toLowerCase();
  // 1. Exact match (case-insensitive)
  let entry = Object.entries(WIPER_SIZES_DB).find(
    ([k]) => k.toLowerCase() === keyLower
  );
  if (entry) return entry[1];
  // 2. Normalized match: same make, model matches when spaces/dashes ignored (e.g. F250 <-> F-250)
  const normalizedInput = normalizeModelForMatch(modelTrim);
  if (!normalizedInput) return null;
  entry = Object.entries(WIPER_SIZES_DB).find(([k]) => {
    const [dbMake, ...modelParts] = k.split("_");
    const dbModel = modelParts.join("_");
    return (
      dbMake.toLowerCase() === makeTrim.toLowerCase() &&
      normalizeModelForMatch(dbModel) === normalizedInput
    );
  });
  return entry ? entry[1] : null;
}

// Get all known model strings for a make from the DB (keys are "Make_Model")
function getModelsForMake(make) {
  if (!make || !make.trim()) return [];
  const m = make.trim().toLowerCase();
  const models = [];
  const seen = new Set();
  Object.keys(WIPER_SIZES_DB).forEach((key) => {
    const i = key.indexOf("_");
    if (i === -1) return;
    const dbMake = key.slice(0, i);
    const dbModel = key.slice(i + 1);
    if (dbMake.toLowerCase() === m && dbModel && !seen.has(dbModel)) {
      seen.add(dbModel);
      models.push(dbModel);
    }
  });
  return models.sort((a, b) => a.localeCompare(b));
}

// Filter models for current make by typed input; return up to 8 suggestions
function getModelSuggestions(make, modelInput) {
  const models = getModelsForMake(make);
  const q = (modelInput || "").trim().toLowerCase();
  if (!q) return models.slice(0, 8);
  return models
    .filter((model) => model.toLowerCase().includes(q))
    .slice(0, 8);
}

const SEATTLE_VIEWBOX = "-122.44,47.50,-122.15,47.73"; // min_lon, min_lat, max_lon, max_lat

async function geocodeAddress(address) {
  const q = (address || "").trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&viewbox=${SEATTLE_VIEWBOX}&bounded=1`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "ClearViewWipers/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  const { lat, lon, display_name } = data[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon), displayName: display_name };
}

async function fetchAddressSuggestions(query) {
  const q = (query || "").trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&viewbox=${SEATTLE_VIEWBOX}&bounded=1`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "ClearViewWipers/1.0" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data || !Array.isArray(data)) return [];
  return data.map((d) => ({
    displayName: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  }));
}

// ─── Icon Components ───
const Icons = {
  Home: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Users: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Clipboard: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  Box: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 001 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Camera: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Check: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Car: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a1 1 0 00-.9.55l-2.18 4.37a1 1 0 00-.11.73L3 16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>,
  Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Droplet: () => <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>,
  Calendar: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Chart: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
};

// ─── Themes ───
const themeLight = {
  primary: "#0D47A1",
  primaryLight: "#1976D2",
  primaryDark: "#0A3680",
  accent: "#00BCD4",
  success: "#2E7D32",
  warning: "#E65100",
  bg: "#F5F7FA",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textLight: "#6B7280",
  border: "#E5E7EB",
  radius: "14px",
  shadow: "0 2px 12px rgba(0,0,0,0.06)",
};

const themeDark = {
  primary: "#42A5F5",
  primaryLight: "#64B5F6",
  primaryDark: "#1E88E5",
  accent: "#26C6DA",
  success: "#66BB6A",
  warning: "#FFA726",
  bg: "#1A1A2E",
  card: "#2D2D44",
  text: "#F5F7FA",
  textLight: "#9CA3AF",
  border: "#374151",
  radius: "14px",
  shadow: "0 2px 16px rgba(0,0,0,0.3)",
};

const ThemeContext = createContext(themeLight);

const baseBtn = {
  border: "none",
  borderRadius: "12px",
  padding: "14px 24px",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  transition: "all 0.15s ease",
  fontFamily: "'DM Sans', sans-serif",
};

// ─── Components ───
function StatusBadge({ status }) {
  const s = STATUS_COLORS[status];
  return (
    <span style={{
      background: s.bg, color: s.text, fontSize: "12px", fontWeight: "700",
      padding: "4px 12px", borderRadius: "20px", letterSpacing: "0.5px",
      textTransform: "uppercase",
    }}>
      {s.label}
    </span>
  );
}

function Input({ label, ...props }) {
  const theme = useContext(ThemeContext) || themeLight;
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.textLight, marginBottom: "6px", letterSpacing: "0.3px" }}>{label}</label>}
      <input {...props} style={{
        width: "100%", padding: "12px 14px", border: `2px solid ${theme.border}`,
        borderRadius: "10px", fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
        outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
        background: theme.card, color: theme.text,
        ...(props.style || {}),
      }} onFocus={e => e.target.style.borderColor = theme.primaryLight}
         onBlur={e => e.target.style.borderColor = theme.border} />
    </div>
  );
}

function Select({ label, options, placeholder, ...props }) {
  const theme = useContext(ThemeContext) || themeLight;
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.textLight, marginBottom: "6px", letterSpacing: "0.3px" }}>{label}</label>}
      <select {...props} style={{
        width: "100%", padding: "12px 14px", border: `2px solid ${theme.border}`,
        borderRadius: "10px", fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
        outline: "none", background: theme.card, color: theme.text, cursor: "pointer", boxSizing: "border-box",
        ...(props.style || {}),
      }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Card({ children, style, onClick }) {
  const theme = useContext(ThemeContext) || themeLight;
  return (
    <div onClick={onClick} style={{
      background: theme.card, borderRadius: theme.radius, padding: "18px",
      boxShadow: theme.shadow, border: `1px solid ${theme.border}`,
      cursor: onClick ? "pointer" : "default",
      transition: "transform 0.15s, box-shadow 0.15s",
      ...style,
    }}
    onMouseEnter={e => { if(onClick) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; }}}
    onMouseLeave={e => { if(onClick) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = theme.shadow; }}}
    >
      {children}
    </div>
  );
}

function TopBar({ title, onBack, rightAction }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px",
      background: "linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)",
      color: "white", position: "sticky", top: 0, zIndex: 100,
    }}>
      {onBack && (
        <button type="button" onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "10px", padding: "8px", cursor: "pointer", display: "flex" }}>
          <Icons.Back />
        </button>
      )}
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", fontFamily: "'DM Sans', sans-serif", flex: 1 }}>{title}</h2>
      {rightAction}
    </div>
  );
}

function BottomNav({ active, setView, userRole }) {
  const theme = useContext(ThemeContext) || themeLight;
  const allTabs = [
    { id: "home", icon: Icons.Home, label: "Home" },
    { id: "calendar", icon: Icons.Calendar, label: "Calendar" },
    { id: "customers", icon: Icons.Users, label: "Customers" },
    { id: "jobs", icon: Icons.Clipboard, label: "Jobs" },
    { id: "inventory", icon: Icons.Box, label: "Inventory" },
    { id: "profits", icon: Icons.Chart, label: "Profits" },
  ];
  const tabs = userRole === "employee" ? allTabs.filter((t) => t.id === "home" || t.id === "jobs") : allTabs;
  return (
    <div style={{
      display: "flex", justifyContent: "space-around", background: theme.card,
      borderTop: `1px solid ${theme.border}`, padding: "8px 0 12px",
      position: "sticky", bottom: 0, zIndex: 100,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
            color: isActive ? theme.primary : theme.textLight,
            transition: "color 0.2s",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "6px 16px", borderRadius: "16px",
              background: isActive ? "#E3F2FD" : "transparent",
              transition: "background 0.2s",
            }}>
              <t.icon />
            </div>
            <span style={{ fontSize: "11px", fontWeight: isActive ? "700" : "500" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Login (when Firebase Auth is enabled) ───
function LoginView() {
  const theme = useContext(ThemeContext) || themeLight;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };
  const inputStyle = { padding: "12px 16px", border: `2px solid ${theme.border}`, borderRadius: "10px", fontSize: "15px", fontFamily: "'DM Sans', sans-serif", background: theme.card, color: theme.text };
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", background: theme.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "24px", fontWeight: "700", color: theme.text, marginBottom: "24px", textAlign: "center" }}>ClearView Wipers</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          {error && <p style={{ color: theme.warning, fontSize: "14px", margin: 0 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ ...baseBtn, padding: "14px", background: theme.primary, color: "white", fontSize: "16px" }}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── PIN modal (unlock admin when not using Firebase login) ───
function PinModal({ show, onClose, onUnlock }) {
  const theme = useContext(ThemeContext) || themeLight;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const configured = (process.env.NEXT_PUBLIC_ADMIN_PIN || "1313").trim();
    if (pin.trim() === configured) {
      onUnlock();
      onClose();
      setPin("");
    } else {
      setError("Wrong PIN");
    }
  };
  const handleCancel = () => {
    setPin("");
    setError("");
    onClose();
  };
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={handleCancel}>
      <div style={{ background: theme.card, borderRadius: "14px", padding: "24px", width: "90%", maxWidth: "320px", boxShadow: theme.shadow, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700", color: theme.text }}>Unlock admin</h3>
        <form onSubmit={handleSubmit}>
          <input type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} autoFocus
            style={{ width: "100%", padding: "12px 16px", border: `2px solid ${theme.border}`, borderRadius: "10px", fontSize: "16px", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: theme.bg, color: theme.text, caretColor: theme.text, WebkitTextFillColor: theme.text }} />
          {error && <p style={{ color: theme.warning, fontSize: "14px", margin: "8px 0 0" }}>{error}</p>}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button type="button" onClick={handleCancel} style={{ ...baseBtn, flex: 1, padding: "12px", background: theme.border, color: theme.text }}>Cancel</button>
            <button type="submit" style={{ ...baseBtn, flex: 1, padding: "12px", background: theme.primary, color: "white" }}>Unlock</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main App ───
const ADMIN_UNLOCKED_KEY = "adminUnlocked";

export default function WiperBladeApp() {
  const [isDark, setIsDark] = useState(false);
  const [view, setView] = useState("home");
  const [userRole, setUserRole] = useState("employee"); // Same on server and client to avoid hydration mismatch; updated in useEffect from sessionStorage/Firestore or !auth
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false); // false on first paint so server and client match (avoid hydration mismatch when auth exists on client)
  const [showPinModal, setShowPinModal] = useState(false);
  const [mounted, setMounted] = useState(false); // defer auth/db-dependent UI until after mount so server and client initial HTML match (avoid hydration mismatch)

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(m.matches);
    const listener = (e) => setIsDark(e.matches);
    m.addEventListener("change", listener);
    return () => m.removeEventListener("change", listener);
  }, []);

  const theme = isDark ? themeDark : themeLight;
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [inventory, setInventory] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [subView, setSubView] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [photoIdentifying, setPhotoIdentifying] = useState(false);

  // Auth: when signed in, load role from Firestore users/{uid}; when no auth restore from sessionStorage or employee; when auth but no user use sessionStorage
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      setUserRole(typeof sessionStorage !== "undefined" && sessionStorage.getItem(ADMIN_UNLOCKED_KEY) === "true" ? "admin" : "employee");
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user && db) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.data();
          setUserRole(data?.role === "employee" ? "employee" : "admin");
        } catch (e) {
          console.warn("Failed to load user role", e);
          setUserRole("admin");
        }
      } else {
        setUserRole(sessionStorage.getItem(ADMIN_UNLOCKED_KEY) === "true" ? "admin" : "employee");
      }
    });
    return () => unsub();
  }, []);

  // Firestore: load or seed demo data; subscribe when db is available
  useEffect(() => {
    if (!db) {
      setCustomers(DEMO_CUSTOMERS);
      setJobs(DEMO_JOBS);
      setInventory(DEMO_INVENTORY);
      setFirestoreReady(true);
      return;
    }
    const unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubJobs = onSnapshot(collection(db, "jobs"), (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubInventory = onSnapshot(doc(db, "data", "inventory"), (snap) => {
      setInventory(snap.data()?.counts || DEMO_INVENTORY);
    });
    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    setFirestoreReady(true);
    return () => {
      unsubCustomers();
      unsubJobs();
      unsubInventory();
      unsubExpenses();
    };
  }, []);

  // Write helpers: persist to Firestore when db is set, else update local state only
  const addCustomer = useCallback((customer) => {
    if (db) setDoc(doc(db, "customers", customer.id), customer);
    else setCustomers((prev) => [...prev, customer]);
  }, []);
  const updateCustomer = useCallback((updatedCustomer) => {
    if (db) setDoc(doc(db, "customers", updatedCustomer.id), updatedCustomer);
    else setCustomers((prev) => prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)));
  }, []);
  const updateJobsCustomerName = useCallback(async (customerId, customerName) => {
    if (db) {
      const q = query(collection(db, "jobs"), where("customerId", "==", customerId));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => updateDoc(doc(db, "jobs", d.id), { customerName }));
    } else {
      setJobs((prev) => prev.map((j) => (j.customerId === customerId ? { ...j, customerName } : j)));
    }
  }, []);
  const addJob = useCallback((job) => {
    if (db) setDoc(doc(db, "jobs", job.id), job);
    else setJobs((prev) => [...prev, job]);
  }, []);
  const updateJob = useCallback((updatedJob) => {
    if (db) setDoc(doc(db, "jobs", updatedJob.id), updatedJob);
    else setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  }, []);
  const writeInventory = useCallback((counts) => {
    if (db) setDoc(doc(db, "data", "inventory"), { counts });
    else setInventory(counts);
  }, []);
  const addExpenseToFirestore = useCallback((expense) => {
    if (db) setDoc(doc(db, "expenses", expense.id), expense);
    else setExpenses((prev) => [...prev, expense]);
  }, []);

  const pendingJobs = jobs.filter(j => j.status === "pending");
  const scheduledJobs = jobs.filter(j => j.status === "scheduled");
  const completedJobs = jobs.filter(j => j.status === "completed");

  // Profit dashboard: inventory as { size: { qty, unitCost } }, jobs with bladeCosts
  const inventoryForDashboard = useMemo(() =>
    Object.fromEntries(
      Object.entries(inventory).map(([size, qty]) => [size, { qty, unitCost: 7 }])
    ),
    [inventory]
  );
  const jobsWithBladeCosts = useMemo(() =>
    jobs.map(j => ({
      ...j,
      bladeCosts: j.bladeCosts ?? j.blades?.reduce(
        (sum, b) => sum + (inventoryForDashboard[b.size]?.unitCost ?? 7),
        0
      ) ?? 0,
    })),
    [jobs, inventoryForDashboard]
  );

  // Calculate what blades are needed for pending + scheduled jobs
  const bladesNeeded = {};
  [...pendingJobs, ...scheduledJobs].forEach(j => {
    j.blades.forEach(b => {
      bladesNeeded[b.size] = (bladesNeeded[b.size] || 0) + 1;
    });
  });

  const nav = (v, sub = null, item = null) => {
    if (userRole === "employee" && ["calendar", "customers", "inventory", "profits"].includes(v)) {
      setView("home");
      setSubView(null);
      setSelectedItem(null);
      return;
    }
    setView(v);
    setSubView(sub);
    setSelectedItem(item);
  };

  // ─── HOME ───
  function HomeView() {
    const theme = useContext(ThemeContext) || themeLight;
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    return (
      <div>
        <div style={{
          background: "linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #00BCD4 100%)",
          padding: "28px 20px 24px", color: "white",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
                <div style={{ color: "#00BCD4" }}><Icons.Droplet /></div>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", fontFamily: "'DM Sans', sans-serif" }}>ClearView Wipers</h1>
              </div>
              <p style={{ margin: "4px 0 0 44px", fontSize: "14px", opacity: 0.8 }}>{today}</p>
            </div>
            <button type="button" onClick={() => {
              if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(ADMIN_UNLOCKED_KEY);
              setUserRole("employee");
            }} style={{
              background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "8px",
              padding: "6px 10px", fontSize: "12px", cursor: "pointer", fontWeight: "600",
            }}>
              Lock
            </button>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            {[
              { n: customers.length, l: "Customers", c: "#1565C0", bg: "#E3F2FD" },
              { n: pendingJobs.length + scheduledJobs.length, l: "Active Jobs", c: "#E65100", bg: "#FFF3E0" },
              { n: completedJobs.length, l: "Completed", c: "#2E7D32", bg: "#E8F5E9" },
              { n: Object.values(inventory).reduce((a,b) => a+b, 0), l: "Blades In Stock", c: "#6A1B9A", bg: "#F3E5F5" },
            ].map((s, i) => (
              <Card key={i} style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontSize: "28px", fontWeight: "800", color: s.c }}>{s.n}</div>
                <div style={{ fontSize: "12px", fontWeight: "600", color: theme.textLight, marginTop: "2px" }}>{s.l}</div>
              </Card>
            ))}
          </div>

          <button onClick={() => nav("customers", "new")} style={{
            ...baseBtn, width: "100%", background: "linear-gradient(135deg, #0D47A1, #1976D2)",
            color: "white", padding: "16px", fontSize: "16px", marginBottom: "12px",
          }}>
            <Icons.Plus /> New Customer Visit
          </button>

          {scheduledJobs.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: theme.text, margin: "0 0 12px" }}>📅 Upcoming Jobs</h3>
              {scheduledJobs.slice(0, 3).map(j => {
                const customer = customers.find(c => c.id === j.customerId);
                return (
                  <Card key={j.id} onClick={() => nav("jobs", "detail", j)} style={{ marginBottom: "10px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "14px" }}>{j.customerName}</div>
                        <div style={{ fontSize: "12px", color: theme.textLight }}>{formatDate(j.scheduledDate)} · {j.blades.length} blades · ${j.price}</div>
                        {customer?.address && (
                          <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "4px" }}>📍 {customer.address}</div>
                        )}
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {Object.keys(bladesNeeded).length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: theme.text, margin: "0 0 12px" }}>🔧 Blades Needed for Jobs</h3>
              <Card>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {Object.entries(bladesNeeded).sort().map(([size, count]) => {
                    const inStock = inventory[size] || 0;
                    const short = count > inStock;
                    return (
                      <div key={size} style={{
                        padding: "8px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
                        background: short ? "#FFEBEE" : "#E8F5E9",
                        color: short ? "#C62828" : "#2E7D32",
                        border: `1px solid ${short ? "#FFCDD2" : "#C8E6C9"}`,
                      }}>
                        {size} × {count} {short && `(only ${inStock} in stock!)`}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ─── EMPLOYEE HOME (simplified Today) ───
  function EmployeeHomeView() {
    const theme = useContext(ThemeContext) || themeLight;
    const today = new Date();
    const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const todayScheduled = scheduledJobs.filter((j) => j.scheduledDate === todayStr);
    const activeJobs = [...todayScheduled, ...pendingJobs.filter((j) => !todayScheduled.some((t) => t.id === j.id))];

    return (
      <div>
        <TopBar title="Today" onBack={null} rightAction={
          <button type="button" onClick={() => setShowPinModal(true)} style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "8px",
            padding: "6px 10px", fontSize: "12px", cursor: "pointer", fontWeight: "600",
          }}>
            Admin
          </button>
        } />
        <div style={{ padding: "20px" }}>
          <p style={{ fontSize: "14px", color: theme.textLight, margin: "0 0 16px" }}>{todayLabel}</p>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: theme.text, margin: "0 0 12px" }}>Your jobs</h3>
          {activeJobs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {activeJobs.map((j) => {
                const customer = customers.find((c) => c.id === j.customerId);
                return (
                  <Card key={j.id} onClick={() => nav("jobs", "detail", j)} style={{ padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "16px" }}>{j.customerName}</div>
                        <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "4px" }}>
                          {j.blades.map((b) => b.size).join(", ")} · ${j.price}
                        </div>
                        {j.scheduledDate && (
                          <div style={{ fontSize: "12px", color: theme.primaryLight, marginTop: "4px" }}>{formatDate(j.scheduledDate)}</div>
                        )}
                        {customer?.address && (
                          <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px" }}>📍 {customer.address}</div>
                        )}
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: "14px", color: theme.textLight }}>No jobs scheduled for today.</p>
          )}
        </div>
      </div>
    );
  }

  // ─── CUSTOMER LIST ───
  function CustomerListView() {
    const theme = useContext(ThemeContext) || themeLight;
    const [search, setSearch] = useState("");
    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div>
        <TopBar title="Customers" />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: theme.textLight }}><Icons.Search /></div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..."
              style={{
                width: "100%", padding: "12px 12px 12px 40px", border: `2px solid ${theme.border}`,
                borderRadius: "12px", fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
                outline: "none", boxSizing: "border-box", background: theme.card, color: theme.text,
              }} />
          </div>

          <button onClick={() => nav("customers", "new")} style={{
            ...baseBtn, width: "100%", background: theme.primary, color: "white", marginBottom: "16px",
          }}>
            <Icons.Plus /> Add New Customer
          </button>

          {filtered.map(c => (
            <Card key={c.id} onClick={() => nav("customers", "detail", c)} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: theme.text }}>{c.name}</div>
                  <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "2px" }}>
                    {(c.address ? simpleAddress(c.address) : c.phone)} · {c.vehicles.length} vehicle{c.vehicles.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: theme.textLight }}>
              <p style={{ fontSize: "15px" }}>No customers yet. Start knocking on doors! 🚪</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── NEW CUSTOMER ───
  function NewCustomerView() {
    const theme = useContext(ThemeContext) || themeLight;
    const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
    const [vehicles, setVehicles] = useState([{ make: "", model: "", year: "", wiperSizes: null }]);
    const [step, setStep] = useState(1);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifyError, setVerifyError] = useState(null);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const addressDebounceRef = useRef(null);

    const addVehicle = () => setVehicles([...vehicles, { make: "", model: "", year: "", wiperSizes: null }]);

    const updateVehicle = (idx, field, val) => {
      const updated = [...vehicles];
      updated[idx] = { ...updated[idx], [field]: val };
      // Auto-lookup wiper sizes
      if (updated[idx].make && updated[idx].model) {
        updated[idx].wiperSizes = lookupWiperSizes(updated[idx].make, updated[idx].model);
      }
      setVehicles(updated);
    };

    const removeVehicle = (idx) => {
      if (vehicles.length > 1) setVehicles(vehicles.filter((_, i) => i !== idx));
    };

    useEffect(() => {
      const q = (form.address || "").trim();
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
      if (q.length < 3) {
        setAddressSuggestions([]);
        return;
      }
      addressDebounceRef.current = setTimeout(() => {
        fetchAddressSuggestions(form.address).then(setAddressSuggestions);
      }, 300);
      return () => { if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current); };
    }, [form.address]);

    const handlePhotoCapture = async (idx) => {
      // Simulate AI identification
      setPhotoIdentifying(true);
      setTimeout(() => {
        const randomCars = [
          { make: "Toyota", model: "Camry" },
          { make: "Honda", model: "CR-V" },
          { make: "Ford", model: "F-150" },
          { make: "Chevrolet", model: "Equinox" },
        ];
        const car = randomCars[Math.floor(Math.random() * randomCars.length)];
        const updated = [...vehicles];
        updated[idx] = { ...updated[idx], make: car.make, model: car.model };
        updated[idx].wiperSizes = lookupWiperSizes(car.make, car.model);
        setVehicles(updated);
        setPhotoIdentifying(false);
      }, 2000);
    };

    const save = () => {
      const customer = {
        id: generateId(),
        ...form,
        vehicles: vehicles.filter(v => v.make),
        createdAt: new Date().toISOString(),
      };
      addCustomer(customer);
      nav("customers", "detail", customer);
    };

    return (
      <div>
        <TopBar title={step === 1 ? "Customer Info" : "Vehicle Details"} onBack={() => step === 1 ? nav("customers") : setStep(1)} />
        <div style={{ padding: "20px" }}>
          {step === 1 ? (
            <>
              <p style={{ fontSize: "14px", color: theme.textLight, margin: "0 0 20px" }}>
                Collect the customer's contact information
              </p>
              <Input label="Full Name *" placeholder="e.g. John Smith" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <Input label="Phone Number *" placeholder="555-123-4567" type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              <Input label="Email Address *" placeholder="john@example.com" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <div style={{ marginBottom: "16px" }}>
                <Input label="Address *" placeholder="123 Main Street" value={form.address} onChange={e => { setForm({...form, address: e.target.value}); setVerifyResult(null); setVerifyError(null); }} onBlur={() => setTimeout(() => setAddressSuggestions([]), 200)} />
                {addressSuggestions.length > 0 && (
                  <div style={{ marginTop: 4, maxHeight: 220, overflowY: "auto", border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.card }} role="listbox">
                    {addressSuggestions.map((s) => (
                      <div key={s.displayName} role="option" onMouseDown={e => { e.preventDefault(); setForm(f => ({ ...f, address: s.displayName })); setVerifyResult({ lat: s.lat, lon: s.lon, displayName: s.displayName }); setVerifyError(null); setAddressSuggestions([]); }} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: addressSuggestions.indexOf(s) < addressSuggestions.length - 1 ? `1px solid ${theme.border}` : "none", color: theme.text }}>{s.displayName}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: "16px" }}>
                <button
                  type="button"
                  onClick={async () => {
                    const addr = (form.address || "").trim();
                    if (!addr) return;
                    setVerifyLoading(true); setVerifyResult(null); setVerifyError(null);
                    try {
                      const result = await geocodeAddress(addr);
                      if (result) setVerifyResult(result); else setVerifyError("Address could not be verified.");
                    } catch {
                      setVerifyError("Could not verify address.");
                    }
                    setVerifyLoading(false);
                  }}
                  disabled={!(form.address || "").trim() || verifyLoading}
                  style={{
                    ...baseBtn, padding: "10px 16px", fontSize: "13px",
                    background: (form.address || "").trim() && !verifyLoading ? "#E3F2FD" : theme.border,
                    color: (form.address || "").trim() && !verifyLoading ? theme.primary : theme.textLight,
                  }}
                >
                  {verifyLoading ? "Verifying…" : "Verify address & show map"}
                </button>
                {verifyError && <div style={{ fontSize: "12px", color: "#C62828", marginTop: "8px" }}>{verifyError}</div>}
                {verifyResult && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#2E7D32", marginBottom: "8px" }}>✓ Verified</div>
                    <div style={{ borderRadius: theme.radius, overflow: "hidden", border: `1px solid ${theme.border}`, height: "180px", background: theme.bg, position: "relative" }}>
                      <iframe
                        title="Address map"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${verifyResult.lon - 0.008},${verifyResult.lat - 0.008},${verifyResult.lon + 0.008},${verifyResult.lat + 0.008}&layer=mapnik`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                      />
                      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }} aria-hidden="true">
                        <svg width="32" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#D32F2F"/>
                          <circle cx="12" cy="12" r="6" fill="white"/>
                        </svg>
                      </div>
                    </div>
                    <a href={`https://www.openstreetmap.org/?mlat=${verifyResult.lat}&mlon=${verifyResult.lon}#map=17/${verifyResult.lat}/${verifyResult.lon}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: theme.primaryLight, marginTop: "4px", display: "inline-block" }}>Open in OpenStreetMap</a>
                  </div>
                )}
              </div>
              {(() => {
                const allRequired = [form.name, form.phone, form.email, form.address].every(f => (f || "").trim().length > 0);
                return (
                  <button onClick={() => setStep(2)} disabled={!allRequired} style={{
                    ...baseBtn, width: "100%", background: allRequired ? theme.primary : theme.border,
                    color: allRequired ? "white" : theme.textLight, marginTop: "8px",
                  }}>
                    Next: Vehicle Info →
                  </button>
                );
              })()}
            </>
          ) : (
            <>
              <p style={{ fontSize: "14px", color: theme.textLight, margin: "0 0 20px" }}>
                Add vehicle details to look up wiper blade sizes
              </p>
              {vehicles.map((v, idx) => (
                <Card key={idx} style={{ marginBottom: "16px", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icons.Car />
                      <span style={{ fontWeight: "700", fontSize: "14px" }}>Vehicle {idx + 1}</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePhotoCapture(idx); }} style={{
                        ...baseBtn, padding: "8px 12px", fontSize: "12px",
                        background: "#E3F2FD", color: theme.primary,
                      }}>
                        <Icons.Camera /> {photoIdentifying ? "Identifying..." : "Photo ID"}
                      </button>
                      {vehicles.length > 1 && (
                        <button type="button" onClick={() => removeVehicle(idx)} style={{
                          background: "#FFEBEE", border: "none", borderRadius: "8px",
                          padding: "8px", cursor: "pointer", color: "#C62828", display: "flex",
                        }}>
                          <Icons.Trash />
                        </button>
                      )}
                    </div>
                  </div>
                  <Select label="Year" options={YEARS} placeholder="Select year" value={v.year} onChange={e => updateVehicle(idx, "year", e.target.value)} />
                  <Select label="Make" options={MAKES} placeholder="Select make" value={v.make} onChange={e => updateVehicle(idx, "make", e.target.value)} />
                  <Input label="Model" placeholder="e.g. Camry, CR-V, F-150" value={v.model} onChange={e => updateVehicle(idx, "model", e.target.value)} />
                  {v.make && (v.model?.length >= 1 || getModelSuggestions(v.make, "").length > 0) && (
                    <div style={{ marginTop: "-8px", marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: theme.textLight, marginBottom: "6px" }}>Suggestions</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {getModelSuggestions(v.make, v.model)
                          .filter((m) => m !== v.model)
                          .map((modelName) => (
                            <button
                              key={modelName}
                              type="button"
                              onClick={() => updateVehicle(idx, "model", modelName)}
                              style={{
                                padding: "6px 12px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                                background: "#E3F2FD", color: theme.primary, fontSize: "12px", fontWeight: "600",
                                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              {modelName}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {v.wiperSizes && (
                    <div style={{
                      background: "#E8F5E9", borderRadius: "10px", padding: "14px",
                      marginTop: "4px", border: "1px solid #C8E6C9",
                    }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#2E7D32", marginBottom: "8px" }}>✓ Wiper Sizes Found</div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#1B5E20" }}>Driver: {v.wiperSizes.driver}</span>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#1B5E20" }}>Pass: {v.wiperSizes.passenger}</span>
                        {v.wiperSizes.rear && <span style={{ fontSize: "13px", fontWeight: "600", color: "#1B5E20" }}>Rear: {v.wiperSizes.rear}</span>}
                      </div>
                    </div>
                  )}
                  {v.make && v.model && !v.wiperSizes && (
                    <div style={{
                      background: "#FFF3E0", borderRadius: "10px", padding: "14px",
                      marginTop: "4px", border: "1px solid #FFE0B2",
                    }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#E65100" }}>
                        ⚠ Sizes not in database — you can look them up manually
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              <button onClick={addVehicle} style={{
                ...baseBtn, width: "100%", background: "#F5F7FA",
                color: theme.primary, border: `2px dashed ${theme.border}`, marginBottom: "12px",
              }}>
                <Icons.Plus /> Add Another Vehicle
              </button>

              <button onClick={save} style={{
                ...baseBtn, width: "100%",
                background: "linear-gradient(135deg, #2E7D32, #43A047)",
                color: "white", padding: "16px", fontSize: "16px",
              }}>
                <Icons.Check /> Save Customer
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── EDIT CUSTOMER ───
  function EditCustomerView() {
    const theme = useContext(ThemeContext) || themeLight;
    const customer = selectedItem;
    if (!customer) return null;
    const [form, setForm] = useState({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
    });
    const [vehicles, setVehicles] = useState(
      (customer.vehicles && customer.vehicles.length > 0)
        ? customer.vehicles.map(v => ({ ...v, wiperSizes: v.wiperSizes || null }))
        : [{ make: "", model: "", year: "", wiperSizes: null }]
    );
    const [step, setStep] = useState(1);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifyError, setVerifyError] = useState(null);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const addressDebounceRef = useRef(null);

    const addVehicle = () => setVehicles([...vehicles, { make: "", model: "", year: "", wiperSizes: null }]);

    const updateVehicle = (idx, field, val) => {
      const updated = [...vehicles];
      updated[idx] = { ...updated[idx], [field]: val };
      if (updated[idx].make && updated[idx].model) {
        updated[idx].wiperSizes = lookupWiperSizes(updated[idx].make, updated[idx].model);
      }
      setVehicles(updated);
    };

    const removeVehicle = (idx) => {
      if (vehicles.length > 1) setVehicles(vehicles.filter((_, i) => i !== idx));
    };

    useEffect(() => {
      const q = (form.address || "").trim();
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
      if (q.length < 3) {
        setAddressSuggestions([]);
        return;
      }
      addressDebounceRef.current = setTimeout(() => {
        fetchAddressSuggestions(form.address).then(setAddressSuggestions);
      }, 300);
      return () => { if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current); };
    }, [form.address]);

    const handlePhotoCapture = async (idx) => {
      setPhotoIdentifying(true);
      setTimeout(() => {
        const randomCars = [
          { make: "Toyota", model: "Camry" },
          { make: "Honda", model: "CR-V" },
          { make: "Ford", model: "F-150" },
          { make: "Chevrolet", model: "Equinox" },
        ];
        const car = randomCars[Math.floor(Math.random() * randomCars.length)];
        const updated = [...vehicles];
        updated[idx] = { ...updated[idx], make: car.make, model: car.model };
        updated[idx].wiperSizes = lookupWiperSizes(car.make, car.model);
        setVehicles(updated);
        setPhotoIdentifying(false);
      }, 2000);
    };

    const save = () => {
      const updatedCustomer = {
        ...customer,
        ...form,
        vehicles: vehicles.filter(v => v.make),
      };
      updateCustomer(updatedCustomer);
      if (form.name !== customer.name) {
        updateJobsCustomerName(customer.id, form.name);
      }
      nav("customers", "detail", updatedCustomer);
    };

    const allRequiredStep1 = [form.name, form.phone, form.email, form.address].every(f => (f || "").trim().length > 0);

    return (
      <div>
        <TopBar title="Edit Customer" onBack={() => nav("customers", "detail", customer)} />
        <div style={{ padding: "20px" }}>
          {step === 1 ? (
            <>
              <p style={{ fontSize: "14px", color: theme.textLight, margin: "0 0 20px" }}>
                Update contact information
              </p>
              <Input label="Full Name *" placeholder="e.g. John Smith" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <Input label="Phone Number *" placeholder="555-123-4567" type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              <Input label="Email Address *" placeholder="john@example.com" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <div style={{ marginBottom: "16px" }}>
                <Input label="Address *" placeholder="123 Main Street" value={form.address} onChange={e => { setForm({...form, address: e.target.value}); setVerifyResult(null); setVerifyError(null); }} onBlur={() => setTimeout(() => setAddressSuggestions([]), 200)} />
                {addressSuggestions.length > 0 && (
                  <div style={{ marginTop: 4, maxHeight: 220, overflowY: "auto", border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.card }} role="listbox">
                    {addressSuggestions.map((s) => (
                      <div key={s.displayName} role="option" onMouseDown={e => { e.preventDefault(); setForm(f => ({ ...f, address: s.displayName })); setVerifyResult({ lat: s.lat, lon: s.lon, displayName: s.displayName }); setVerifyError(null); setAddressSuggestions([]); }} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: addressSuggestions.indexOf(s) < addressSuggestions.length - 1 ? `1px solid ${theme.border}` : "none", color: theme.text }}>{s.displayName}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: "16px" }}>
                <button
                  type="button"
                  onClick={async () => {
                    const addr = (form.address || "").trim();
                    if (!addr) return;
                    setVerifyLoading(true); setVerifyResult(null); setVerifyError(null);
                    try {
                      const result = await geocodeAddress(addr);
                      if (result) setVerifyResult(result); else setVerifyError("Address could not be verified.");
                    } catch {
                      setVerifyError("Could not verify address.");
                    }
                    setVerifyLoading(false);
                  }}
                  disabled={!(form.address || "").trim() || verifyLoading}
                  style={{
                    ...baseBtn, padding: "10px 16px", fontSize: "13px",
                    background: (form.address || "").trim() && !verifyLoading ? "#E3F2FD" : theme.border,
                    color: (form.address || "").trim() && !verifyLoading ? theme.primary : theme.textLight,
                  }}
                >
                  {verifyLoading ? "Verifying…" : "Verify address & show map"}
                </button>
                {verifyError && <div style={{ fontSize: "12px", color: "#C62828", marginTop: "8px" }}>{verifyError}</div>}
                {verifyResult && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#2E7D32", marginBottom: "8px" }}>✓ Verified</div>
                    <div style={{ borderRadius: theme.radius, overflow: "hidden", border: `1px solid ${theme.border}`, height: "180px", background: theme.bg, position: "relative" }}>
                      <iframe
                        title="Address map"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${verifyResult.lon - 0.008},${verifyResult.lat - 0.008},${verifyResult.lon + 0.008},${verifyResult.lat + 0.008}&layer=mapnik`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                      />
                      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }} aria-hidden="true">
                        <svg width="32" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#D32F2F"/>
                          <circle cx="12" cy="12" r="6" fill="white"/>
                        </svg>
                      </div>
                    </div>
                    <a href={`https://www.openstreetmap.org/?mlat=${verifyResult.lat}&mlon=${verifyResult.lon}#map=17/${verifyResult.lat}/${verifyResult.lon}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: theme.primaryLight, marginTop: "4px", display: "inline-block" }}>Open in OpenStreetMap</a>
                  </div>
                )}
              </div>
              <button onClick={() => setStep(2)} disabled={!allRequiredStep1} style={{
                ...baseBtn, width: "100%", background: allRequiredStep1 ? theme.primary : theme.border,
                color: allRequiredStep1 ? "white" : theme.textLight, marginTop: "8px",
              }}>
                Next: Vehicle Info →
              </button>
              <button onClick={save} disabled={!allRequiredStep1} style={{
                ...baseBtn, width: "100%",
                background: allRequiredStep1 ? "linear-gradient(135deg, #2E7D32, #43A047)" : theme.border,
                color: allRequiredStep1 ? "white" : theme.textLight,
                padding: "16px", fontSize: "16px",
                marginTop: "8px",
              }}>
                <Icons.Check /> Save Changes
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: "14px", color: theme.textLight, margin: "0 0 20px" }}>
                Update vehicle details
              </p>
              {vehicles.map((v, idx) => (
                <Card key={idx} style={{ marginBottom: "16px", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icons.Car />
                      <span style={{ fontWeight: "700", fontSize: "14px" }}>Vehicle {idx + 1}</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePhotoCapture(idx); }} style={{
                        ...baseBtn, padding: "8px 12px", fontSize: "12px",
                        background: "#E3F2FD", color: theme.primary,
                      }}>
                        <Icons.Camera /> {photoIdentifying ? "Identifying..." : "Photo ID"}
                      </button>
                      {vehicles.length > 1 && (
                        <button type="button" onClick={() => removeVehicle(idx)} style={{
                          background: "#FFEBEE", border: "none", borderRadius: "8px",
                          padding: "8px", cursor: "pointer", color: "#C62828", display: "flex",
                        }}>
                          <Icons.Trash />
                        </button>
                      )}
                    </div>
                  </div>
                  <Select label="Year" options={YEARS} placeholder="Select year" value={v.year} onChange={e => updateVehicle(idx, "year", e.target.value)} />
                  <Select label="Make" options={MAKES} placeholder="Select make" value={v.make} onChange={e => updateVehicle(idx, "make", e.target.value)} />
                  <Input label="Model" placeholder="e.g. Camry, CR-V, F-150" value={v.model} onChange={e => updateVehicle(idx, "model", e.target.value)} />
                  {v.make && (v.model?.length >= 1 || getModelSuggestions(v.make, "").length > 0) && (
                    <div style={{ marginTop: "-8px", marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: theme.textLight, marginBottom: "6px" }}>Suggestions</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {getModelSuggestions(v.make, v.model)
                          .filter((m) => m !== v.model)
                          .map((modelName) => (
                            <button
                              key={modelName}
                              type="button"
                              onClick={() => updateVehicle(idx, "model", modelName)}
                              style={{
                                padding: "6px 12px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                                background: "#E3F2FD", color: theme.primary, fontSize: "12px", fontWeight: "600",
                                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              {modelName}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {v.wiperSizes && (
                    <div style={{ background: "#E8F5E9", borderRadius: "10px", padding: "14px", marginTop: "4px", border: "1px solid #C8E6C9" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#2E7D32", marginBottom: "8px" }}>✓ Wiper Sizes Found</div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#1B5E20" }}>Driver: {v.wiperSizes.driver}</span>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#1B5E20" }}>Pass: {v.wiperSizes.passenger}</span>
                        {v.wiperSizes.rear && <span style={{ fontSize: "13px", fontWeight: "600", color: "#1B5E20" }}>Rear: {v.wiperSizes.rear}</span>}
                      </div>
                    </div>
                  )}
                  {v.make && v.model && !v.wiperSizes && (
                    <div style={{ background: "#FFF3E0", borderRadius: "10px", padding: "14px", marginTop: "4px", border: "1px solid #FFE0B2" }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#E65100" }}>⚠ Sizes not in database — you can look them up manually</div>
                    </div>
                  )}
                </Card>
              ))}
              <button onClick={addVehicle} style={{
                ...baseBtn, width: "100%", background: "#F5F7FA",
                color: theme.primary, border: `2px dashed ${theme.border}`, marginBottom: "12px",
              }}>
                <Icons.Plus /> Add Another Vehicle
              </button>
              <button onClick={save} style={{
                ...baseBtn, width: "100%",
                background: "linear-gradient(135deg, #2E7D32, #43A047)",
                color: "white", padding: "16px", fontSize: "16px",
              }}>
                <Icons.Check /> Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── CUSTOMER DETAIL ───
  function CustomerDetailView({ customer }) {
    const theme = useContext(ThemeContext) || themeLight;
    if (!customer) return null;
    const customerJobs = jobs.filter(j => j.customerId === customer.id);
    const [mapLoading, setMapLoading] = useState(false);
    const [mapResult, setMapResult] = useState(null);
    const [mapError, setMapError] = useState(null);

    const createJob = (vIdx) => {
      const v = customer.vehicles[vIdx];
      if (!v?.wiperSizes) return;
      const blades = [];
      if (v.wiperSizes.driver) blades.push({ size: v.wiperSizes.driver, position: "Driver" });
      if (v.wiperSizes.passenger) blades.push({ size: v.wiperSizes.passenger, position: "Passenger" });
      if (v.wiperSizes.rear) blades.push({ size: v.wiperSizes.rear, position: "Rear" });

      const canDoNow = blades.every(b => (inventory[b.size] || 0) > 0);

      const newJob = {
        id: generateId(),
        customerId: customer.id,
        customerName: customer.name,
        vehicleIndex: vIdx,
        status: canDoNow ? "pending" : "pending",
        scheduledDate: null,
        blades,
        createdAt: new Date().toISOString(),
        price: 50,
      };
      addJob(newJob);
      nav("jobs", "detail", newJob);
    };

    return (
      <div>
        <TopBar title={customer.name} onBack={() => nav("customers")} />
        <div style={{ padding: "20px" }}>
          <Card style={{ marginBottom: "16px", position: "relative" }}>
            <button
              type="button"
              onClick={() => nav("customers", "edit", customer)}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "#E3F2FD",
                border: "none",
                color: theme.primary,
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Edit
            </button>
            <div style={{ fontSize: "13px", color: theme.textLight, lineHeight: "2", paddingRight: "70px" }}>
              {customer.phone && <div>📱 {customer.phone}</div>}
              {customer.email && <div>✉️ {customer.email}</div>}
              {customer.address && <div>📍 {customer.address}</div>}
            </div>
            {customer.address && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${theme.border}` }}>
                <button
                  type="button"
                  onClick={async () => {
                    setMapLoading(true); setMapResult(null); setMapError(null);
                    try {
                      const result = await geocodeAddress(customer.address);
                      if (result) setMapResult(result); else setMapError("Address could not be found.");
                    } catch {
                      setMapError("Could not load map.");
                    }
                    setMapLoading(false);
                  }}
                  disabled={mapLoading}
                  style={{
                    ...baseBtn, padding: "8px 14px", fontSize: "13px",
                    background: mapLoading ? theme.border : "#E3F2FD",
                    color: mapLoading ? theme.textLight : theme.primary,
                  }}
                >
                  {mapLoading ? "Loading…" : "View map"}
                </button>
                {mapError && <div style={{ fontSize: "12px", color: "#C62828", marginTop: "8px" }}>{mapError}</div>}
                {mapResult && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ borderRadius: theme.radius, overflow: "hidden", border: `1px solid ${theme.border}`, height: "200px", background: theme.bg, position: "relative" }}>
                      <iframe
                        title="Customer address map"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapResult.lon - 0.008},${mapResult.lat - 0.008},${mapResult.lon + 0.008},${mapResult.lat + 0.008}&layer=mapnik`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                      />
                      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }} aria-hidden="true">
                        <svg width="32" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#D32F2F"/>
                          <circle cx="12" cy="12" r="6" fill="white"/>
                        </svg>
                      </div>
                    </div>
                    <a href={`https://www.openstreetmap.org/?mlat=${mapResult.lat}&mlon=${mapResult.lon}#map=17/${mapResult.lat}/${mapResult.lon}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: theme.primaryLight, marginTop: "4px", display: "inline-block" }}>Open in OpenStreetMap</a>
                  </div>
                )}
              </div>
            )}
          </Card>

          <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "20px 0 12px" }}>Vehicles</h3>
          {customer.vehicles.map((v, idx) => (
            <Card key={idx} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px" }}>{v.year} {v.make} {v.model}</div>
                  {v.wiperSizes && (
                    <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "4px" }}>
                      D: {v.wiperSizes.driver} · P: {v.wiperSizes.passenger}{v.wiperSizes.rear ? ` · R: ${v.wiperSizes.rear}` : ""}
                    </div>
                  )}
                </div>
                <button onClick={() => createJob(idx)} style={{
                  ...baseBtn, padding: "8px 16px", fontSize: "13px",
                  background: theme.primary, color: "white",
                }}>
                  Create Job
                </button>
              </div>
            </Card>
          ))}

          {customerJobs.length > 0 && (
            <>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "20px 0 12px" }}>Job History</h3>
              {customerJobs.map(j => (
                <Card key={j.id} onClick={() => nav("jobs", "detail", j)} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", color: theme.textLight }}>{j.blades.map(b => `${b.position} ${b.size}`).join(", ")}</div>
                      <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>${j.price}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <StatusBadge status={j.status} />
                      <span style={{ fontSize: "11px", color: theme.textLight }}>
                        {j.status === "completed" && j.completedAt && `Completed ${formatDate(j.completedAt)}`}
                        {j.status === "scheduled" && j.scheduledDate && `Scheduled ${formatDate(j.scheduledDate)}`}
                        {j.status === "pending" && "Pending"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── JOBS LIST ───
  function JobsListView() {
    const theme = useContext(ThemeContext) || themeLight;
    const [filter, setFilter] = useState("all");
    const filtered = filter === "all" ? jobs : jobs.filter(j => j.status === filter);
    return (
      <div>
        <TopBar title="Jobs" />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto" }}>
            {[
              { id: "all", label: "All" },
              { id: "pending", label: `Pending (${pendingJobs.length})` },
              { id: "scheduled", label: `Scheduled (${scheduledJobs.length})` },
              { id: "completed", label: `Done (${completedJobs.length})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                ...baseBtn, padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap",
                background: filter === f.id ? theme.primary : "#F0F2F5",
                color: filter === f.id ? "white" : theme.text,
              }}>
                {f.label}
              </button>
            ))}
          </div>

          {filtered.map(j => {
            const customer = customers.find(c => c.id === j.customerId);
            return (
              <Card key={j.id} onClick={() => nav("jobs", "detail", j)} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px" }}>{j.customerName}</div>
                    <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>
                      {j.blades.map(b => b.size).join(", ")} · ${j.price}
                    </div>
                    {j.scheduledDate && (
                      <>
                        <div style={{ fontSize: "12px", color: theme.primaryLight, marginTop: "2px" }}>
                          <Icons.Calendar /> {formatDate(j.scheduledDate)}
                        </div>
                        {customer?.address && (
                          <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "2px" }}>📍 {customer.address}</div>
                        )}
                      </>
                    )}
                  </div>
                  <StatusBadge status={j.status} />
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>
              No jobs to show
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── JOB DETAIL ───
  function JobDetailView({ job, isEmployee }) {
    const theme = useContext(ThemeContext) || themeLight;
    if (!job) return null;
    const [schedDate, setSchedDate] = useState(job.scheduledDate || "");
    const [emailSent, setEmailSent] = useState(false);
    const [price, setPrice] = useState(job.price?.toString() ?? "50");
    const [mapLoading, setMapLoading] = useState(false);
    const [mapResult, setMapResult] = useState(null);
    const [mapError, setMapError] = useState(null);

    // Refresh job from state
    const currentJob = jobs.find(j => j.id === job.id) || job;
    const customer = customers.find(c => c.id === currentJob.customerId);

    const scheduleJob = () => {
      if (!schedDate) return;
      const updated = { ...currentJob, status: "scheduled", scheduledDate: schedDate };
      updateJob(updated);
      nav("jobs", "detail", updated);
    };

    const completeJob = () => {
      const newInv = { ...inventory };
      currentJob.blades.forEach(b => {
        if (newInv[b.size] !== undefined && newInv[b.size] > 0) {
          newInv[b.size]--;
        }
      });
      writeInventory(newInv);
      const updatedPrice = parseFloat(price) || currentJob.price;
      const updatedJob = { ...currentJob, status: "completed", completedAt: new Date().toISOString(), price: updatedPrice };
      updateJob(updatedJob);
      nav("jobs", "detail", updatedJob);
    };

    const sendThankYou = () => {
      setEmailSent(true);
      const c = customers.find(c => c.id === currentJob.customerId);
      // In production, this would call an API
      alert(`📧 Thank you email sent to ${c?.email || "customer"}!\n\nMessage: Thank you for choosing ClearView Wipers! Your new wiper blades have been installed. We recommend replacement every 6-12 months. Reply to schedule your next visit!`);
    };

    const hasBlades = currentJob.blades.every(b => (inventory[b.size] || 0) > 0);
    const hasScheduledDate = !!(currentJob.scheduledDate || schedDate?.trim());
    const canComplete = hasBlades && hasScheduledDate;

    return (
      <div>
        <TopBar title="Job Details" onBack={() => nav("jobs")} />
        <div style={{ padding: "20px" }}>
          <Card style={{ marginBottom: "16px" }} onClick={!isEmployee && customer ? () => nav("customers", "detail", customer) : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
              <div>
                <div style={{ fontWeight: "800", fontSize: "18px" }}>{currentJob.customerName}</div>
                <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "2px" }}>
                  Created {formatDate(currentJob.createdAt)}
                </div>
                {customer?.address && (
                  <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    📍 {customer.address}
                  </div>
                )}
              </div>
              <StatusBadge status={currentJob.status} />
            </div>
            {customer?.address && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setMapLoading(true); setMapResult(null); setMapError(null);
                    try {
                      const result = await geocodeAddress(customer.address);
                      if (result) setMapResult(result); else setMapError("Address could not be found.");
                    } catch {
                      setMapError("Could not load map.");
                    }
                    setMapLoading(false);
                  }}
                  disabled={mapLoading}
                  style={{
                    ...baseBtn, padding: "8px 14px", fontSize: "13px",
                    background: mapLoading ? theme.border : "#E3F2FD",
                    color: mapLoading ? theme.textLight : theme.primary,
                  }}
                >
                  {mapLoading ? "Loading…" : "View map"}
                </button>
                {mapError && <div style={{ fontSize: "12px", color: "#C62828", marginTop: "8px" }}>{mapError}</div>}
                {mapResult && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ borderRadius: theme.radius, overflow: "hidden", border: `1px solid ${theme.border}`, height: "180px", background: theme.bg, position: "relative" }}>
                      <iframe
                        title="Job location map"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapResult.lon - 0.008},${mapResult.lat - 0.008},${mapResult.lon + 0.008},${mapResult.lat + 0.008}&layer=mapnik`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                      />
                      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }} aria-hidden="true">
                        <svg width="32" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="#D32F2F"/>
                          <circle cx="12" cy="12" r="6" fill="white"/>
                        </svg>
                      </div>
                    </div>
                    <a href={`https://www.openstreetmap.org/?mlat=${mapResult.lat}&mlon=${mapResult.lon}#map=17/${mapResult.lat}/${mapResult.lon}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: theme.primaryLight, marginTop: "4px", display: "inline-block" }} onClick={e => e.stopPropagation()}>Open in OpenStreetMap</a>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: theme.textLight, marginBottom: "10px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Blades Required</div>
            {currentJob.blades.map((b, i) => {
              const inStock = inventory[b.size] || 0;
              return (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: i < currentJob.blades.length - 1 ? `1px solid ${theme.border}` : "none",
                }}>
                  <div>
                    <span style={{ fontWeight: "600" }}>{b.position}</span>
                    <span style={{ color: theme.textLight, marginLeft: "8px" }}>{b.size}</span>
                  </div>
                  <div style={{
                    fontSize: "12px", fontWeight: "600",
                    color: inStock > 0 ? "#2E7D32" : "#C62828",
                  }}>
                    {inStock > 0 ? `${inStock} in stock ✓` : "OUT OF STOCK ✗"}
                  </div>
                </div>
              );
            })}
          </Card>

          <Card style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: theme.textLight, marginBottom: "10px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Price</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px", fontWeight: "600" }}>$</span>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number"
                style={{
                  width: "100px", padding: "8px 12px", border: `2px solid ${theme.border}`,
                  borderRadius: "10px", fontSize: "20px", fontWeight: "700",
                  fontFamily: "'DM Sans', sans-serif", outline: "none",
                  background: (currentJob.status === "completed" || isEmployee) ? theme.bg : theme.card,
                  color: theme.text,
                }}
                disabled={currentJob.status === "completed" || isEmployee}
              />
            </div>
          </Card>

          {currentJob.status !== "completed" && (
            <>
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: theme.textLight, marginBottom: "10px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Schedule Install Date *</div>
                <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
                  disabled={isEmployee}
                  style={{
                    width: "100%", padding: "12px", border: `2px solid ${theme.border}`,
                    borderRadius: "10px", fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
                    outline: "none", boxSizing: "border-box",
                    background: isEmployee ? theme.bg : theme.card,
                    color: theme.text,
                  }} />
                {schedDate && currentJob.status !== "scheduled" && !isEmployee && (
                  <button onClick={scheduleJob} style={{
                    ...baseBtn, width: "100%", marginTop: "12px",
                    background: theme.primaryLight, color: "white",
                  }}>
                    <Icons.Calendar /> Schedule for {formatDate(schedDate)}
                  </button>
                )}
              </Card>

              <button onClick={completeJob} disabled={!canComplete} style={{
                ...baseBtn, width: "100%", padding: "16px", fontSize: "16px",
                background: canComplete ? "linear-gradient(135deg, #2E7D32, #43A047)" : theme.border,
                color: canComplete ? "white" : theme.textLight,
              }}>
                <Icons.Check /> {canComplete ? "Complete Job & Deduct Inventory" : !hasScheduledDate ? "Set schedule date to complete" : "Need Blades in Stock to Complete"}
              </button>
            </>
          )}

          {currentJob.status === "completed" && (
            <div>
              <div style={{
                textAlign: "center", padding: "20px", background: "#E8F5E9",
                borderRadius: theme.radius, marginBottom: "16px",
              }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
                <div style={{ fontWeight: "700", color: "#2E7D32", fontSize: "16px" }}>Job Complete!</div>
              </div>
              <button onClick={sendThankYou} disabled={emailSent} style={{
                ...baseBtn, width: "100%", padding: "16px",
                background: emailSent ? "#E8F5E9" : "linear-gradient(135deg, #0D47A1, #1976D2)",
                color: emailSent ? "#2E7D32" : "white", fontSize: "15px",
              }}>
                <Icons.Mail /> {emailSent ? "Thank You Email Sent ✓" : "Send Thank You Email"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── BLOCK SURVEY (research) ───
  function BlockSurveyView() {
    const theme = useContext(ThemeContext) || themeLight;
    const [surveyVehicles, setSurveyVehicles] = useState([]);
    const [surveyName, setSurveyName] = useState("");
    const [surveyPhotoIdentifying, setSurveyPhotoIdentifying] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addMake, setAddMake] = useState("");
    const [addModel, setAddModel] = useState("");

    const addVehicleToSurvey = (make, model) => {
      const wiperSizes = lookupWiperSizes(make, model);
      setSurveyVehicles((prev) => [...prev, { make, model, wiperSizes }]);
      setAddMake("");
      setAddModel("");
      setShowAddForm(false);
    };

    const removeVehicleFromSurvey = (idx) => {
      setSurveyVehicles((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSurveyPhotoCapture = () => {
      setSurveyPhotoIdentifying(true);
      setTimeout(() => {
        const randomCars = [
          { make: "Toyota", model: "Camry" },
          { make: "Honda", model: "CR-V" },
          { make: "Ford", model: "F-150" },
          { make: "Chevrolet", model: "Equinox" },
        ];
        const car = randomCars[Math.floor(Math.random() * randomCars.length)];
        const wiperSizes = lookupWiperSizes(car.make, car.model);
        setSurveyVehicles((prev) => [...prev, { make: car.make, model: car.model, wiperSizes }]);
        setSurveyPhotoIdentifying(false);
      }, 2000);
    };

    const bladesNeededForSurvey = {};
    surveyVehicles.forEach((v) => {
      if (!v.wiperSizes) return;
      if (v.wiperSizes.driver) bladesNeededForSurvey[v.wiperSizes.driver] = (bladesNeededForSurvey[v.wiperSizes.driver] || 0) + 1;
      if (v.wiperSizes.passenger) bladesNeededForSurvey[v.wiperSizes.passenger] = (bladesNeededForSurvey[v.wiperSizes.passenger] || 0) + 1;
      if (v.wiperSizes.rear) bladesNeededForSurvey[v.wiperSizes.rear] = (bladesNeededForSurvey[v.wiperSizes.rear] || 0) + 1;
    });

    return (
      <div>
        <TopBar title="Block survey" onBack={() => nav("inventory")} />
        <div style={{ padding: "16px 20px" }}>
          <Input label="Survey name (optional)" placeholder="e.g. Oak St block" value={surveyName} onChange={(e) => setSurveyName(e.target.value)} />

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setShowAddForm((v) => !v)} style={{
              ...baseBtn, padding: "10px 16px", fontSize: "14px",
              background: "#E8F5E9", color: "#2E7D32", border: "1px solid #C8E6C9",
            }}>
              {showAddForm ? "Cancel" : "+ Add vehicle"}
            </button>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSurveyPhotoCapture(); }} disabled={surveyPhotoIdentifying} style={{
              ...baseBtn, padding: "10px 16px", fontSize: "14px",
              background: "#E3F2FD", color: theme.primary,
            }}>
              <Icons.Camera /> {surveyPhotoIdentifying ? "Identifying..." : "Add from photo"}
            </button>
          </div>

          {showAddForm && (
            <Card style={{ marginBottom: "16px", background: "#F5F7FA" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px" }}>Add vehicle</div>
              <Select label="Make" options={MAKES} placeholder="Select make" value={addMake} onChange={(e) => setAddMake(e.target.value)} />
              <Input label="Model" placeholder="e.g. Camry, CR-V, F-150" value={addModel} onChange={(e) => setAddModel(e.target.value)} />
              {addMake && (addModel?.length >= 1 || getModelSuggestions(addMake, "").length > 0) && (
                <div style={{ marginTop: "-8px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: theme.textLight, marginBottom: "6px" }}>Suggestions</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {getModelSuggestions(addMake, addModel)
                      .filter((m) => m !== addModel)
                      .map((modelName) => (
                        <button key={modelName} type="button" onClick={() => addVehicleToSurvey(addMake, modelName)} style={{
                          padding: "6px 12px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                          background: "#E3F2FD", color: theme.primary, fontSize: "12px", fontWeight: "600",
                          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>
                          {modelName}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={() => addMake && addModel && addVehicleToSurvey(addMake, addModel)} disabled={!addMake || !addModel} style={{
                ...baseBtn, width: "100%", padding: "10px", fontSize: "14px",
                background: addMake && addModel ? theme.primary : theme.border, color: "white",
              }}>
                Add to survey
              </button>
            </Card>
          )}

          {surveyVehicles.length > 0 && (
            <>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 12px" }}>Vehicles in survey ({surveyVehicles.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                {surveyVehicles.map((v, idx) => (
                  <Card key={idx} style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px" }}>{v.make} {v.model}</div>
                      {v.wiperSizes ? (
                        <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px" }}>
                          {v.wiperSizes.driver && <span>{v.wiperSizes.driver}</span>}
                          {v.wiperSizes.passenger && <span> / {v.wiperSizes.passenger}</span>}
                          {v.wiperSizes.rear && <span> / {v.wiperSizes.rear}</span>}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: theme.warning, marginTop: "4px" }}>Sizes not in database</div>
                      )}
                    </div>
                    <button type="button" onClick={() => removeVehicleFromSurvey(idx)} style={{
                      background: "#FFEBEE", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#C62828", display: "flex",
                    }}>
                      <Icons.Trash />
                    </button>
                  </Card>
                ))}
              </div>
            </>
          )}

          {Object.keys(bladesNeededForSurvey).length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 12px" }}>Suggested blades for this survey</h3>
              <Card style={{ background: "#FFF8E1" }}>
                {Object.entries(bladesNeededForSurvey).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([size, needed]) => {
                  const have = inventory[size] || 0;
                  const toBuy = Math.max(0, needed - have);
                  return (
                    <div key={size} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0",
                      borderBottom: "1px solid #FFE082", fontSize: "14px",
                    }}>
                      <span style={{ fontWeight: "600" }}>{size}</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: theme.textLight }}>× {needed}</span>
                        {have > 0 && <span style={{ marginLeft: "8px", color: "#2E7D32" }}>— {have} in stock</span>}
                        {toBuy > 0 && <div style={{ fontWeight: "700", color: "#E65100", marginTop: "2px" }}>Consider buying: {toBuy}</div>}
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}

          {surveyVehicles.length === 0 && !showAddForm && (
            <p style={{ fontSize: "14px", color: theme.textLight, marginTop: "12px" }}>
              Add vehicles (manually or from photo) to see suggested blade counts for this area.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── INVENTORY ───
  function InventoryView() {
    const theme = useContext(ThemeContext) || themeLight;
    const [editing, setEditing] = useState(null);
    const [editVal, setEditVal] = useState("");

    const updateStock = (size) => {
      const val = parseInt(editVal);
      if (!isNaN(val) && val >= 0) {
        writeInventory({ ...inventory, [size]: val });
      }
      setEditing(null);
    };

    const addStock = (size, amount) => {
      writeInventory({ ...inventory, [size]: Math.max(0, (inventory[size] || 0) + amount) });
    };

    const sizes = Object.keys(inventory).sort((a, b) => parseInt(a) - parseInt(b));
    const totalBlades = Object.values(inventory).reduce((a, b) => a + b, 0);

    return (
      <div>
        <TopBar title="Blade Inventory" />
        <div style={{ padding: "16px 20px" }}>
          <Card style={{ marginBottom: "20px", background: "linear-gradient(135deg, #1A237E, #283593)", color: "white" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "36px", fontWeight: "800" }}>{totalBlades}</div>
              <div style={{ fontSize: "14px", opacity: 0.8 }}>Total Blades in Stock</div>
            </div>
          </Card>

          <button type="button" onClick={() => nav("inventory", "survey")} style={{
            ...baseBtn, width: "100%", marginBottom: "20px",
            background: "#E3F2FD", color: theme.primary, border: `2px solid ${theme.primaryLight}`,
            padding: "14px", fontSize: "15px",
          }}>
            <Icons.Camera /> Block survey — estimate blades for an area
          </button>

          <div style={{ display: "grid", gap: "10px" }}>
            {sizes.map(size => {
              const count = inventory[size];
              const needed = bladesNeeded[size] || 0;
              const isLow = count <= 2;
              const isOut = count === 0;

              return (
                <Card key={size} style={{
                  padding: "14px 16px",
                  borderLeft: `4px solid ${isOut ? "#C62828" : isLow ? "#E65100" : "#2E7D32"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "18px", color: theme.text }}>{size}</div>
                      {needed > 0 && (
                        <div style={{ fontSize: "11px", color: theme.warning, fontWeight: "600", marginTop: "2px" }}>
                          {needed} needed for jobs
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => addStock(size, -1)} disabled={count === 0} style={{
                        width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                        background: "white", cursor: count > 0 ? "pointer" : "default", fontSize: "18px",
                        fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center",
                        color: count > 0 ? theme.text : theme.border,
                      }}>−</button>

                      {editing === size ? (
                        <input value={editVal} onChange={e => setEditVal(e.target.value)}
                          onBlur={() => updateStock(size)} onKeyDown={e => e.key === "Enter" && updateStock(size)}
                          autoFocus type="number"
                          style={{
                            width: "50px", textAlign: "center", padding: "4px", fontSize: "18px",
                            fontWeight: "800", border: `2px solid ${theme.primary}`, borderRadius: "8px",
                            fontFamily: "'DM Sans', sans-serif", outline: "none",
                          }} />
                      ) : (
                        <div onClick={() => { setEditing(size); setEditVal(count.toString()); }}
                          style={{
                            minWidth: "44px", textAlign: "center", fontSize: "20px", fontWeight: "800",
                            color: isOut ? "#C62828" : isLow ? "#E65100" : theme.text,
                            cursor: "pointer", padding: "2px 8px", borderRadius: "8px",
                            background: isOut ? "#FFEBEE" : isLow ? "#FFF3E0" : "transparent",
                          }}>
                          {count}
                        </div>
                      )}

                      <button onClick={() => addStock(size, 1)} style={{
                        width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${theme.border}`,
                        background: "white", cursor: "pointer", fontSize: "18px", fontWeight: "700",
                        display: "flex", alignItems: "center", justifyContent: "center", color: theme.primary,
                      }}>+</button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {Object.keys(bladesNeeded).length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 12px" }}>🛒 Shopping List for Pending Jobs</h3>
              <Card style={{ background: "#FFF8E1" }}>
                {Object.entries(bladesNeeded).sort().map(([size, needed]) => {
                  const have = inventory[size] || 0;
                  const toBuy = Math.max(0, needed - have);
                  return toBuy > 0 ? (
                    <div key={size} style={{
                      display: "flex", justifyContent: "space-between", padding: "8px 0",
                      borderBottom: `1px solid #FFE082`, fontSize: "14px",
                    }}>
                      <span style={{ fontWeight: "600" }}>{size} blades</span>
                      <span style={{ fontWeight: "700", color: "#E65100" }}>Need to buy: {toBuy}</span>
                    </div>
                  ) : null;
                })}
                {Object.entries(bladesNeeded).every(([size, needed]) => (inventory[size] || 0) >= needed) && (
                  <div style={{ textAlign: "center", padding: "12px", color: "#2E7D32", fontWeight: "600" }}>
                    ✓ You have all the blades needed!
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CALENDAR ───
  function CalendarView() {
    const theme = useContext(ThemeContext) || themeLight;
    const [currentMonth, setCurrentMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(null);

    const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

    const jobsByDate = {};
    scheduledJobs.forEach(j => {
      if (!j.scheduledDate) return;
      jobsByDate[j.scheduledDate] = jobsByDate[j.scheduledDate] || [];
      jobsByDate[j.scheduledDate].push(j);
    });

    const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

    const dayCells = [];
    for (let i = 0; i < firstDay; i++) dayCells.push(<div key={`pad-${i}`} style={{ minHeight: "40px", background: "transparent" }} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      const dayJobs = jobsByDate[dateStr] || [];
      const isToday = dateStr === todayStr;
      const isSelected = selectedDate === dateStr;
      dayCells.push(
        <button
          key={d}
          type="button"
          onClick={() => setSelectedDate(dateStr)}
          style={{
            minHeight: "40px",
            border: "none",
            borderRadius: "10px",
            background: isSelected ? theme.primary : isToday ? "#E3F2FD" : "transparent",
            color: isSelected ? "white" : isToday ? theme.primary : theme.text,
            fontWeight: isToday ? "700" : "600",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 0",
          }}
        >
          <span>{d}</span>
          {dayJobs.length > 0 && (
            <span style={{
              fontSize: "10px",
              marginTop: "2px",
              opacity: isSelected ? 1 : 0.8,
            }}>
              {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      );
    }

    const displayJobs = selectedDate
      ? (jobsByDate[selectedDate] || [])
      : scheduledJobs.filter(j => {
          if (!j.scheduledDate) return false;
          const [y, m] = j.scheduledDate.split("-").map(Number);
          return y === year && m === month + 1;
        }).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    return (
      <div>
        <TopBar title="Calendar" />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <button onClick={prevMonth} style={{ ...baseBtn, padding: "8px 14px", background: theme.border, color: theme.text }}>‹</button>
            <span style={{ fontSize: "17px", fontWeight: "700", color: theme.text }}>{monthLabel}</span>
            <button onClick={nextMonth} style={{ ...baseBtn, padding: "8px 14px", background: theme.border, color: theme.text }}>›</button>
          </div>

          <Card style={{ padding: "12px", marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} style={{ textAlign: "center", fontSize: "11px", fontWeight: "700", color: theme.textLight }}>{day}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {dayCells}
            </div>
          </Card>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: theme.text, margin: "0 0 12px" }}>
            {selectedDate ? `Appointments — ${formatDate(selectedDate)}` : `Upcoming — ${monthLabel}`}
          </h3>
          {displayJobs.length > 0 ? (
            displayJobs.map(j => {
              const customer = customers.find(c => c.id === j.customerId);
              return (
                <Card key={j.id} onClick={() => nav("jobs", "detail", j)} style={{ marginBottom: "10px", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>{j.customerName}</div>
                      <div style={{ fontSize: "12px", color: theme.textLight }}>
                        {formatDate(j.scheduledDate)} · {j.blades.length} blades · ${j.price}
                      </div>
                      {customer?.address && (
                        <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "4px" }}>📍 {customer.address}</div>
                      )}
                    </div>
                    <StatusBadge status={j.status} />
                  </div>
                </Card>
              );
            })
          ) : (
            <div style={{ textAlign: "center", padding: "24px", color: theme.textLight, fontSize: "14px" }}>
              {selectedDate ? "No appointments this day." : "No scheduled appointments this month."}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RENDER ───
  const renderView = () => {
    if (view === "customers" && subView === "new") return <NewCustomerView />;
    if (view === "customers" && subView === "edit") return <EditCustomerView />;
    if (view === "customers" && subView === "detail") return <CustomerDetailView customer={selectedItem} />;
    if (view === "customers") return <CustomerListView />;
    if (view === "jobs" && subView === "detail") return <JobDetailView job={selectedItem} isEmployee={userRole === "employee"} />;
    if (view === "jobs") return <JobsListView />;
    if (view === "inventory" && subView === "survey") return <BlockSurveyView />;
    if (view === "inventory") return <InventoryView />;
    if (view === "calendar") return <CalendarView />;
    if (view === "profits") return <ProfitDashboard jobs={jobsWithBladeCosts} inventory={inventoryForDashboard} expenses={expenses} onExpenseAdded={addExpenseToFirestore} />;
    if (view === "home" && userRole === "employee") return <EmployeeHomeView />;
    if (view === "home") return <HomeView />;
    return <HomeView />;
  };

  if (auth && authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <span style={{ fontFamily: "'DM Sans', sans-serif", color: theme.textLight }}>Loading…</span>
      </div>
    );
  }

  const pinConfigured = typeof process.env.NEXT_PUBLIC_ADMIN_PIN === "string" && process.env.NEXT_PUBLIC_ADMIN_PIN.trim() !== "";

  return (
    <ThemeContext.Provider value={theme}>
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      maxWidth: "480px",
      margin: "0 auto",
      background: theme.bg,
      color: theme.text,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      boxShadow: isDark ? "0 0 40px rgba(0,0,0,0.2)" : "0 0 40px rgba(0,0,0,0.08)",
      colorScheme: isDark ? "dark" : "light",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {mounted && authUser && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: theme.border, fontSize: "13px", color: theme.text }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authUser.email}</span>
          <button type="button" onClick={() => firebaseSignOut(auth)} style={{ ...baseBtn, padding: "6px 12px", fontSize: "12px", background: "transparent", color: theme.primary }}>Sign out</button>
        </div>
      )}
      {mounted && !db && (
        <div style={{ padding: "8px 16px", background: theme.warning, color: "white", fontSize: "12px", fontWeight: "600", textAlign: "center" }}>
          Demo mode – data is not saved. Connect Firebase to persist.
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "70px" }}>
        {renderView()}
      </div>
      <BottomNav active={view} setView={(v) => nav(v)} userRole={userRole} />
      <PinModal
        show={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUnlock={() => {
          sessionStorage.setItem(ADMIN_UNLOCKED_KEY, "true");
          setUserRole("admin");
        }}
      />
    </div>
    </ThemeContext.Provider>
  );
}
