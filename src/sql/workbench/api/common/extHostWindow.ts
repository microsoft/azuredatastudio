/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { ExtHostWindowShape, MainThreadWindowShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

export class ExtHostWindow implements ExtHostWindowShape {

	private readonly _proxy: MainThreadWindowShape;

	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadWindow);
	}

	$openServerFileBrowserDialog(connectionUri: string, targetPath: string, fileFilters: azdata.window.FileFilters[], showFoldersOnly?: boolean): Promise<string | undefined> {
		return this._proxy.$openServerFileBrowserDialog(connectionUri, targetPath, fileFilters, showFoldersOnly);
	}

	$openBackupUrlBrowserDialog(connectionUri: string, defaultBackupName: string, isRestore: boolean): Promise<string | undefined> {
		return this._proxy.$openBackupUrlBrowserDialog(connectionUri, defaultBackupName, isRestore);
	}
}
