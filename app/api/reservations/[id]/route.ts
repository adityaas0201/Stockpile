import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Lazy expiry check
  if (reservation.status === "PENDING" && reservation.expiresAt <= new Date()) {
    const now = new Date();
    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: "EXPIRED", releasedAt: now },
      include: { product: true, warehouse: true },
    });
    await prisma.$executeRaw`
      UPDATE stock_levels
      SET reserved_units = GREATEST(reserved_units - ${reservation.quantity}, 0),
          updated_at = ${now}
      WHERE product_id = ${reservation.productId}
        AND warehouse_id = ${reservation.warehouseId}
    `;
    return NextResponse.json(formatReservation(updated));
  }

  return NextResponse.json(formatReservation(reservation));
}

function formatReservation(r: any) {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    productSku: r.product.sku,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouse.name,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    unitPrice: Number(r.product.unitPrice),
    totalPrice: Number(r.product.unitPrice) * r.quantity,
  };
}
