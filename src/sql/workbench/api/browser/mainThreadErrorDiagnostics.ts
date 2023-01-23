/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostErrorDiagnosticsShape,
	MainThreadErrorDiagnosticsShape
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadErrorDiagnostics)
export class MainThreadErrorDiagnostics extends Disposable implements MainThreadErrorDiagnosticsShape {
	private _providerMetadata: { [handle: number]: azdata.AccountProviderMetadata };
	private _proxy: ExtHostErrorDiagnosticsShape;

	constructor(
		extHostContext: IExtHostContext,
		@IErrorDiagnosticsService private _errorDiagnosticsService: IErrorDiagnosticsService
	) {
		super();
		this._providerMetadata = {};
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostErrorDiagnostics);
		}
	}

	public $registerDiagnostics(providerMetadata: azdata.ResourceProviderMetadata, handle: number): Thenable<any> {
		let self = this;

		//Create the error handler that interfaces with the extension via the proxy and register it
		let diagnostics: azdata.diagnostics.ErrorDiagnostics = {
			handleErrorCode(errorCode: number, errorMessage: string): Thenable<boolean> {
				return self._proxy.$handleErrorCode(handle, errorCode, errorMessage);
			}
		};
		this._errorDiagnosticsService.registerDiagnostics(providerMetadata.id, diagnostics);
		this._providerMetadata[handle] = providerMetadata;

		return Promise.resolve(null);
	}

	public $unregisterDiagnostics(handle: number): Thenable<any> {
		this._errorDiagnosticsService.unregisterDiagnostics(this._providerMetadata[handle].id);
		return Promise.resolve(null);
	}
}
