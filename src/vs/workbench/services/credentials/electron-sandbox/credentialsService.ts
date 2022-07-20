/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICredentialsChangeEvent, ICredentialsService } from 'vs/workbench/services/credentials/common/credentials';
import { INativeHostService } from 'vs/platform/native/electron-sandbox/native';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

export class KeytarCredentialsService extends Disposable implements ICredentialsService {

	declare readonly _serviceBrand: undefined;

	private _onDidChangePassword: Emitter<ICredentialsChangeEvent> = this._register(new Emitter());
	readonly onDidChangePassword = this._onDidChangePassword.event;

	constructor(@INativeHostService private readonly nativeHostService: INativeHostService) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.nativeHostService.onDidChangePassword(event => this._onDidChangePassword.fire(event)));
	}

	getPassword(service: string, account: string): Promise<string | null> {
		return this.nativeHostService.getPassword(service, account);
	}

	setPassword(service: string, account: string, password: string): Promise<void> {
		return this.nativeHostService.setPassword(service, account, password);
	}

	deletePassword(service: string, account: string): Promise<boolean> {
		return this.nativeHostService.deletePassword(service, account);
	}

	findPassword(service: string): Promise<string | null> {
		return this.nativeHostService.findPassword(service);
	}

	findCredentials(service: string): Promise<Array<{ account: string, password: string }>> {
		return this.nativeHostService.findCredentials(service);
	}

	// This class doesn't implement the clear() function because we don't know
	// what services have stored credentials. For reference, a "service" is an extension.
	// TODO: should we clear credentials for the built-in auth extensions?
}

registerSingleton(ICredentialsService, KeytarCredentialsService, true);
