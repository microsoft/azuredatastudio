/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { ExtHostWindowShape, MainThreadWindowShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

export class ExtHostWindow implements ExtHostWindowShape {

	private readonly _proxy: MainThreadWindowShape;

	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadWindow);
	}

	$openFileBrowserDialog(): Promise<string> {
		return this._proxy.$openFileBrowserDialog();
	}
}
