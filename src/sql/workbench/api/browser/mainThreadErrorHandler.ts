/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IErrorHandlingService } from 'sql/workbench/services/errorHandling/common/errorHandlingService';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostErrorHandlerShape,
	MainThreadErrorHandlerShape
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadErrorHandler)
export class MainThreadErrorHandler extends Disposable implements MainThreadErrorHandlerShape {
	private _providerMetadata: { [handle: number]: azdata.AccountProviderMetadata };
	private _proxy: ExtHostErrorHandlerShape;

	constructor(
		extHostContext: IExtHostContext,
		@IErrorHandlingService private _errorHandlingService: IErrorHandlingService
	) {
		super();
		this._providerMetadata = {};
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostErrorHandler);
		}
	}

	public $registerErrorHandler(providerMetadata: azdata.ResourceProviderMetadata, handle: number): Thenable<any> {
		let self = this;

		//Create the error handler that interfaces with the extension via the proxy and register it
		let errorHandler: azdata.ErrorHandler = {
			handleErrorCode(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.errorHandling.ErrorCodes> {
				return self._proxy.$handleErrorCode(handle, errorCode, errorMessage, connectionTypeId);
			}
		};
		this._errorHandlingService.registerErrorHandler(providerMetadata.id, errorHandler);
		this._providerMetadata[handle] = providerMetadata;

		return Promise.resolve(null);
	}

	public $unregisterErrorHandler(handle: number): Thenable<any> {
		this._errorHandlingService.unregisterErrorHandler(this._providerMetadata[handle].id);
		return Promise.resolve(null);
	}
}
