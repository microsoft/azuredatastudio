/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../common/apiWrapper';

export interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	context: vscode.ExtensionContext;
}

export function createContext(): TestContext {
	let extensionPath = path.join(__dirname, '..', '..');

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		context: {
			subscriptions: [],
			workspaceState: {
				get: () => { return undefined; },
				update: () => { return Promise.resolve(); }
			},
			globalState: {
				get: () => { return Promise.resolve(); },
				update: () => { return Promise.resolve(); }
			},
			extensionPath: extensionPath,
			asAbsolutePath: () => { return ''; },
			storagePath: '',
			globalStoragePath: '',
			logPath: '',
			extensionUri: vscode.Uri.parse(''),
			environmentVariableCollection: undefined as any,
			extensionMode: undefined as any
		},
	};
}
