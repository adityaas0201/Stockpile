import { z } from "zod";

export const ReserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

export type ReserveInput = z.infer<typeof ReserveSchema>;

export const ReservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "RELEASED",
  "EXPIRED",
]);
