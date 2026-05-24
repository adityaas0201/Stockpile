import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clean up
  await prisma.idempotencyKey.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "East Coast Hub",
        location: "Newark, NJ",
        code: "ECH-01",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "West Coast Depot",
        location: "Los Angeles, CA",
        code: "WCD-01",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Central Fulfillment",
        location: "Chicago, IL",
        code: "CFC-01",
      },
    }),
  ]);

  console.log(`Created ${warehouses.length} warehouses`);

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        sku: "MECH-KBD-001",
        name: "Tactile Pro Keyboard",
        description:
          "87-key tenkeyless mechanical keyboard with Cherry MX Brown switches. Per-key RGB, anodised aluminium case.",
        category: "Keyboards",
        unitPrice: 189.99,
      },
    }),
    prisma.product.create({
      data: {
        sku: "AUDIO-HP-042",
        name: "Studio Monitor Headphones",
        description:
          "Closed-back reference headphones with 40mm drivers. Flat frequency response, foldable design.",
        category: "Audio",
        unitPrice: 299.0,
      },
    }),
    prisma.product.create({
      data: {
        sku: "DISP-MON-007",
        name: "4K IPS Display 27\"",
        description:
          "27-inch 4K IPS panel, 144Hz, 1ms GtG, HDR600, USB-C 96W charging. Factory calibrated.",
        category: "Displays",
        unitPrice: 649.95,
      },
    }),
    prisma.product.create({
      data: {
        sku: "MECH-MOUSE-003",
        name: "Precision Wireless Mouse",
        description:
          "Ultra-lightweight 58g wireless mouse. 25,000 DPI optical sensor, 70hr battery, 1ms wireless.",
        category: "Mice",
        unitPrice: 149.0,
      },
    }),
    prisma.product.create({
      data: {
        sku: "AUDIO-SPK-011",
        name: "Desktop Studio Monitors (Pair)",
        description:
          "5-inch active studio monitors with Class D amplification. XLR/TRS balanced inputs, 100W total.",
        category: "Audio",
        unitPrice: 449.0,
      },
    }),
    prisma.product.create({
      data: {
        sku: "ACC-HUB-019",
        name: "Thunderbolt 4 Hub Pro",
        description:
          "12-port Thunderbolt 4 dock. Dual 4K displays, 96W charging, 2.5GbE, SD card reader.",
        category: "Accessories",
        unitPrice: 329.0,
      },
    }),
  ]);

  console.log(`Created ${products.length} products`);

  // Stock levels — deliberate scarcity on some to make 409 easy to trigger
  const stockData = [
    // Tactile Pro Keyboard
    {
      productId: products[0].id,
      warehouseId: warehouses[0].id,
      totalUnits: 24,
      reservedUnits: 0,
    },
    {
      productId: products[0].id,
      warehouseId: warehouses[1].id,
      totalUnits: 3,
      reservedUnits: 0,
    },
    {
      productId: products[0].id,
      warehouseId: warehouses[2].id,
      totalUnits: 11,
      reservedUnits: 0,
    },
    // Studio Monitor Headphones
    {
      productId: products[1].id,
      warehouseId: warehouses[0].id,
      totalUnits: 2,
      reservedUnits: 0,
    },
    {
      productId: products[1].id,
      warehouseId: warehouses[1].id,
      totalUnits: 8,
      reservedUnits: 0,
    },
    {
      productId: products[1].id,
      warehouseId: warehouses[2].id,
      totalUnits: 0,
      reservedUnits: 0,
    },
    // 4K IPS Display
    {
      productId: products[2].id,
      warehouseId: warehouses[0].id,
      totalUnits: 1,
      reservedUnits: 0,
    },
    {
      productId: products[2].id,
      warehouseId: warehouses[1].id,
      totalUnits: 5,
      reservedUnits: 0,
    },
    {
      productId: products[2].id,
      warehouseId: warehouses[2].id,
      totalUnits: 3,
      reservedUnits: 0,
    },
    // Precision Wireless Mouse
    {
      productId: products[3].id,
      warehouseId: warehouses[0].id,
      totalUnits: 40,
      reservedUnits: 0,
    },
    {
      productId: products[3].id,
      warehouseId: warehouses[1].id,
      totalUnits: 35,
      reservedUnits: 0,
    },
    {
      productId: products[3].id,
      warehouseId: warehouses[2].id,
      totalUnits: 1,
      reservedUnits: 0,
    },
    // Desktop Studio Monitors
    {
      productId: products[4].id,
      warehouseId: warehouses[0].id,
      totalUnits: 6,
      reservedUnits: 0,
    },
    {
      productId: products[4].id,
      warehouseId: warehouses[1].id,
      totalUnits: 2,
      reservedUnits: 0,
    },
    {
      productId: products[4].id,
      warehouseId: warehouses[2].id,
      totalUnits: 4,
      reservedUnits: 0,
    },
    // Thunderbolt 4 Hub
    {
      productId: products[5].id,
      warehouseId: warehouses[0].id,
      totalUnits: 12,
      reservedUnits: 0,
    },
    {
      productId: products[5].id,
      warehouseId: warehouses[1].id,
      totalUnits: 0,
      reservedUnits: 0,
    },
    {
      productId: products[5].id,
      warehouseId: warehouses[2].id,
      totalUnits: 7,
      reservedUnits: 0,
    },
  ];

  await Promise.all(
    stockData.map((s) =>
      prisma.stockLevel.create({
        data: s,
      })
    )
  );

  console.log(`Created ${stockData.length} stock levels`);
  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
