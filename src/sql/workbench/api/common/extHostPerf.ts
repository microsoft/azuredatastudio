/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { MainThreadPerfShape, ExtHostPerfShape } from './sqlExtHost.protocol';

export class ExtHostPerf implements ExtHostPerfShape {
	private _proxy: MainThreadPerfShape;
	constructor(mainContext: IMainContext) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadPerf);
	}

	$mark(name: string): void {
		this._proxy.$mark(name);
	}
}
