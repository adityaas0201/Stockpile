"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StockEntry = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  location: string;
  total: number;
  reserved: number;
  available: number;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  stock: StockEntry[];
};

export function ReserveModal({
  product,
  preselectedWarehouseId,
  onClose,
  onSuccess,
}: {
  product: Product;
  preselectedWarehouseId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(preselectedWarehouseId);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWarehouse = product.stock.find((s) => s.warehouseId === warehouseId);
  const maxQty = selectedWarehouse?.available ?? 0;

  async function handleReserve() {
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `reserve-${product.id}-${warehouseId}-${Date.now()}`;
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ productId: product.id, warehouseId, quantity }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(`Not enough stock — ${data.error}`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      onSuccess();
      router.push(`/reserve/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,10,8,0.85)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          width: "min(520px, 95vw)",
          padding: "2.5rem",
          animation: "fadeUp 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--mist)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
              {product.sku}
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--paper)" }}>
              {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--mist)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Warehouse selector */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--mist)", textTransform: "uppercase", marginBottom: "0.6rem" }}>
            Ship from
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {product.stock.map((sl) => (
              <button
                key={sl.warehouseId}
                onClick={() => { setWarehouseId(sl.warehouseId); setQuantity(1); }}
                disabled={sl.available === 0}
                style={{
                  padding: "0.75rem 1rem",
                  border: `1px solid ${warehouseId === sl.warehouseId ? "var(--paper)" : "var(--border)"}`,
                  background: warehouseId === sl.warehouseId ? "rgba(245,240,232,0.05)" : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: sl.available > 0 ? "pointer" : "not-allowed",
                  opacity: sl.available === 0 ? 0.4 : 1,
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--paper)" }}>
                    {sl.warehouseCode}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--mist)" }}>
                    {sl.location}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: sl.available <= 3 ? "var(--rust)" : "var(--mist)" }}>
                  {sl.available} available
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--mist)", textTransform: "uppercase", marginBottom: "0.6rem" }}>
            Quantity
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{
                width: "36px", height: "36px", border: "1px solid var(--border)", background: "transparent",
                color: "var(--paper)", fontSize: "1.1rem", cursor: "pointer", fontFamily: "var(--font-mono)",
              }}
            >
              −
            </button>
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1.8rem", color: "var(--paper)", minWidth: "2rem", textAlign: "center" }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
              style={{
                width: "36px", height: "36px", border: "1px solid var(--border)", background: "transparent",
                color: "var(--paper)", fontSize: "1.1rem", cursor: "pointer", fontFamily: "var(--font-mono)",
              }}
            >
              +
            </button>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--mist)" }}>
              max {maxQty}
            </span>
          </div>
        </div>

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem",
            border: "1px solid var(--border)",
            marginBottom: "1.5rem",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--mist)" }}>
            Total (held for 15 min)
          </span>
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1.4rem", color: "var(--paper)" }}>
            ${(product.unitPrice * quantity).toFixed(2)}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "0.75rem 1rem", border: "1px solid var(--rust)", background: "rgba(196,69,26,0.08)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--rust)", marginBottom: "1rem" }}>
            ⚠ {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleReserve}
          disabled={loading || maxQty === 0}
          style={{
            width: "100%",
            padding: "1rem",
            background: loading ? "var(--border)" : "var(--paper)",
            color: "var(--ink)",
            border: "none",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "RESERVING..." : "RESERVE NOW →"}
        </button>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--mist)", textAlign: "center", marginTop: "0.75rem" }}>
          No charge until confirmed. Reservation expires in 15 minutes.
        </p>
      </div>
    </div>
  );
}
