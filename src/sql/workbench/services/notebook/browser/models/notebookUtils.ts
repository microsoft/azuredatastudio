/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';
import { nb } from 'azdata';
import { DEFAULT_NOTEBOOK_PROVIDER, INotebookService, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { DEFAULT_NOTEBOOK_FILETYPE, NotebookLanguage } from 'sql/workbench/common/constants';

/**
 * Test whether an output is from a stream.
 */
export function isStream(output: nb.ICellOutput): output is nb.IStreamResult {
	return output.output_type === 'stream';
}

export function getProvidersForFileName(fileName: string, notebookService: INotebookService, languageId?: string): string[] {
	let fileExt = path.extname(fileName);
	if (!fileExt && languageId && languageId !== NotebookLanguage.Notebook) {
		fileExt = `.${languageId}`;
	}
	let providers: string[];
	// First try to get provider for actual file type
	if (fileExt) {
		providers = notebookService.getProvidersForFileType(fileExt);
	}
	// Fallback to provider for default file type (assume this is a global handler)
	if (!providers || providers.length === 0) {
		providers = notebookService.getProvidersForFileType(DEFAULT_NOTEBOOK_FILETYPE);
	}
	// Finally if all else fails, use the built-in handler
	if (!providers || providers.length === 0) {
		providers = [DEFAULT_NOTEBOOK_PROVIDER];
	}
	return providers;
}

export async function getStandardKernelsForProvider(providerId: string, notebookService: INotebookService): Promise<IStandardKernelWithProvider[]> {
	if (!providerId || !notebookService) {
		return [];
	}
	let standardKernels = await notebookService.getStandardKernelsForProvider(providerId);
	if (!standardKernels || standardKernels.length === 0) {
		// Fall back to using SQL provider instead
		standardKernels = await notebookService.getStandardKernelsForProvider(SQL_NOTEBOOK_PROVIDER) ?? [];
		providerId = SQL_NOTEBOOK_PROVIDER;
	}
	standardKernels.forEach(kernel => {
		Object.assign(<IStandardKernelWithProvider>kernel, {
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
	readonly supportedLanguages: string[];
	readonly supportedFileExtensions?: string[];
}

export async function asyncForEach(array: any[], callback: Function): Promise<any> {
	if (array && callback) {
		for (let index = 0; index < array.length; index++) {
			await callback(array[index], index, array);
		}
	}
}
