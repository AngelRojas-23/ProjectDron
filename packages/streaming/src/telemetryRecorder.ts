/**
 * Telemetry Recorder
 * Batches and saves telemetry data to the database
 * Creates Flight records when drones start sending telemetry
 */

import { PrismaClient } from '@prisma/client';
import type { Telemetry } from '@sd/shared/index.js';

/**
 * Telemetry data input format
 */
interface TelemetryInput {
  droneId: string;
  lat: number;
  lon: number;
  alt: number;
  battery: number;
  heading?: number;
  groundspeed?: number;
  airspeed?: number;
  voltage?: number;
  current?: number;
  flightMode?: string;
  armed?: boolean;
  mavSystemId?: number;
  mavComponentId?: number;
  connectionSource?: string;
  ts: Date;
}

/**
 * TelemetryRecorder class
 * Batches telemetry writes to avoid DB overload
 */
export class TelemetryRecorder {
  private prisma: PrismaClient;
  private buffer: TelemetryInput[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private activeFlight: { droneId: string; flightId: string } | null = null;
  private inactivityTimeout: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 2000;
  private readonly FLUSH_BUFFER_SIZE = 50;
  private readonly INACTIVITY_TIMEOUT_MS = 30000;

  /**
   * Create a new TelemetryRecorder
   */
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  /**
   * Start the recorder
   * Begins periodic flush of telemetry buffer
   */
  start(): void {
    console.log('TelemetryRecorder: Starting...');

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        console.error('TelemetryRecorder: Flush error', err);
      });
    }, this.FLUSH_INTERVAL_MS);

    console.log('TelemetryRecorder: Started');
  }

  /**
   * Stop the recorder
   * Flushes remaining data and closes DB connection
   */
  async stop(): Promise<void> {
    console.log('TelemetryRecorder: Stopping...');

    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }

    // Flush remaining buffer
    await this.flush();

    // Close DB connection
    await this.prisma.$disconnect();

    console.log('TelemetryRecorder: Stopped');
  }

  /**
   * Record a telemetry data point
   * @param telemetry - The telemetry data from the drone
   */
  async record(telemetry: Telemetry): Promise<void> {
    const telemetryInput: TelemetryInput = {
      droneId: telemetry.droneId,
      lat: telemetry.lat,
      lon: telemetry.lon,
      alt: telemetry.alt,
      battery: telemetry.battery,
      heading: telemetry.heading ?? undefined,
      groundspeed: telemetry.groundspeed ?? undefined,
      airspeed: telemetry.airspeed ?? undefined,
      voltage: telemetry.voltage ?? undefined,
      current: telemetry.current ?? undefined,
      flightMode: telemetry.flightMode ?? undefined,
      armed: telemetry.armed ?? undefined,
      mavSystemId: telemetry.mavSystemId ?? undefined,
      mavComponentId: telemetry.mavComponentId ?? undefined,
      connectionSource: telemetry.connectionSource,
      ts: telemetry.ts,
    };

    // Ensure flight exists for this drone
    await this.ensureFlight(telemetry.droneId);

    // Add to buffer
    this.buffer.push(telemetryInput);

    // Flush if buffer is full
    if (this.buffer.length >= this.FLUSH_BUFFER_SIZE) {
      await this.flush();
    }

    // Reset inactivity timer
    this.resetInactivityTimer();
  }

  /**
   * Ensure a flight exists for the given drone
   * Creates a new flight if none exists
   */
  private async ensureFlight(droneId: string): Promise<void> {
    // If we already have an active flight for this drone, skip
    if (this.activeFlight && this.activeFlight.droneId === droneId) {
      return;
    }

    // Check for an existing active flight
    const activeFlight = await this.prisma.flight.findFirst({
      where: {
        droneId,
        endTime: null,
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    if (activeFlight) {
      this.activeFlight = { droneId, flightId: activeFlight.id };
    } else {
      // Create a new flight
      const newFlight = await this.prisma.flight.create({
        data: {
          droneId,
          startTime: new Date(),
        },
      });

      this.activeFlight = { droneId, flightId: newFlight.id };
      console.log(`TelemetryRecorder: Created new flight ${newFlight.id} for drone ${droneId}`);
    }
  }

  /**
   * Reset the inactivity timer
   * When telemetry stops for 30 seconds, end the flight
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }

    this.inactivityTimeout = setTimeout(async () => {
      await this.endActiveFlight();
    }, this.INACTIVITY_TIMEOUT_MS);
  }

  /**
   * End the currently active flight
   */
  private async endActiveFlight(): Promise<void> {
    if (!this.activeFlight) {
      return;
    }

    const { droneId, flightId } = this.activeFlight;

    await this.prisma.flight.update({
      where: { id: flightId },
      data: {
        endTime: new Date(),
      },
    });

    console.log(`TelemetryRecorder: Ended flight ${flightId} for drone ${droneId}`);
    this.activeFlight = null;
  }

  /**
   * Flush the telemetry buffer to the database
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const dataToFlush = [...this.buffer];
    this.buffer = [];

    if (!this.activeFlight) {
      console.warn('TelemetryRecorder: No active flight, skipping flush');
      return;
    }

    try {
      // Create all telemetry points
      const telemetryData = dataToFlush.map((t) => ({
        flightId: this.activeFlight!.flightId,
        droneId: t.droneId,
        lat: t.lat,
        lon: t.lon,
        alt: t.alt,
        battery: t.battery,
        heading: t.heading,
        groundspeed: t.groundspeed,
        airspeed: t.airspeed,
        voltage: t.voltage,
        current: t.current,
        flightMode: t.flightMode,
        armed: t.armed,
        mavSystemId: t.mavSystemId,
        mavComponentId: t.mavComponentId,
        connectionSource: t.connectionSource ?? 'simulator',
        ts: t.ts,
      }));

      await this.prisma.telemetry.createMany({
        data: telemetryData,
      });

      console.log(`TelemetryRecorder: Flushed ${telemetryData.length} telemetry points`);
    } catch (err) {
      console.error('TelemetryRecorder: Failed to flush telemetry', err);
      // Re-add to buffer on failure
      this.buffer = [...dataToFlush, ...this.buffer];
    }
  }
}

export default TelemetryRecorder;