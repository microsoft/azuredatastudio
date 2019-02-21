/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import { nb } from 'sqlops';
import * as os from 'os';
import * as pfs from 'vs/base/node/pfs';
import { localize } from 'vs/nls';
import { IOutputChannel } from 'vs/workbench/parts/output/common/output';
import { DEFAULT_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_FILETYPE, INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';


/**
 * Test whether an output is from a stream.
 */
export function isStream(output: nb.ICellOutput): output is nb.IStreamResult {
	return output.output_type === 'stream';
}

export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

export function getUserHome(): string {
	return process.env.HOME || process.env.USERPROFILE;
}

export async function mkDir(dirPath: string, outputChannel?: IOutputChannel): Promise<void> {
	let exists = await pfs.dirExists(dirPath);
	if (!exists) {
		if (outputChannel) {
			outputChannel.append(localize('mkdirOutputMsg', '... Creating {0}', dirPath) + os.EOL);
		}
		await pfs.mkdirp(dirPath);
	}
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

export function getStandardKernelsForProvider(providerId: string, notebookService: INotebookService) : IStandardKernelWithProvider[] {
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
	readonly connectionProviderIds: string[];
	readonly notebookProvider: string;
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