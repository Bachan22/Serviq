import { FastifyRequest, FastifyReply } from 'fastify';
import { workerService } from './worker.service';
import {
  updateWorkerProfileSchema,
  updateWorkerAvailabilitySchema,
  updateWorkerLocationSchema,
  addWorkerSkillSchema,
  adminVerifyWorkerSchema,
} from './worker.schemas';

export class WorkerController {
  async getOwnProfile(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const profile = await workerService.getOwnProfile(workerId);
    return reply.status(200).send({
      success: true,
      data: profile,
    });
  }

  async updateOwnProfile(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const parsed = updateWorkerProfileSchema.parse(request.body);
    const updated = await workerService.updateOwnProfile(workerId, parsed);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async updateAvailability(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { isOnline } = updateWorkerAvailabilitySchema.parse(request.body);
    const updated = await workerService.updateAvailability(workerId, isOnline);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async updateLocation(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { latitude, longitude } = updateWorkerLocationSchema.parse(request.body);
    const updated = await workerService.updateLocation(workerId, latitude, longitude);
    return reply.status(200).send({
      success: true,
      data: updated,
    });
  }

  async getOwnSkills(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const skills = await workerService.getSkills(workerId);
    return reply.status(200).send({
      success: true,
      data: skills,
    });
  }

  async addSkill(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const parsed = addWorkerSkillSchema.parse(request.body);
    const skill = await workerService.addSkill(workerId, parsed);
    return reply.status(201).send({
      success: true,
      data: skill,
    });
  }

  async removeSkill(request: FastifyRequest, reply: FastifyReply) {
    const workerId = request.user.id;
    const { categoryId } = request.params as { categoryId: string };
    const result = await workerService.removeSkill(workerId, categoryId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async getPublicProfile(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const profile = await workerService.getPublicProfile(id);
    return reply.status(200).send({
      success: true,
      data: profile,
    });
  }

  async adminVerifyWorker(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { isVerified, verificationStatus } = adminVerifyWorkerSchema.parse(request.body);
    const result = await workerService.adminVerifyWorker(id, isVerified, verificationStatus);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}

export const workerController = new WorkerController();
