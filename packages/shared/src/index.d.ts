export type UserRole = 'operator' | 'viewer';
export type StreamStatus = 'online' | 'offline' | 'error';
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}
export interface Client {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Drone {
    id: string;
    name: string;
    clientId: string;
    status: 'idle' | 'flying' | 'maintenance';
    streamUrl?: string;
    streamStatus: StreamStatus;
    lat: number;
    lon: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface Flight {
    id: string;
    droneId: string;
    startTime: Date;
    endTime: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface Telemetry {
    id: string;
    flightId: string;
    droneId: string;
    lat: number;
    lon: number;
    alt: number;
    battery: number;
    heading: number | null;
    groundspeed: number | null;
    airspeed: number | null;
    voltage: number | null;
    current: number | null;
    flightMode: string | null;
    armed: boolean | null;
    mavSystemId: number | null;
    mavComponentId: number | null;
    connectionSource: 'mavlink' | 'simulator';
    ts: Date;
    createdAt: Date;
}
export interface AuthResponse {
    user: Omit<User, 'createdAt' | 'updatedAt'>;
    accessToken: string;
    refreshToken: string;
}
export interface LoginCredentials {
    email: string;
    password: string;
}
export interface RegisterPayload {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
}
export interface JwtPayload {
    userId: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
//# sourceMappingURL=index.d.ts.map