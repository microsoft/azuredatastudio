export * from './controlRouterApi';
export * from './endpointsRouterApi';
export * from './homeRouterApi';
export * from './hybridDataHomeRouterApi';
export * from './infoRouterApi';
export * from './logsRouterApi';
export * from './metricRouterApi';
export * from './registrationRouterApi';
export * from './sqlInstanceRouterApi';
export * from './sqlOperatorUpgradeRouterApi';
export * from './tokenRouterApi';
import * as fs from 'fs';
import * as http from 'http';
import { ControlRouterApi } from './controlRouterApi';
import { EndpointsRouterApi } from './endpointsRouterApi';
import { HomeRouterApi } from './homeRouterApi';
import { HybridDataHomeRouterApi } from './hybridDataHomeRouterApi';
import { InfoRouterApi } from './infoRouterApi';
import { LogsRouterApi } from './logsRouterApi';
import { MetricRouterApi } from './metricRouterApi';
import { RegistrationRouterApi } from './registrationRouterApi';
import { SqlInstanceRouterApi } from './sqlInstanceRouterApi';
import { SqlOperatorUpgradeRouterApi } from './sqlOperatorUpgradeRouterApi';
import { TokenRouterApi } from './tokenRouterApi';

export class HttpError extends Error {
    constructor (public response: http.IncomingMessage, public body: any, public statusCode?: number) {
        super('HTTP request failed');
        this.name = 'HttpError';
    }
}

export interface RequestDetailedFile {
    value: Buffer;
    options?: {
        filename?: string;
        contentType?: string;
    }
}

export type RequestFile = string | Buffer | fs.ReadStream | RequestDetailedFile;

export const APIS = [ControlRouterApi, EndpointsRouterApi, HomeRouterApi, HybridDataHomeRouterApi, InfoRouterApi, LogsRouterApi, MetricRouterApi, RegistrationRouterApi, SqlInstanceRouterApi, SqlOperatorUpgradeRouterApi, TokenRouterApi];
