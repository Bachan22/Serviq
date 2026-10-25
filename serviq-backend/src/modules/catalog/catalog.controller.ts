import { FastifyRequest, FastifyReply } from 'fastify';
import { listCategoriesQuerySchema, createCategorySchema, updateCategorySchema } from './catalog.schemas';
import { catalogService } from './catalog.service';
import { BadRequestError } from '../../common/errors/app-error';

export class CatalogController {
  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = listCategoriesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid query parameters', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const { includeInactive, parentId } = parseResult.data;
    const categories = await catalogService.listCategories(includeInactive, parentId);

    return reply.status(200).send({
      success: true,
      data: categories,
    });
  }

  async getCategoryBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const category = await catalogService.getCategoryBySlug(slug);

    return reply.status(200).send({
      success: true,
      data: category,
    });
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createCategorySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid category payload', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const category = await catalogService.createCategory(parseResult.data);
    return reply.status(201).send({
      success: true,
      data: category,
    });
  }

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = updateCategorySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid update payload', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const category = await catalogService.updateCategory(id, parseResult.data);
    return reply.status(200).send({
      success: true,
      data: category,
    });
  }

  async listServiceIssues(request: FastifyRequest, reply: FastifyReply) {
    const { category } = request.query as { category?: string };
    const issues = await catalogService.listServiceIssues(category);
    return reply.status(200).send({
      success: true,
      data: issues,
    });
  }
}

export const catalogController = new CatalogController();
