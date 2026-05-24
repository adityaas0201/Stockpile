"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Reservation = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  unitPrice: number;
  totalPrice: number;
};

function useCountdown(expiresAt: string | null, status: string) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt || status !== "PENDING") return;

    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, status]);

  return remaining;
}

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return { m, s, display: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    PENDING: { color: "var(--gold)", bg: "rgba(201,168,76,0.1)", label: "PENDING" },
    CONFIRMED: { color: "#4a7c59", bg: "rgba(74,124,89,0.1)", label: "CONFIRMED" },
    RELEASED: { color: "var(--mist)", bg: "rgba(138,136,128,0.1)", label: "CANCELLED" },
    EXPIRED: { color: "var(--rust)", bg: "rgba(196,69,26,0.1)", label: "EXPIRED" },
  };
  const c = cfg[status] ?? cfg.PENDING;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.65rem",
        letterSpacing: "0.14em",
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.color}33`,
        padding: "3px 10px",
      }}
    >
      {c.label}
    </span>
  );
}

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "release" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const remaining = useCountdown(reservation?.expiresAt ?? null, reservation?.status ?? "");
  const { display: countdownDisplay, m, s } = formatMs(remaining);
  const urgency = remaining < 60_000 && reservation?.status === "PENDING";

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      setReservation(await res.json());
      setErrorMsg(null);
    } catch {
      setErrorMsg("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
    const interval = setInterval(fetchReservation, 10000);
    return () => clearInterval(interval);
  }, [fetchReservation]);

  // Auto-detect expiry
  useEffect(() => {
    if (remaining === 0 && reservation?.status === "PENDING") {
      setTimeout(fetchReservation, 1500);
    }
  }, [remaining, reservation?.status, fetchReservation]);

  async function confirm() {
    setActionLoading("confirm");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": `confirm-${id}-${Date.now()}` },
      });
      const data = await res.json();
      if (res.status === 410) {
        setErrorMsg("⏱ Reservation expired before payment could be processed.");
        setReservation((r) => r ? { ...r, status: "EXPIRED" } : r);
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error ?? "Confirmation failed");
        return;
      }
      setReservation(data);
    } finally {
      setActionLoading(null);
    }
  }

  async function release() {
    setActionLoading("release");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error ?? "Release failed");
        return;
      }
      setReservation(await res.json());
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--mist)", letterSpacing: "0.2em" }}>
        LOADING...
      </span>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
      <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "2rem", color: "var(--mist)" }}>Not found</span>
      <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--rust)", letterSpacing: "0.1em" }}>← Back to catalogue</Link>
    </div>
  );

  if (!reservation) return null;

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isTerminal = reservation.status === "RELEASED" || reservation.status === "EXPIRED";

  return (
    <main style={{ minHeight: "100vh", background: "var(--ink)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 2rem", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,8,0.95)", backdropFilter: "blur(12px)" }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper)", textDecoration: "none" }}>
          STOCKPILE
        </Link>
        <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--mist)", textDecoration: "none", letterSpacing: "0.08em" }}>
          ← BACK TO CATALOGUE
        </Link>
      </header>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 2rem" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--mist)", letterSpacing: "0.12em", marginBottom: "0.5rem" }}>
              RESERVATION #{reservation.id.slice(-8).toUpperCase()}
            </p>
            <h1 style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 300, fontSize: "2rem", color: "var(--paper)" }}>
              Checkout
            </h1>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        {/* Countdown — only for pending */}
        {isPending && (
          <div
            style={{
              background: urgency ? "rgba(196,69,26,0.08)" : "var(--card)",
              border: `1px solid ${urgency ? "var(--rust)" : "var(--border)"}`,
              padding: "1.5rem 2rem",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.3s",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.14em", color: urgency ? "var(--rust)" : "var(--mist)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                {urgency ? "⚠ EXPIRING SOON" : "Reservation expires in"}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: "3.5rem",
                  color: urgency ? "var(--rust)" : "var(--paper)",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  animation: urgency ? "countdown-tick 1s ease infinite" : "none",
                }}
              >
                {countdownDisplay}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--mist)", marginBottom: "0.25rem" }}>Expires</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--paper)" }}>
                {new Date(reservation.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMED banner */}
        {isConfirmed && (
          <div style={{ background: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.4)", padding: "1.5rem 2rem", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "1.5rem" }}>✓</span>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "#4a7c59", letterSpacing: "0.1em" }}>PURCHASE CONFIRMED</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--mist)", marginTop: "0.25rem" }}>
                Confirmed at {new Date(reservation.confirmedAt!).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* EXPIRED / RELEASED banner */}
        {isTerminal && (
          <div style={{ background: "rgba(196,69,26,0.05)", border: "1px solid rgba(196,69,26,0.3)", padding: "1.5rem 2rem", marginBottom: "2rem" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--rust)", letterSpacing: "0.1em" }}>
              {reservation.status === "EXPIRED" ? "RESERVATION EXPIRED — Units returned to stock" : "RESERVATION CANCELLED — Units returned to stock"}
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={{ padding: "0.75rem 1rem", border: "1px solid var(--rust)", background: "rgba(196,69,26,0.08)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--rust)", marginBottom: "1.5rem" }}>
            {errorMsg}
          </div>
        )}

        {/* Order details */}
        <div style={{ border: "1px solid var(--border)", marginBottom: "2rem" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.14em", color: "var(--mist)", textTransform: "uppercase" }}>Order details</span>
          </div>
          {[
            ["Product", reservation.productName],
            ["SKU", reservation.productSku],
            ["Warehouse", reservation.warehouseName],
            ["Quantity", `${reservation.quantity} unit${reservation.quantity > 1 ? "s" : ""}`],
            ["Unit price", `$${reservation.unitPrice.toFixed(2)}`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "0.875rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--mist)" }}>{label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--paper)" }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "1.25rem 1.5rem", background: "rgba(245,240,232,0.02)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--paper)", letterSpacing: "0.08em" }}>TOTAL</span>
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1.4rem", color: "var(--paper)" }}>
              ${reservation.totalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              onClick={confirm}
              disabled={!!actionLoading}
              style={{
                width: "100%", padding: "1.1rem",
                background: actionLoading === "confirm" ? "var(--border)" : "var(--paper)",
                color: "var(--ink)", border: "none",
                fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                letterSpacing: "0.14em", textTransform: "uppercase",
                cursor: actionLoading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {actionLoading === "confirm" ? "PROCESSING..." : "CONFIRM PURCHASE →"}
            </button>
            <button
              onClick={release}
              disabled={!!actionLoading}
              style={{
                width: "100%", padding: "0.9rem",
                background: "transparent", color: "var(--mist)",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                letterSpacing: "0.12em", textTransform: "uppercase",
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              {actionLoading === "release" ? "CANCELLING..." : "CANCEL RESERVATION"}
            </button>
          </div>
        )}

        {(isConfirmed || isTerminal) && (
          <Link
            href="/"
            style={{
              display: "block", width: "100%", padding: "1rem",
              background: "var(--card)", color: "var(--paper)",
              border: "1px solid var(--border)", textAlign: "center",
              fontFamily: "var(--font-mono)", fontSize: "0.7rem",
              letterSpacing: "0.12em", textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            ← BROWSE MORE PRODUCTS
          </Link>
        )}
      </div>
    </main>
  );
}
