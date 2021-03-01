/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { ExtHostWorkspaceShape, MainThreadWorkspaceShape, SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { URI } from 'vs/base/common/uri';


export class ExtHostWorkspace implements ExtHostWorkspaceShape {

	private readonly _proxy: MainThreadWorkspaceShape;

	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadWorkspace);
	}

	$createWorkspace(folder: URI, workspaceFile: URI): Promise<void> {
		return this._proxy.$createWorkspace(folder, workspaceFile);
	}

	$enterWorkspace(workspaceFile: URI): Promise<void> {
		return this._proxy.$enterWorkspace(workspaceFile);
	}

	$saveWorkspace(workspaceFile: URI): Promise<void> {
		return this._proxy.$saveWorkspace(workspaceFile);
	}

	$isUntitledWorkspace(workspaceFile: URI): boolean {
		return this._proxy.$isUntitledWorkspace(workspaceFile);
	}
}
