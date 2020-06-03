/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

export class TenantQuickPickItem implements vscode.QuickPickItem {
	label: string;
	description?: string;
	detail?: string;
	picked?: boolean;
	alwaysShow?: boolean;
	tenant: any;
	constructor(tenant: any) {
		this.tenant = tenant;
		this.label = tenant.displayName;
	}
}

export class AccountQuickPickItem implements vscode.QuickPickItem {
	account: azdata.Account;
	label: string;
	description?: string;
	detail?: string;
	picked?: boolean;
	alwaysShow?: boolean;
	constructor(account: azdata.Account) {
		this.account = account;
		this.label = account.key.accountId;
	}
}
