import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/redis";
import { ReserveSchema } from "@/lib/schemas";
import { expireStaleReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

const RESERVATION_TTL_MINUTES = 15;

export async function POST(req: NextRequest) {
  // ── Idempotency ─────────────────────────────────────────────────────────────
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

  // ── Validate body ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  const parsed = ReserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const lockKey = `reserve:${productId}:${warehouseId}`;

  // ── Acquire distributed lock ─────────────────────────────────────────────────
  const lockToken = await acquireLock(lockKey, 8000);
  if (!lockToken) {
    return NextResponse.json(
      { error: "Service busy, please retry." },
      { status: 503 }
    );
  }

  try {
    // Expire stale reservations first so we don't count them
    await expireStaleReservations();

    // ── Atomic check + reserve in a transaction ──────────────────────────────
    const reservation = await prisma.$transaction(async (tx: any) => {
      // Lock the stock row with SELECT FOR UPDATE so concurrent transactions queue
      const stock = await tx.$queryRaw<
        { total_units: number; reserved_units: number }[]
      >`
        SELECT total_units, reserved_units
        FROM   stock_levels
        WHERE  product_id   = ${productId}
          AND  warehouse_id = ${warehouseId}
        FOR UPDATE
      `;

      if (!stock.length) {
        throw new NotEnoughStockError("No stock record found");
      }

      const { total_units, reserved_units } = stock[0];
      const available = total_units - reserved_units;

      if (available < quantity) {
        throw new NotEnoughStockError(
          `Only ${available} unit(s) available, requested ${quantity}`
        );
      }

      // Increment reserved_units
      await tx.$executeRaw`
        UPDATE stock_levels
        SET    reserved_units = reserved_units + ${quantity},
               updated_at     = NOW()
        WHERE  product_id   = ${productId}
          AND  warehouse_id = ${warehouseId}
      `;

      const expiresAt = new Date(
        Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
      );

      return tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
        },
        include: {
          product: true,
          warehouse: true,
        },
      });
    });

    const responseBody = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      productSku: reservation.product.sku,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      unitPrice: Number(reservation.product.unitPrice),
      totalPrice: Number(reservation.product.unitPrice) * reservation.quantity,
    };

    // Save idempotency record
    if (idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          reservationId: reservation.id,
          endpoint: "POST /api/reservations",
          responseBody,
          statusCode: 201,
        },
      });
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    if (err instanceof NotEnoughStockError) {
      const responseBody = { error: err.message };
      if (idempotencyKey) {
        await prisma.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            endpoint: "POST /api/reservations",
            responseBody,
            statusCode: 409,
          },
        });
      }
      return NextResponse.json(responseBody, { status: 409 });
    }
    console.error("Reservation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

class NotEnoughStockError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "NotEnoughStockError";
  }
}
