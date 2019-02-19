/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlMainContext, MainThreadExtensionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IExtensionManagementService, IExtensionIdentifier } from 'vs/platform/extensionManagement/common/extensionManagement';
import { URI } from 'vs/base/common/uri';

@extHostNamedCustomer(SqlMainContext.MainThreadExtensionManagement)
export class MainThreadExtensionManagement implements MainThreadExtensionManagementShape {

	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IExtensionManagementService private _extensionService: IExtensionManagementService
	) {
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $install(vsixPath: string): Thenable<string> {
		return this._extensionService.install(URI.parse(vsixPath)).then((value: IExtensionIdentifier) => { return undefined; }, (reason: any) => { return reason ? reason.toString() : undefined; });
	}
}
