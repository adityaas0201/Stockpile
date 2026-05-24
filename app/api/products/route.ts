import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireStaleReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET() {
  // Lazy cleanup: expire stale reservations before reporting stock
  await expireStaleReservations();

  const products = await prisma.product.findMany({
    include: {
      stockLevels: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = products.map((p: any) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    unitPrice: Number(p.unitPrice),
    stock: p.stockLevels.map((s: any) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseCode: s.warehouse.code,
      location: s.warehouse.location,
      total: s.totalUnits,
      reserved: s.reservedUnits,
      available: s.totalUnits - s.reservedUnits,
    })),
  }));

  return NextResponse.json(result);
}
