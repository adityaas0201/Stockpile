import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
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

  if (reservation.status === "RELEASED" || reservation.status === "EXPIRED") {
    return NextResponse.json(formatReservation(reservation));
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "Confirmed reservations cannot be released through this endpoint." },
      { status: 409 }
    );
  }

  const now = new Date();
  const released = await prisma.reservation.update({
    where: { id },
    data: { status: "RELEASED", releasedAt: now },
    include: { product: true, warehouse: true },
  });

  await prisma.$executeRaw`
    UPDATE stock_levels
    SET reserved_units = GREATEST(reserved_units - ${reservation.quantity}, 0),
        updated_at     = ${now}
    WHERE product_id   = ${reservation.productId}
      AND warehouse_id = ${reservation.warehouseId}
  `;

  return NextResponse.json(formatReservation(released));
}

function formatReservation(r: any) {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouse.name,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    releasedAt: r.releasedAt?.toISOString() ?? null,
    unitPrice: Number(r.product.unitPrice),
    totalPrice: Number(r.product.unitPrice) * r.quantity,
  };
}
