/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	private _providerMetadata: { [handle: number]: azdata.diagnostics.ErrorDiagnosticsProviderMetadata };
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

	public $registerDiagnosticsProvider(providerMetadata: azdata.diagnostics.ErrorDiagnosticsProviderMetadata, handle: number): Thenable<void> {
		let self = this;

		//Create the error handler that interfaces with the extension via the proxy and register it
		let errorDiagnostics: azdata.diagnostics.ErrorDiagnosticsProvider = {
			handleConnectionError(errorInfo: azdata.diagnostics.IErrorInformation, connection: azdata.connection.ConnectionProfile): Thenable<azdata.diagnostics.ConnectionDiagnosticsResult> {
				return self._proxy.$handleConnectionError(handle, errorInfo, connection);
			}
		};
		this._errorDiagnosticsService.registerDiagnosticsProvider(providerMetadata.targetProviderId, errorDiagnostics);
		this._providerMetadata[handle] = providerMetadata;
		return undefined;
	}

	public $unregisterDiagnosticsProvider(handle: number): Thenable<void> {
		this._errorDiagnosticsService.unregisterDiagnosticsProvider(this._providerMetadata[handle].targetProviderId);
		return undefined;
	}
}
