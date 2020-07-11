export * from './databaseRouterApi';
export * from './databaseValidateRouterApi';
export * from './logsRouterApi';
export * from './metricRouterApi';
export * from './operatorRouterApi';
import * as fs from 'fs';
import * as http from 'http';
import { DatabaseRouterApi } from './databaseRouterApi';
import { DatabaseValidateRouterApi } from './databaseValidateRouterApi';
import { LogsRouterApi } from './logsRouterApi';
import { MetricRouterApi } from './metricRouterApi';
import { OperatorRouterApi } from './operatorRouterApi';

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

export const APIS = [DatabaseRouterApi, DatabaseValidateRouterApi, LogsRouterApi, MetricRouterApi, OperatorRouterApi];
