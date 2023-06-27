/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureActiveDirectoryService, IStoredSession } from './AADHelper';
import { BetterTokenStorage } from './betterSecretStorage';
import { UriEventHandler } from './UriEventHandler';
import TelemetryReporter from '@vscode/extension-telemetry';

async function initMicrosoftSovereignCloudAuthProvider(context: vscode.ExtensionContext, telemetryReporter: TelemetryReporter, uriHandler: UriEventHandler, tokenStorage: BetterTokenStorage<IStoredSession>): Promise<vscode.Disposable | undefined> {
	let settingValue = vscode.workspace.getConfiguration('microsoft-sovereign-cloud').get<string | undefined>('endpoint');
	let authProviderName: string | undefined;
	if (!settingValue) {
		return undefined;
	} else if (settingValue === 'Azure China') {
		authProviderName = settingValue;
		settingValue = 'https://login.chinacloudapi.cn/';
	} else if (settingValue === 'Azure US Government') {
		authProviderName = settingValue;
		settingValue = 'https://login.microsoftonline.us/';
	}

	// validate user value
	let uri: vscode.Uri;
	try {
		uri = vscode.Uri.parse(settingValue, true);
	} catch (e) {
		vscode.window.showErrorMessage(vscode.l10n.t('Microsoft Sovereign Cloud login URI is not a valid URI: {0}', e.message ?? e));
		return;
	}

	// Add trailing slash if needed
	if (!settingValue.endsWith('/')) {
		settingValue += '/';
	}

	const aadService = new AzureActiveDirectoryService(
		vscode.window.createOutputChannel(vscode.l10n.t('Microsoft Sovereign Cloud Authentication'), { log: true }),
		context,
		uriHandler,
		tokenStorage,
		telemetryReporter,
		settingValue);
	await aadService.initialize();

	authProviderName ||= uri.authority;
	const disposable = vscode.authentication.registerAuthenticationProvider('microsoft-sovereign-cloud', authProviderName, {
		onDidChangeSessions: aadService.onDidChangeSessions,
		getSessions: (scopes: string[]) => aadService.getSessions(scopes),
		createSession: async (scopes: string[]) => {
			try {
				/* __GDPR__
					"login" : {
						"owner": "TylerLeonhardt",
						"comment": "Used to determine the usage of the Microsoft Sovereign Cloud Auth Provider.",
						"scopes": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight", "comment": "Used to determine what scope combinations are being requested." }
					}
				*/
				telemetryReporter.sendTelemetryEvent('loginMicrosoftSovereignCloud', {
					// Get rid of guids from telemetry.
					scopes: JSON.stringify(scopes.map(s => s.replace(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i, '{guid}'))),
				});

				return await aadService.createSession(scopes.sort());
			} catch (e) {
				/* __GDPR__
					"loginFailed" : { "owner": "TylerLeonhardt", "comment": "Used to determine how often users run into issues with the login flow." }
				*/
				telemetryReporter.sendTelemetryEvent('loginMicrosoftSovereignCloudFailed');

				throw e;
			}
		},
		removeSession: async (id: string) => {
			try {
				/* __GDPR__
					"logout" : { "owner": "TylerLeonhardt", "comment": "Used to determine how often users log out." }
				*/
				telemetryReporter.sendTelemetryEvent('logoutMicrosoftSovereignCloud');

				await aadService.removeSessionById(id);
			} catch (e) {
				/* __GDPR__
					"logoutFailed" : { "owner": "TylerLeonhardt", "comment": "Used to determine how often fail to log out." }
				*/
				telemetryReporter.sendTelemetryEvent('logoutMicrosoftSovereignCloudFailed');
			}
		}
	}, { supportsMultipleAccounts: true });

	context.subscriptions.push(disposable);
	return disposable;
}

export async function activate(context: vscode.ExtensionContext) {
	const aiKey: string = context.extension.packageJSON.aiKey;
	const telemetryReporter = new TelemetryReporter(aiKey);

	const uriHandler = new UriEventHandler();
	context.subscriptions.push(uriHandler);
	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
	const betterSecretStorage = new BetterTokenStorage<IStoredSession>('microsoft.login.keylist', context);

	const loginService = new AzureActiveDirectoryService(
		vscode.window.createOutputChannel(vscode.l10n.t('Microsoft Authentication'), { log: true }),
		context,
		uriHandler,
		betterSecretStorage,
		telemetryReporter);
	await loginService.initialize();

	context.subscriptions.push(vscode.authentication.registerAuthenticationProvider('microsoft', 'Microsoft', {
		onDidChangeSessions: loginService.onDidChangeSessions,
		getSessions: (scopes: string[]) => loginService.getSessions(scopes),
		createSession: async (scopes: string[]) => {
			try {
				/* __GDPR__
					"login" : {
						"owner": "TylerLeonhardt",
						"comment": "Used to determine the usage of the Microsoft Auth Provider.",
						"scopes": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight", "comment": "Used to determine what scope combinations are being requested." }
					}
				*/
				telemetryReporter.sendTelemetryEvent('login', {
					// Get rid of guids from telemetry.
					scopes: JSON.stringify(scopes.map(s => s.replace(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i, '{guid}'))),
				});

				return await loginService.createSession(scopes.sort());
			} catch (e) {
				/* __GDPR__
					"loginFailed" : { "owner": "TylerLeonhardt", "comment": "Used to determine how often users run into issues with the login flow." }
				*/
				telemetryReporter.sendTelemetryEvent('loginFailed');

				throw e;
			}
		},
		removeSession: async (id: string) => {
			try {
				/* __GDPR__
					"logout" : { "owner": "TylerLeonhardt", "comment": "Used to determine how often users log out." }
				*/
				telemetryReporter.sendTelemetryEvent('logout');

				await loginService.removeSessionById(id);
			} catch (e) {
				/* __GDPR__
					"logoutFailed" : { "owner": "TylerLeonhardt", "comment": "Used to determine how often fail to log out." }
				*/
				telemetryReporter.sendTelemetryEvent('logoutFailed');
			}
		}
	}, { supportsMultipleAccounts: true }));

	let microsoftSovereignCloudAuthProviderDisposable = await initMicrosoftSovereignCloudAuthProvider(context, telemetryReporter, uriHandler, betterSecretStorage);

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
		if (e.affectsConfiguration('microsoft-sovereign-cloud.endpoint')) {
			microsoftSovereignCloudAuthProviderDisposable?.dispose();
			microsoftSovereignCloudAuthProviderDisposable = await initMicrosoftSovereignCloudAuthProvider(context, telemetryReporter, uriHandler, betterSecretStorage);
		}
	}));

	return;
}

// this method is called when your extension is deactivated
export function deactivate() { }
