import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '../../database/connection';
import { serviceCategories } from '../../database/schema/categories';
import { NotFoundError, ConflictError } from '../../common/errors/app-error';

export class CatalogService {
  async listCategories(includeInactive: boolean = false, parentId?: string) {
    const conditions = [];

    if (!includeInactive) {
      conditions.push(eq(serviceCategories.isActive, true));
    }

    if (parentId !== undefined) {
      conditions.push(eq(serviceCategories.parentId, parentId));
    } else {
      // By default list top-level parent categories
      conditions.push(isNull(serviceCategories.parentId));
    }

    const categories = await db.query.serviceCategories.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [asc(serviceCategories.displayOrder), asc(serviceCategories.name)],
    });

    // For top-level categories, attach their active subcategories
    const result = await Promise.all(
      categories.map(async (cat) => {
        const subcategories = await db.query.serviceCategories.findMany({
          where: and(
            eq(serviceCategories.parentId, cat.id),
            includeInactive ? undefined : eq(serviceCategories.isActive, true)
          ),
          orderBy: [asc(serviceCategories.displayOrder), asc(serviceCategories.name)],
        });

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          iconKey: cat.iconKey,
          displayOrder: cat.displayOrder,
          isActive: cat.isActive,
          typicalPriceMin: cat.typicalPriceMin ? Number(cat.typicalPriceMin) : null,
          typicalPriceMax: cat.typicalPriceMax ? Number(cat.typicalPriceMax) : null,
          subcategoriesCount: subcategories.length,
          subcategories: subcategories.map((sub) => ({
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            iconKey: sub.iconKey,
            displayOrder: sub.displayOrder,
            isActive: sub.isActive,
            typicalPriceMin: sub.typicalPriceMin ? Number(sub.typicalPriceMin) : null,
            typicalPriceMax: sub.typicalPriceMax ? Number(sub.typicalPriceMax) : null,
          })),
        };
      })
    );

    return result;
  }

  async getCategoryBySlug(slug: string) {
    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, slug),
    });

    if (!category) {
      throw new NotFoundError(`Category with slug '${slug}' not found.`);
    }

    // Fetch active subcategories
    const subcategories = await db.query.serviceCategories.findMany({
      where: and(eq(serviceCategories.parentId, category.id), eq(serviceCategories.isActive, true)),
      orderBy: [asc(serviceCategories.displayOrder), asc(serviceCategories.name)],
    });

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      iconKey: category.iconKey,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      typicalPriceMin: category.typicalPriceMin ? Number(category.typicalPriceMin) : null,
      typicalPriceMax: category.typicalPriceMax ? Number(category.typicalPriceMax) : null,
      subcategories,
    };
  }

  async createCategory(data: any) {
    const existing = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.slug, data.slug),
    });

    if (existing) {
      throw new ConflictError(`Category slug '${data.slug}' already exists.`);
    }

    const [category] = await db.insert(serviceCategories).values({
      name: data.name,
      slug: data.slug,
      description: data.description,
      iconKey: data.iconKey,
      parentId: data.parentId,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      typicalPriceMin: data.typicalPriceMin?.toString(),
      typicalPriceMax: data.typicalPriceMax?.toString(),
    }).returning();

    return category;
  }

  async updateCategory(id: string, data: any) {
    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, id),
    });

    if (!category) {
      throw new NotFoundError(`Category with ID '${id}' not found.`);
    }

    if (data.slug && data.slug !== category.slug) {
      const existing = await db.query.serviceCategories.findFirst({
        where: eq(serviceCategories.slug, data.slug),
      });
      if (existing) {
        throw new ConflictError(`Category slug '${data.slug}' already exists.`);
      }
    }

    const [updated] = await db.update(serviceCategories).set({
      ...(data.name && { name: data.name }),
      ...(data.slug && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.iconKey && { iconKey: data.iconKey }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.typicalPriceMin !== undefined && { typicalPriceMin: data.typicalPriceMin?.toString() }),
      ...(data.typicalPriceMax !== undefined && { typicalPriceMax: data.typicalPriceMax?.toString() }),
      updatedAt: new Date(),
    }).where(eq(serviceCategories.id, id)).returning();

    return updated;
  }

  async listServiceIssues(categorySlugOrId?: string) {
    const issuesMap: Record<string, string[]> = {
      'ac-repair': [
        'Not cooling',
        'Gas refill',
        'Servicing',
        'Installation',
        'Water leakage',
        'Noise or smell',
        'Not turning on',
      ],
      'plumbing': [
        'Leaking tap',
        'Blocked drain',
        'Pipe fitting',
        'Bathroom fitting',
        'Water tank overflow / repair',
        'Low water pressure',
      ],
      'electrical': [
        'Fan repair',
        'Switch or socket',
        'Wiring',
        'Light fitting',
        'MCB / Fuse trip',
        'Inverter checkup',
      ],
      'cleaning': [
        'Deep home cleaning',
        'Kitchen cleaning',
        'Bathroom cleaning',
        'Sofa & carpet shampooing',
        'Balcony & window cleaning',
      ],
      'painting': [
        'Full house painting',
        'Touch up & wall patch',
        'Waterproofing',
        'Single room painting',
        'Exterior weather coat',
      ],
      'carpentry': [
        'Furniture repair',
        'Door or lock fixing',
        'Custom woodwork',
        'Drill & hang',
        'Cupboard hinge repair',
      ],
      'cooking': [
        'Daily meal preparation',
        'Party / event cooking',
        'North Indian meals',
        'South Indian meals',
        'Diet & healthy meal prep',
      ],
    };

    if (categorySlugOrId) {
      const key = categorySlugOrId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const matchedKey = Object.keys(issuesMap).find((k) => k === key || key.includes(k) || k.includes(key));
      if (matchedKey) {
        return { [matchedKey]: issuesMap[matchedKey] };
      }
    }

    return issuesMap;
  }
}

export const catalogService = new CatalogService();
