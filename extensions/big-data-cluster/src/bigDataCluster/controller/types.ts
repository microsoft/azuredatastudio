/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Socket } from 'net';
import { IncomingHttpHeaders } from 'http';

export interface IEndPointsRequest {
	url: string;
	username: string;
	password?: string;
	method?: string;
}

export interface IEndPointsResponse {
	request?: IEndPointsRequest;
	response: IHttpResponse;
	endPoints: IEndPoint[];
}

export interface IHttpResponse {
	httpVersion: string;
	httpVersionMajor: number;
	httpVersionMinor: number;
	connection: Socket;
	headers: IncomingHttpHeaders;
	rawHeaders: string[];
	trailers: { [key: string]: string | undefined };
	rawTrailers: string[];
	method?: string;
	url?: string;
	statusCode?: number;
	statusMessage?: string;
	socket: Socket;
}

export interface IEndPoint {
	name?: string;
	description?: string;
	endpoint?: string;
	ip?: string;
	port?: number;
	path?: string;
	protocol?: string;
	service?: string;
}

export interface IControllerError extends Error {
	address?: string;
	code?: string;
	errno?: string;
	message: string;
	port?: number;
	stack?: string;
	syscall?: string;
	request?: any;
}
