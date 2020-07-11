/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';

describe('Extension activate test', () => {
	it('Extension should activate correctly', async function (): Promise<void> {
		await vscode.extensions.getExtension('Microsoft.admin-tool-ext-win').activate();
	});
});
