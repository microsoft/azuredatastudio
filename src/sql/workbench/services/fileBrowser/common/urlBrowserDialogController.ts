/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IUrlBrowserDialogController = createDecorator<IUrlBrowserDialogController>('urlBrowserDialogService');
export interface IUrlBrowserDialogController {
	_serviceBrand: undefined;
	/**
	 * Show file browser dialog
	 */
	showDialog(ownerUri: string,
		expandPath: string,
		fileFilters: { label: string, filters: string[] }[],
		fileValidationServiceType: string,
		isWide: boolean,
		isRestoreDialog: boolean,
		handleOnOk: (path: string) => void): void;
}
