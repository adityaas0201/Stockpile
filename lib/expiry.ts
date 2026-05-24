import { prisma } from "./prisma";

/**
 * Expire pending reservations whose expiresAt is in the past.
 * Called lazily on every read path and by the cron job.
 * Uses a DB transaction with UPDATE … RETURNING so it's safe under concurrency.
 */
export async function expireStaleReservations(): Promise<number> {
  const now = new Date();

  // Find expired pending reservations and flip them in one shot
  const expired = await prisma.$queryRaw<
    { id: string; product_id: string; warehouse_id: string; quantity: number }[]
  >`
    UPDATE reservations
    SET    status      = 'EXPIRED',
           released_at = ${now},
           updated_at  = ${now}
    WHERE  status      = 'PENDING'
      AND  expires_at <= ${now}
    RETURNING id, product_id, warehouse_id, quantity
  `;

  if (expired.length === 0) return 0;

  // Return units to available stock for each expired reservation
  for (const r of expired) {
    await prisma.$executeRaw`
      UPDATE stock_levels
      SET    reserved_units = GREATEST(reserved_units - ${r.quantity}, 0),
             updated_at     = ${now}
      WHERE  product_id   = ${r.product_id}
        AND  warehouse_id = ${r.warehouse_id}
    `;
  }

  return expired.length;
}
