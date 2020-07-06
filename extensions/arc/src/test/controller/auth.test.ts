/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import 'mocha';
import { BasicAuth } from '../../controller/auth';

describe('BasicAuth Method Tests', function () {

	it('Options applied correctly', async function (): Promise<void> {
		const username = 'MyUsername';
		const password = 'MyPassword';
		let ignoreSslVerification = true;
		const auth = new BasicAuth(username, password);
		const requestOptions = {} as any;
		// We don't need this to be actual valid options since we're just checking the ones applied
		auth.applyToRequest(requestOptions);
		await vscode.workspace.getConfiguration('arc').update('ignoreSslVerification', ignoreSslVerification, vscode.ConfigurationTarget.Global);
		should(requestOptions.auth).deepEqual({ username: username, password: password });
		should(requestOptions.agentOptions).deepEqual({ rejectUnauthorized: !ignoreSslVerification });

		ignoreSslVerification = false;
		await vscode.workspace.getConfiguration('arc').update('ignoreSslVerification', ignoreSslVerification, vscode.ConfigurationTarget.Global);
		auth.applyToRequest(requestOptions);
		should(requestOptions.agentOptions).deepEqual({ rejectUnauthorized: !ignoreSslVerification });
	});

});
