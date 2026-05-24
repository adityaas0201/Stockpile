"use client";

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

const CATEGORY_GLYPHS: Record<string, string> = {
  Keyboards: "⌨",
  Audio: "◉",
  Displays: "▣",
  Mice: "◈",
  Accessories: "⬡",
};

function StockBar({ available, total }: { available: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((available / total) * 100);
  const color = available === 0 ? "#3a3a38" : available <= 3 ? "#c4451a" : available <= 10 ? "#c9a84c" : "#4a7c59";

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div style={{ height: "2px", background: "var(--border)", borderRadius: "1px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  onReserve,
}: {
  products: Product[];
  onReserve: (product: Product, warehouseId: string) => void;
}) {
  const categories = [...new Set(products.map((p) => p.category))].sort();

  return (
    <div>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: "3rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1.25rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "1rem" }}>{CATEGORY_GLYPHS[cat] ?? "◆"}</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                letterSpacing: "0.16em",
                color: "var(--mist)",
                textTransform: "uppercase",
              }}
            >
              {cat}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "1px",
              border: "1px solid var(--border)",
            }}
          >
            {products
              .filter((p) => p.category === cat)
              .map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onReserve={onReserve}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductCard({
  product,
  onReserve,
}: {
  product: Product;
  onReserve: (product: Product, warehouseId: string) => void;
}) {
  const totalAvailable = product.stock.reduce((s, sl) => s + sl.available, 0);
  const isOutOfStock = totalAvailable === 0;
  const isLowStock = totalAvailable > 0 && totalAvailable <= 5;

  return (
    <div
      style={{
        background: "var(--card)",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        transition: "background 0.2s",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--card-light)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
      }}
    >
      {/* SKU + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            color: "var(--mist)",
            letterSpacing: "0.1em",
          }}
        >
          {product.sku}
        </span>
        {isLowStock && !isOutOfStock && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              letterSpacing: "0.12em",
              color: "var(--rust)",
              background: "rgba(196,69,26,0.12)",
              padding: "2px 8px",
              border: "1px solid rgba(196,69,26,0.3)",
            }}
          >
            LOW STOCK
          </span>
        )}
        {isOutOfStock && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              letterSpacing: "0.12em",
              color: "var(--mist)",
              background: "rgba(138,136,128,0.1)",
              padding: "2px 8px",
              border: "1px solid var(--border)",
            }}
          >
            OUT OF STOCK
          </span>
        )}
      </div>

      {/* Name + price */}
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "1.05rem",
            color: "var(--paper)",
            lineHeight: 1.2,
            marginBottom: "0.5rem",
          }}
        >
          {product.name}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            color: "var(--mist)",
            lineHeight: 1.5,
          }}
        >
          {product.description}
        </p>
      </div>

      {/* Price */}
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 300,
          fontSize: "1.6rem",
          color: "var(--paper)",
          fontStyle: "italic",
        }}
      >
        ${product.unitPrice.toFixed(2)}
      </div>

      {/* Warehouse stock breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.14em",
            color: "var(--mist)",
            textTransform: "uppercase",
            marginBottom: "0.25rem",
          }}
        >
          Stock by warehouse
        </div>
        {product.stock.map((sl) => (
          <div key={sl.warehouseId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--paper)" }}>
                  {sl.warehouseCode}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: "var(--mist)", marginLeft: "0.5rem" }}>
                  {sl.location}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.65rem",
                    color: sl.available === 0 ? "var(--mist)" : sl.available <= 3 ? "var(--rust)" : "var(--paper)",
                    fontWeight: 500,
                  }}
                >
                  {sl.available} avail
                </span>
                {sl.available > 0 && (
                  <button
                    onClick={() => onReserve(product, sl.warehouseId)}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--ink)",
                      background: "var(--paper)",
                      border: "none",
                      padding: "3px 10px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--rust)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--paper)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--paper)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
                    }}
                  >
                    Reserve
                  </button>
                )}
              </div>
            </div>
            <StockBar available={sl.available} total={sl.total} />
          </div>
        ))}
      </div>
    </div>
  );
}
