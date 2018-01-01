/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as sqlops from 'sqlops';
import { Deferred } from 'sql/base/common/promise';

export const SERVICE_ID = 'credentialsService';

export interface CredentialManagementEvents {
	onSaveCredential(credentialId: string, password: string): Thenable<boolean>;

	onReadCredential(credentialId: string): Thenable<sqlops.Credential>;

	onDeleteCredential(credentialId: string): Thenable<boolean>;
}

export const ICredentialsService = createDecorator<ICredentialsService>(SERVICE_ID);

export interface ICredentialsService {
	_serviceBrand: any;

	saveCredential(credentialId: string, password: string): Thenable<boolean>;

	readCredential(credentialId: string): Thenable<sqlops.Credential>;

	deleteCredential(credentialId: string): Thenable<boolean>;

	addEventListener(handle: number, events: CredentialManagementEvents): IDisposable;
}

export class CredentialsService implements ICredentialsService {

	_serviceBrand: any;

	private disposables: IDisposable[] = [];

	private _serverEvents: { [handle: number]: CredentialManagementEvents; } = Object.create(null);

	private _lastHandle: number;

	private _onServerEventsReady: Deferred<void> = new Deferred<void>();

	constructor() {
	}

	public addEventListener(handle: number, events: CredentialManagementEvents): IDisposable {
		this._lastHandle = handle;

		this._serverEvents[handle] = events;

		this._onServerEventsReady.resolve();

		return {
			dispose: () => {
			}
		};
	}

	public saveCredential(credentialId: string, password: string): Thenable<boolean> {
		return this._onServerEventsReady.promise.then(() => this._serverEvents[this._lastHandle].onSaveCredential(credentialId, password));
	}

	public readCredential(credentialId: string): Thenable<sqlops.Credential> {
		return this._onServerEventsReady.promise.then(() => this._serverEvents[this._lastHandle].onReadCredential(credentialId));
	}

	public deleteCredential(credentialId: string): Thenable<boolean> {
		return this._onServerEventsReady.promise.then(() => this._serverEvents[this._lastHandle].onDeleteCredential(credentialId));
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
