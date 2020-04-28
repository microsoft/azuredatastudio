/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GitHubAuthenticationProvider, onDidChangeSessions } from './github';
import { uriHandler } from './githubServer';
import Logger from './common/logger';
import TelemetryReporter from 'vscode-extension-telemetry';

export async function activate(context: vscode.ExtensionContext) {
	const { name, version, aiKey } = require('../package.json') as { name: string, version: string, aiKey: string };
	const telemetryReporter = new TelemetryReporter(name, version, aiKey);

	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
	const loginService = new GitHubAuthenticationProvider();

	await loginService.initialize();

	vscode.authentication.registerAuthenticationProvider({
		id: 'github',
		displayName: 'GitHub',
		onDidChangeSessions: onDidChangeSessions.event,
		getSessions: () => Promise.resolve(loginService.sessions),
		login: async (scopeList: string[]) => {
			try {
				telemetryReporter.sendTelemetryEvent('login');
				const session = await loginService.login(scopeList.sort().join(' '));
				Logger.info('Login success!');
				onDidChangeSessions.fire({ added: [session.id], removed: [], changed: [] });
				return session;
			} catch (e) {
				telemetryReporter.sendTelemetryEvent('loginFailed');
				vscode.window.showErrorMessage(`Sign in failed: ${e}`);
				Logger.error(e);
				throw e;
			}
		},
		logout: async (id: string) => {
			try {
				telemetryReporter.sendTelemetryEvent('logout');
				await loginService.logout(id);
				onDidChangeSessions.fire({ added: [], removed: [id], changed: [] });
			} catch (e) {
				telemetryReporter.sendTelemetryEvent('logoutFailed');
				vscode.window.showErrorMessage(`Sign out failed: ${e}`);
				Logger.error(e);
				throw e;
			}
		}
	});

	return;
}

// this method is called when your extension is deactivated
export function deactivate() { }
