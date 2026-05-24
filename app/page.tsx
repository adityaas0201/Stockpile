"use client";

import { useState, useEffect } from "react";
import { ProductGrid } from "@/components/ProductGrid";
import { ReserveModal } from "@/components/ReserveModal";

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

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ product: Product; warehouseId: string } | null>(null);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      setProducts(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 15000);
    return () => clearInterval(interval);
  }, []);

  const totalAvailable = products.reduce(
    (sum, p) => sum + p.stock.reduce((s, sl) => s + sl.available, 0),
    0
  );

  return (
    <main className="min-h-screen" style={{ background: "var(--ink)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "0 2rem",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(10,10,8,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper)" }}>
            STOCKPILE
          </div>
          <div style={{ width: "1px", height: "20px", background: "var(--border)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--mist)", letterSpacing: "0.08em" }}>
            INVENTORY RESERVE SYSTEM
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span className="live-dot" style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--rust)", letterSpacing: "0.1em" }}>
            LIVE
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--mist)" }}>
            {totalAvailable} units available
          </span>
        </div>
      </header>

      <div style={{ background: "var(--rust)", height: "32px", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div className="animate-ticker" style={{ display: "flex", whiteSpace: "nowrap", gap: "4rem" }}>
          {[...Array(6)].flatMap((_, i) =>
            products.slice(0, 4).map((p, j) => (
              <span key={`${i}-${j}`} style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--paper)", opacity: 0.9 }}>
                {p.sku} — ${p.unitPrice.toFixed(2)} — {p.stock.reduce((s, sl) => s + sl.available, 0)} AVAIL &nbsp;&nbsp;/&nbsp;&nbsp;
              </span>
            ))
          )}
        </div>
      </div>

      <section style={{ padding: "4rem 2rem 2rem", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: "2rem", marginBottom: "3rem" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.14em", color: "var(--rust)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
              ◆ LIVE CATALOGUE
            </p>
            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "clamp(2.5rem, 5vw, 4rem)", lineHeight: 1.05, color: "var(--paper)", fontStyle: "italic" }}>
              Reserve before it's gone.
            </h1>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--mist)", lineHeight: 1.7, textAlign: "right", borderRight: "2px solid var(--rust)", paddingRight: "1rem" }}>
            <div>{products.length} products</div>
            <div>3 warehouses</div>
            <div>15min reservation window</div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: "6rem", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--mist)", letterSpacing: "0.2em" }}>
              LOADING INVENTORY...
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "1.5rem", border: "1px solid var(--rust)", background: "rgba(196,69,26,0.08)", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--rust)" }}>
            ⚠ {error}
          </div>
        )}

        {!loading && !error && (
          <ProductGrid
            products={products}
            onReserve={(product, warehouseId) => setModal({ product, warehouseId })}
          />
        )}
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "2rem", marginTop: "4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--mist)" }}>STOCKPILE © 2025 — INVENTORY RESERVE SYSTEM</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--mist)" }}>Reservations expire after 15 minutes</span>
      </footer>

      {modal && (
        <ReserveModal
          product={modal.product}
          preselectedWarehouseId={modal.warehouseId}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); fetchProducts(); }}
        />
      )}
    </main>
  );
}
