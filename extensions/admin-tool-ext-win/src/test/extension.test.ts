/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';

describe.skip('Extension activate test', () => { // {{SQL CARBON TODO}} - reenable later - (Failing to access property 'activate' on undefiend)
	it('Extension should activate correctly', async function (): Promise<void> {
		await vscode.extensions.getExtension('Microsoft.admin-tool-ext-win')!.activate();
	});
});
