/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';

import { ExtHostExtensionManagementShape, MainThreadExtensionManagementShape, SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';


export class ExtHostExtensionManagement implements ExtHostExtensionManagementShape {

	private readonly _proxy: MainThreadExtensionManagementShape;

	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadExtensionManagement);
	}

	$install(vsixPath: string): Thenable<string> {
		return this._proxy.$install(vsixPath);
	}

	$showObsoleteExtensionApiUsageNotification(message: string): void {
		return this._proxy.$showObsoleteExtensionApiUsageNotification(message);
	}
}
