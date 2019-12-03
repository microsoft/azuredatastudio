/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureTerminalService, AzureAccount } from '../interfaces';
import { ExtensionContext } from 'vscode';

export class AzureTerminalService implements IAzureTerminalService {
	public constructor(private context: ExtensionContext) {

	}

	public openTerminal(account: AzureAccount) {

	}
}
