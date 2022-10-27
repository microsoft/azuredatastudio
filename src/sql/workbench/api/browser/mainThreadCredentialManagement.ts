/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostCredentialManagementShape,
	MainThreadCredentialManagementShape
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import * as azdata from 'azdata';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadCredentialManagement)
export class MainThreadCredentialManagement extends Disposable implements MainThreadCredentialManagementShape {

	private _proxy: ExtHostCredentialManagementShape;

	private _registrations: { [handle: number]: IDisposable; } = Object.create(null); // should we be registering these disposables?

	constructor(
		extHostContext: IExtHostContext,
		@ICredentialsService private credentialService: ICredentialsService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostCredentialManagement);
		}
	}

	public $registerCredentialProvider(handle: number): Promise<any> {
		let self = this;

		this._registrations[handle] = this.credentialService.addEventListener(handle, {
			onSaveCredential(credentialId: string, password: string): Thenable<boolean> {
				return self._proxy.$saveCredential(credentialId, password);
			},
			onReadCredential(credentialId: string): Thenable<azdata.Credential> {
				return self._proxy.$readCredential(credentialId);
			},
			onDeleteCredential(credentialId: string): Thenable<boolean> {
				return self._proxy.$deleteCredential(credentialId);
			}
		});

		return undefined;
	}

	public $unregisterCredentialProvider(handle: number): Promise<any> {
		let registration = this._registrations[handle];
		if (registration) {
			registration.dispose();
			delete this._registrations[handle];
		}
		return undefined;
	}
}
