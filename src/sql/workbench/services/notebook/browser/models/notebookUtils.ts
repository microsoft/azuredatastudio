/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';
import { nb, ServerInfo } from 'azdata';
import { DEFAULT_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_FILETYPE, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { URI } from 'vs/base/common/uri';
import { startsWith } from 'vs/base/common/strings';
import { assign } from 'vs/base/common/objects';

export const clusterEndpointsProperty = 'clusterEndpoints';
export const hadoopEndpointNameGateway = 'gateway';
/**
 * Test whether an output is from a stream.
 */
export function isStream(output: nb.ICellOutput): output is nb.IStreamResult {
	return output.output_type === 'stream';
}

export function getProvidersForFileName(fileName: string, notebookService: INotebookService): string[] {
	let fileExt = path.extname(fileName);
	let providers: string[];
	// First try to get provider for actual file type
	if (fileExt && startsWith(fileExt, '.')) {
		fileExt = fileExt.slice(1, fileExt.length);
		providers = notebookService.getProvidersForFileType(fileExt);
	}
	// Fallback to provider for default file type (assume this is a global handler)
	if (!providers) {
		providers = notebookService.getProvidersForFileType(DEFAULT_NOTEBOOK_FILETYPE);
	}
	// Finally if all else fails, use the built-in handler
	if (!providers) {
		providers = [DEFAULT_NOTEBOOK_PROVIDER];
	}
	return providers;
}

export function getStandardKernelsForProvider(providerId: string, notebookService: INotebookService): IStandardKernelWithProvider[] {
	if (!providerId || !notebookService) {
		return [];
	}
	let standardKernels = notebookService.getStandardKernelsForProvider(providerId);
	standardKernels.forEach(kernel => {
		assign(<IStandardKernelWithProvider>kernel, {
			name: kernel.name,
			connectionProviderIds: kernel.connectionProviderIds,
			notebookProvider: providerId
		});
	});
	return <IStandardKernelWithProvider[]>(standardKernels);
}

export interface IStandardKernelWithProvider {
	readonly name: string;
	readonly displayName: string;
	readonly connectionProviderIds: string[];
	readonly notebookProvider: string;
}

export interface IEndpoint {
	serviceName: string;
	description: string;
	endpoint: string;
	protocol: string;
}

export async function asyncForEach(array: any[], callback: Function): Promise<any> {
	if (array && callback) {
		for (let index = 0; index < array.length; index++) {
			await callback(array[index], index, array);
		}
	}
}

export function getClusterEndpoints(serverInfo: ServerInfo): IEndpoint[] | undefined {
	let endpoints: RawEndpoint[] = serverInfo.options[clusterEndpointsProperty];
	if (!endpoints || endpoints.length === 0) { return []; }

	return endpoints.map(e => {
		// If endpoint is missing, we're on CTP bits. All endpoints from the CTP serverInfo should be treated as HTTPS
		let endpoint = e.endpoint ? e.endpoint : `https://${e.ipAddress}:${e.port}`;
		let updatedEndpoint: IEndpoint = {
			serviceName: e.serviceName,
			description: e.description,
			endpoint: endpoint,
			protocol: e.protocol
		};
		return updatedEndpoint;
	});
}

export type HostAndIp = { host: string, port: string };

export function getHostAndPortFromEndpoint(endpoint: string): HostAndIp {
	let authority = URI.parse(endpoint).authority;
	let hostAndPortRegex = /^(.*)([,:](\d+))/g;
	let match = hostAndPortRegex.exec(authority);
	if (match) {
		return {
			host: match[1],
			port: match[3]
		};
	}
	return {
		host: authority,
		port: undefined
	};
}

export function rewriteUrlUsingRegex(regex: RegExp, html: string, host: string, port: string, target: string): string {
	return html.replace(regex, function (a, b, c) {
		let ret = '';
		if (b !== '') {
			ret = 'https://' + host + port + target;
		}
		if (c !== '') {
			ret = ret + c;
		}
		return ret;
	});
}

export interface RawEndpoint {
	serviceName: string;
	description?: string;
	endpoint?: string;
	protocol?: string;
	ipAddress?: string;
	port?: number;
}

export interface IEndpoint {
	serviceName: string;
	description: string;
	endpoint: string;
	protocol: string;
}
