/**
 * Flight History API Routes
 * Provides endpoints for listing and retrieving flight data
 */

import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';

/**
 * Flight list item response type
 */
interface FlightListItem {
  id: string;
  droneId: string;
  startTime: Date;
  endTime: Date | null;
}

/**
 * Flight details response type
 */
interface FlightDetails extends FlightListItem {
  telemetry: Array<{
    id: string;
    lat: number;
    lon: number;
    alt: number;
    battery: number;
    heading: number | null;
    groundspeed: number | null;
    ts: Date;
  }>;
}

/**
 * Flight routes plugin
 */
const flightRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /flights
   * List all flights with droneId, startTime, endTime, status
   */
  fastify.get('/flights', async (_request, _reply) => {
    const flights = await prisma.flight.findMany({
      include: {
        drone: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    const flightList: Array<{
      id: string;
      droneId: string;
      droneName: string;
      startTime: Date;
      endTime: Date | null;
      status: 'active' | 'completed';
    }> = flights.map((flight) => ({
      id: flight.id,
      droneId: flight.droneId,
      droneName: flight.drone.name,
      startTime: flight.startTime,
      endTime: flight.endTime,
      status: flight.endTime ? 'completed' : 'active',
    }));

    return flightList;
  });

  /**
   * GET /flights/:id
   * Get flight details with telemetry data points
   */
  fastify.get<{ Params: { id: string } }>('/flights/:id', async (request, reply) => {
    const { id } = request.params;

    const flight = await prisma.flight.findUnique({
      where: { id },
      include: {
        drone: {
          select: {
            id: true,
            name: true,
          },
        },
        telemetry: {
          orderBy: { ts: 'asc' },
          take: 1000,
        },
      },
    });

    if (!flight) {
      return reply.code(404).send({ error: 'Flight not found' });
    }

    const details: FlightDetails = {
      id: flight.id,
      droneId: flight.droneId,
      startTime: flight.startTime,
      endTime: flight.endTime,
      telemetry: flight.telemetry.map((t) => ({
        id: t.id,
        lat: Number(t.lat),
        lon: Number(t.lon),
        alt: Number(t.alt),
        battery: t.battery,
        heading: t.heading ? Number(t.heading) : null,
        groundspeed: t.groundspeed ? Number(t.groundspeed) : null,
        ts: t.ts,
      })),
    };

    return details;
  });

  /**
   * GET /flights/:id/telemetry
   * Get telemetry for a flight (paginated, max 1000 points)
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>('/flights/:id/telemetry', async (request, reply) => {
    const { id } = request.params;
    const page = parseInt(request.query.page || '1', 10);
    const limit = Math.min(parseInt(request.query.limit || '100', 10), 1000);
    const skip = (page - 1) * limit;

    // Verify flight exists
    const flight = await prisma.flight.findUnique({
      where: { id },
    });

    if (!flight) {
      return reply.code(404).send({ error: 'Flight not found' });
    }

    const [telemetry, total] = await Promise.all([
      prisma.telemetry.findMany({
        where: { flightId: id },
        orderBy: { ts: 'asc' },
        skip,
        take: limit,
      }),
      prisma.telemetry.count({
        where: { flightId: id },
      }),
    ]);

    return {
      data: telemetry.map((t) => ({
        id: t.id,
        lat: Number(t.lat),
        lon: Number(t.lon),
        alt: Number(t.alt),
        battery: t.battery,
        heading: t.heading ? Number(t.heading) : null,
        groundspeed: t.groundspeed ? Number(t.groundspeed) : null,
        airspeed: t.airspeed ? Number(t.airspeed) : null,
        voltage: t.voltage ? Number(t.voltage) : null,
        current: t.current ? Number(t.current) : null,
        flightMode: t.flightMode,
        armed: t.armed,
        ts: t.ts,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
};

export default flightRoutes;