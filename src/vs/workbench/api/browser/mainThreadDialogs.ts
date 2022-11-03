/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { MainThreadDiaglogsShape, MainContext, MainThreadDialogOpenOptions, MainThreadDialogSaveOptions } from '../common/extHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { forEach } from 'vs/base/common/collections';
import { IFileDialogService, IOpenDialogOptions, ISaveDialogOptions } from 'vs/platform/dialogs/common/dialogs';

@extHostNamedCustomer(MainContext.MainThreadDialogs)
export class MainThreadDialogs implements MainThreadDiaglogsShape {

	constructor(
		context: IExtHostContext,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
	) {
		//
	}

	dispose(): void {
		//
	}

	async $showOpenDialog(options?: MainThreadDialogOpenOptions): Promise<URI[] | undefined> {
		const convertedOptions = MainThreadDialogs._convertOpenOptions(options);
		if (!convertedOptions.defaultUri) {
			convertedOptions.defaultUri = await this._fileDialogService.defaultFilePath();
		}
		return Promise.resolve(this._fileDialogService.showOpenDialog(convertedOptions));
	}

	async $showSaveDialog(options?: MainThreadDialogSaveOptions): Promise<URI | undefined> {
		const convertedOptions = MainThreadDialogs._convertSaveOptions(options);
		if (!convertedOptions.defaultUri) {
			convertedOptions.defaultUri = await this._fileDialogService.defaultFilePath();
		}
		return Promise.resolve(this._fileDialogService.showSaveDialog(convertedOptions));
	}

	private static _convertOpenOptions(options?: MainThreadDialogOpenOptions): IOpenDialogOptions {
		const result: IOpenDialogOptions = {
			openLabel: options?.openLabel || undefined,
			canSelectFiles: options?.canSelectFiles || (!options?.canSelectFiles && !options?.canSelectFolders),
			canSelectFolders: options?.canSelectFolders,
			canSelectMany: options?.canSelectMany,
			defaultUri: options?.defaultUri ? URI.revive(options.defaultUri) : undefined,
			title: options?.title || undefined,
			availableFileSystems: []
		};
		if (options?.filters) {
			result.filters = [];
			forEach(options.filters, entry => result.filters!.push({ name: entry.key, extensions: entry.value }));
		}
		return result;
	}

	private static _convertSaveOptions(options?: MainThreadDialogSaveOptions): ISaveDialogOptions {
		const result: ISaveDialogOptions = {
			defaultUri: options?.defaultUri ? URI.revive(options.defaultUri) : undefined,
			saveLabel: options?.saveLabel || undefined,
			title: options?.title || undefined
		};
		if (options?.filters) {
			result.filters = [];
			forEach(options.filters, entry => result.filters!.push({ name: entry.key, extensions: entry.value }));
		}
		return result;
	}
}
