import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Idempotency
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return NextResponse.json(existing.responseBody, {
        status: existing.statusCode,
        headers: { "x-idempotent-replay": "true" },
      });
    }
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "CONFIRMED") {
    const body = formatReservation(reservation);
    return NextResponse.json(body, { status: 200 });
  }

  if (reservation.status !== "PENDING") {
    return NextResponse.json(
      { error: `Reservation is ${reservation.status.toLowerCase()}, cannot confirm.` },
      { status: 409 }
    );
  }

  // Check expiry
  if (reservation.expiresAt <= new Date()) {
    const now = new Date();
    await prisma.reservation.update({
      where: { id },
      data: { status: "EXPIRED", releasedAt: now },
    });
    await prisma.$executeRaw`
      UPDATE stock_levels
      SET reserved_units = GREATEST(reserved_units - ${reservation.quantity}, 0),
          updated_at = ${now}
      WHERE product_id = ${reservation.productId}
        AND warehouse_id = ${reservation.warehouseId}
    `;
    const responseBody = { error: "Reservation has expired" };
    if (idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          reservationId: id,
          endpoint: `POST /api/reservations/${id}/confirm`,
          responseBody,
          statusCode: 410,
        },
      });
    }
    return NextResponse.json(responseBody, { status: 410 });
  }

  const now = new Date();
  const confirmed = await prisma.reservation.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedAt: now },
    include: { product: true, warehouse: true },
  });

  // Remove from reserved (units are now fully sold)
  await prisma.$executeRaw`
    UPDATE stock_levels
    SET total_units    = GREATEST(total_units - ${reservation.quantity}, 0),
        reserved_units = GREATEST(reserved_units - ${reservation.quantity}, 0),
        updated_at     = ${now}
    WHERE product_id   = ${reservation.productId}
      AND warehouse_id = ${reservation.warehouseId}
  `;

  const responseBody = formatReservation(confirmed);
  if (idempotencyKey) {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        reservationId: id,
        endpoint: `POST /api/reservations/${id}/confirm`,
        responseBody,
        statusCode: 200,
      },
    });
  }
  return NextResponse.json(responseBody);
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
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    unitPrice: Number(r.product.unitPrice),
    totalPrice: Number(r.product.unitPrice) * r.quantity,
  };
}
