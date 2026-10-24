import { db, client } from '../connection';
import { serviceCategories } from '../schema/categories';
import { eq } from 'drizzle-orm';

export const initialCategories = [
  {
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Expert water leakage repairs, pipe installations, tap fixes, and drain cleaning.',
    iconKey: 'Wrench',
    displayOrder: 1,
    isActive: true,
    typicalPriceMin: '250.00',
    typicalPriceMax: '1500.00',
    subcategories: [
      { name: 'Leaking Tap & Pipe Repair', slug: 'tap-repair', iconKey: 'Wrench', displayOrder: 1, typicalPriceMin: '250.00', typicalPriceMax: '650.00' },
      { name: 'Drain & Basin Unclogging', slug: 'drain-unclogging', iconKey: 'Wrench', displayOrder: 2, typicalPriceMin: '350.00', typicalPriceMax: '850.00' },
      { name: 'Water Tank & Pipe Installation', slug: 'pipe-installation', iconKey: 'Wrench', displayOrder: 3, typicalPriceMin: '600.00', typicalPriceMax: '1800.00' },
    ],
  },
  {
    name: 'Electrical',
    slug: 'electrical',
    description: 'Certified electricians for fan installations, switchboard repairs, short circuits, and wiring.',
    iconKey: 'Zap',
    displayOrder: 2,
    isActive: true,
    typicalPriceMin: '300.00',
    typicalPriceMax: '2000.00',
    subcategories: [
      { name: 'Ceiling Fan & Light Installation', slug: 'fan-installation', iconKey: 'Zap', displayOrder: 1, typicalPriceMin: '250.00', typicalPriceMax: '600.00' },
      { name: 'Switchboard Repair & Replacement', slug: 'switchboard-repair', iconKey: 'Zap', displayOrder: 2, typicalPriceMin: '200.00', typicalPriceMax: '500.00' },
      { name: 'Inverter & MCB Troubleshooting', slug: 'inverter-wiring', iconKey: 'Zap', displayOrder: 3, typicalPriceMin: '450.00', typicalPriceMax: '1200.00' },
    ],
  },
  {
    name: 'Cleaning',
    slug: 'cleaning',
    description: 'Professional deep cleaning for bathrooms, kitchens, and entire homes.',
    iconKey: 'Sparkles',
    displayOrder: 3,
    isActive: true,
    typicalPriceMin: '400.00',
    typicalPriceMax: '3500.00',
    subcategories: [
      { name: 'Bathroom Deep Cleaning', slug: 'bathroom-cleaning', iconKey: 'Sparkles', displayOrder: 1, typicalPriceMin: '450.00', typicalPriceMax: '950.00' },
      { name: 'Kitchen Chimney & Deep Clean', slug: 'kitchen-cleaning', iconKey: 'Sparkles', displayOrder: 2, typicalPriceMin: '650.00', typicalPriceMax: '1400.00' },
      { name: 'Full Home Deep Sanitization', slug: 'full-home-cleaning', iconKey: 'Sparkles', displayOrder: 3, typicalPriceMin: '1800.00', typicalPriceMax: '4500.00' },
    ],
  },
  {
    name: 'Painting',
    slug: 'painting',
    description: 'Wall touchups, waterproofing, and full interior/exterior painting.',
    iconKey: 'Paintbrush',
    displayOrder: 4,
    isActive: true,
    typicalPriceMin: '500.00',
    typicalPriceMax: '5000.00',
    subcategories: [
      { name: 'Wall Touchup & Seepage Patch', slug: 'wall-touchup', iconKey: 'Paintbrush', displayOrder: 1, typicalPriceMin: '400.00', typicalPriceMax: '1200.00' },
      { name: 'Single Room Painting', slug: 'single-room-painting', iconKey: 'Paintbrush', displayOrder: 2, typicalPriceMin: '1500.00', typicalPriceMax: '4000.00' },
    ],
  },
  {
    name: 'AC repair',
    slug: 'ac-repair',
    description: 'AC servicing, cooling issues, gas refilling, and compressor repairs.',
    iconKey: 'Snowflake',
    displayOrder: 5,
    isActive: true,
    typicalPriceMin: '450.00',
    typicalPriceMax: '2500.00',
    subcategories: [
      { name: 'AC Filter & Jet Wet Service', slug: 'ac-service', iconKey: 'Snowflake', displayOrder: 1, typicalPriceMin: '450.00', typicalPriceMax: '750.00' },
      { name: 'AC Gas Refill & Leak Fix', slug: 'ac-gas-refill', iconKey: 'Snowflake', displayOrder: 2, typicalPriceMin: '1200.00', typicalPriceMax: '2800.00' },
    ],
  },
  {
    name: 'Carpentry',
    slug: 'carpentry',
    description: 'Furniture repair, door locks, hinges, and custom woodwork.',
    iconKey: 'Hammer',
    displayOrder: 6,
    isActive: true,
    typicalPriceMin: '300.00',
    typicalPriceMax: '2500.00',
    subcategories: [
      { name: 'Door Lock & Latch Fitting', slug: 'door-lock-repair', iconKey: 'Hammer', displayOrder: 1, typicalPriceMin: '250.00', typicalPriceMax: '650.00' },
      { name: 'Furniture Assembly & Repair', slug: 'furniture-assembly', iconKey: 'Hammer', displayOrder: 2, typicalPriceMin: '400.00', typicalPriceMax: '1200.00' },
    ],
  },
  {
    name: 'Cooking',
    slug: 'cooking',
    description: 'Home cooks for daily meals and special occasions.',
    iconKey: 'CookingPot',
    displayOrder: 7,
    isActive: true,
    typicalPriceMin: '350.00',
    typicalPriceMax: '1800.00',
    subcategories: [],
  },
  {
    name: 'Appliance repair',
    slug: 'appliance-repair',
    description: 'Repairs for washing machines, refrigerators, and microwaves.',
    iconKey: 'Wrench',
    displayOrder: 8,
    isActive: true,
    typicalPriceMin: '350.00',
    typicalPriceMax: '2200.00',
    subcategories: [],
  },
];

export async function seedCatalog() {
  console.log('Seeding service categories and subcategories...');
  for (const cat of initialCategories) {
    const existing = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, cat.slug),
    });

    let parentId: string;

    if (!existing) {
      const [inserted] = await db.insert(serviceCategories).values({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        iconKey: cat.iconKey,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        typicalPriceMin: cat.typicalPriceMin,
        typicalPriceMax: cat.typicalPriceMax,
      }).returning();
      parentId = inserted.id;
    } else {
      parentId = existing.id;
    }

    // Seed subcategories if present
    for (const sub of cat.subcategories || []) {
      const existingSub = await db.query.serviceCategories.findFirst({
        where: eq(serviceCategories.slug, sub.slug),
      });

      if (!existingSub) {
        await db.insert(serviceCategories).values({
          name: sub.name,
          slug: sub.slug,
          iconKey: sub.iconKey,
          parentId,
          displayOrder: sub.displayOrder,
          isActive: true,
          typicalPriceMin: sub.typicalPriceMin,
          typicalPriceMax: sub.typicalPriceMax,
        });
      }
    }
  }
  console.log('Catalog seeding complete.');
}

if (process.argv[1]?.includes('catalog-seed')) {
  seedCatalog().then(() => client.end()).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
