/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';
import { nb, ServerInfo } from 'azdata';
import { DEFAULT_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_FILETYPE, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { URI } from 'vs/base/common/uri';


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
	if (fileExt && fileExt.startsWith('.')) {
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
		Object.assign(<IStandardKernelWithProvider>kernel, {
			name: kernel.name,
			connectionProviderIds: kernel.connectionProviderIds,
			notebookProvider: providerId
		});
	});
	return <IStandardKernelWithProvider[]>(standardKernels);
}

// In the Attach To dropdown, show the database name (if it exists) using the current connection
// Example: myFakeServer (myDatabase)
export function formatServerNameWithDatabaseNameForAttachTo(connectionProfile: ConnectionProfile): string {
	if (connectionProfile && connectionProfile.serverName) {
		return !connectionProfile.databaseName ? connectionProfile.serverName : connectionProfile.serverName + ' (' + connectionProfile.databaseName + ')';
	}
	return '';
}

// Extract server name from format used in Attach To: serverName (databaseName)
export function getServerFromFormattedAttachToName(name: string): string {
	return name.substring(0, name.lastIndexOf(' (')) ? name.substring(0, name.lastIndexOf(' (')) : name;
}

// Extract database name from format used in Attach To: serverName (databaseName)
export function getDatabaseFromFormattedAttachToName(name: string): string {
	return name.substring(name.lastIndexOf('(') + 1, name.lastIndexOf(')')) ?
		name.substring(name.lastIndexOf('(') + 1, name.lastIndexOf(')')) : '';
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

export function tryMatchCellMagic(input: string): string {
	if (!input) {
		return input;
	}
	let firstLine = input.trimLeft();
	let magicRegex = /^%%(\w+)/g;
	let match = magicRegex.exec(firstLine);
	let magicName = match && match[1];
	return magicName;
}

export async function asyncForEach(array: any, callback: any): Promise<any> {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

/**
 * Only replace vscode-resource with file when in the same (or a sub) directory
 * This matches Jupyter Notebook viewer behavior
 */
export function convertVscodeResourceToFileInSubDirectories(htmlContent: string, cellModel: ICellModel): string {
	let htmlContentCopy = htmlContent;
	while (htmlContentCopy.search('(?<=img src=\"vscode-resource:)') > 0) {
		let pathStartIndex = htmlContentCopy.search('(?<=img src=\"vscode-resource:)');
		let pathEndIndex = htmlContentCopy.indexOf('\" ', pathStartIndex);
		let filePath = htmlContentCopy.substring(pathStartIndex, pathEndIndex);
		// If the asset is in the same folder or a subfolder, replace 'vscode-resource:' with 'file:', so the image is visible
		if (!path.relative(path.dirname(cellModel.notebookModel.notebookUri.fsPath), filePath).includes('..')) {
			// ok to change from vscode-resource: to file:
			htmlContent = htmlContent.replace('vscode-resource:' + filePath, 'file:' + filePath);
		}
		htmlContentCopy = htmlContentCopy.slice(pathEndIndex);
	}
	return htmlContent;
}

export function useInProcMarkdown(configurationService: IConfigurationService): boolean {
	return configurationService.getValue('notebook.useInProcMarkdown');
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

interface RawEndpoint {
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
