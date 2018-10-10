/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Event } from 'vscode';
import { Account, DidChangeAccountsParams } from 'sqlops';
import { ApiWrapper } from '../../apiWrapper';

import { IAzureResourceAccountService } from '../interfaces';

export class AzureResourceAccountService implements IAzureResourceAccountService {
	public constructor(
		apiWrapper: ApiWrapper
	) {
		this._apiWrapper = apiWrapper;
		this._onDidChangeAccounts = this._apiWrapper.onDidChangeAccounts;
	}

	public async getAccounts(): Promise<Account[]> {
		return await this._apiWrapper.getAllAccounts();
	}

	public get onDidChangeAccounts(): Event<DidChangeAccountsParams> {
		return this._onDidChangeAccounts;
	}

	private _apiWrapper: ApiWrapper = undefined;
	private _onDidChangeAccounts: Event<DidChangeAccountsParams> = undefined;
}
