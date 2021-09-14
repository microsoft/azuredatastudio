/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { v4 as uuid } from 'uuid';
import { Keychain } from './common/keychain';
import { GitHubServer, uriHandler, NETWORK_ERROR } from './githubServer';
import Logger from './common/logger';
import { arrayEquals } from './common/utils';
import { ExperimentationTelemetry } from './experimentationService';

interface SessionData {
	id: string;
	account?: {
		label?: string;
		displayName?: string;
		id: string;
	}
	scopes: string[];
	accessToken: string;
}

export enum AuthProviderType {
	github = 'github',
	'github-enterprise' = 'github-enterprise'
}


export class GitHubAuthenticationProvider implements vscode.AuthenticationProvider {
	private _sessions: vscode.AuthenticationSession[] = [];
	private _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private _githubServer: GitHubServer;

	private _keychain: Keychain;

	constructor(private context: vscode.ExtensionContext, private type: AuthProviderType, private telemetryReporter: ExperimentationTelemetry) {
		this._keychain = new Keychain(context, `${type}.auth`);
		this._githubServer = new GitHubServer(type, telemetryReporter);
	}

	get onDidChangeSessions() {
		return this._sessionChangeEmitter.event;
	}

	public async initialize(): Promise<void> {
		try {
			this._sessions = await this.readSessions();
			await this.verifySessions();
		} catch (e) {
			// Ignore, network request failed
		}

		let friendlyName = 'GitHub';
		if (this.type === AuthProviderType.github) {
			this.context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
		}
		if (this.type === AuthProviderType['github-enterprise']) {
			friendlyName = 'GitHub Enterprise';
		}

		this.context.subscriptions.push(vscode.commands.registerCommand(`${this.type}.provide-token`, () => this.manuallyProvideToken()));
		this.context.subscriptions.push(vscode.authentication.registerAuthenticationProvider(this.type, friendlyName, this, { supportsMultipleAccounts: false }));
		this.context.subscriptions.push(this.context.secrets.onDidChange(() => this.checkForUpdates()));
	}

	async getSessions(scopes?: string[]): Promise<vscode.AuthenticationSession[]> {
		return scopes
			? this._sessions.filter(session => arrayEquals(session.scopes, scopes))
			: this._sessions;
	}

	private async afterTokenLoad(token: string): Promise<void> {
		if (this.type === AuthProviderType.github) {
			this._githubServer.checkIsEdu(token);
		}
		if (this.type === AuthProviderType['github-enterprise']) {
			this._githubServer.checkEnterpriseVersion(token);
		}
	}

	private async verifySessions(): Promise<void> {
		const verifiedSessions: vscode.AuthenticationSession[] = [];
		const verificationPromises = this._sessions.map(async session => {
			try {
				await this._githubServer.getUserInfo(session.accessToken);
				this.afterTokenLoad(session.accessToken);
				verifiedSessions.push(session);
			} catch (e) {
				// Remove sessions that return unauthorized response
				if (e.message !== 'Unauthorized') {
					verifiedSessions.push(session);
				}
			}
		});

		Promise.all(verificationPromises).then(_ => {
			if (this._sessions.length !== verifiedSessions.length) {
				this._sessions = verifiedSessions;
				this.storeSessions();
			}
		});
	}

	private async checkForUpdates() {
		let storedSessions: vscode.AuthenticationSession[];
		try {
			storedSessions = await this.readSessions();
		} catch (e) {
			// Ignore, network request failed
			return;
		}

		const added: vscode.AuthenticationSession[] = [];
		const removed: vscode.AuthenticationSession[] = [];

		storedSessions.forEach(session => {
			const matchesExisting = this._sessions.some(s => s.id === session.id);
			// Another window added a session to the keychain, add it to our state as well
			if (!matchesExisting) {
				Logger.info('Adding session found in keychain');
				this._sessions.push(session);
				added.push(session);
			}
		});

		this._sessions.forEach(session => {
			const matchesExisting = storedSessions.some(s => s.id === session.id);
			// Another window has logged out, remove from our state
			if (!matchesExisting) {
				Logger.info('Removing session no longer found in keychain');
				const sessionIndex = this._sessions.findIndex(s => s.id === session.id);
				if (sessionIndex > -1) {
					this._sessions.splice(sessionIndex, 1);
				}

				removed.push(session);
			}
		});

		if (added.length || removed.length) {
			this._sessionChangeEmitter.fire({ added, removed, changed: [] });
		}
	}

	private async readSessions(): Promise<vscode.AuthenticationSession[]> {
		const storedSessions = await this._keychain.getToken() || await this._keychain.tryMigrate();
		if (storedSessions) {
			try {
				const sessionData: SessionData[] = JSON.parse(storedSessions);
				const sessionPromises = sessionData.map(async (session: SessionData): Promise<vscode.AuthenticationSession> => {
					const needsUserInfo = !session.account;
					let userInfo: { id: string, accountName: string };
					if (needsUserInfo) {
						userInfo = await this._githubServer.getUserInfo(session.accessToken);
					}

					return {
						id: session.id,
						account: {
							label: session.account
								? session.account.label || session.account.displayName!
								: userInfo!.accountName,
							id: session.account?.id ?? userInfo!.id
						},
						scopes: session.scopes,
						accessToken: session.accessToken
					};
				});

				return Promise.all(sessionPromises);
			} catch (e) {
				if (e === NETWORK_ERROR) {
					return [];
				}

				Logger.error(`Error reading sessions: ${e}`);
				await this._keychain.deleteToken();
			}
		}

		return [];
	}

	private async storeSessions(): Promise<void> {
		await this._keychain.setToken(JSON.stringify(this._sessions));
	}

	get sessions(): vscode.AuthenticationSession[] {
		return this._sessions;
	}

	public async createSession(scopes: string[]): Promise<vscode.AuthenticationSession> {
		try {
			/* __GDPR__
				"login" : { }
			*/
			this.telemetryReporter?.sendTelemetryEvent('login');

			const token = await this._githubServer.login(scopes.join(' '));
			this.afterTokenLoad(token);
			const session = await this.tokenToSession(token, scopes);
			await this.setToken(session);
			this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });

			Logger.info('Login success!');

			return session;
		} catch (e) {
			// If login was cancelled, do not notify user.
			if (e.message === 'Cancelled') {
				/* __GDPR__
					"loginCancelled" : { }
				*/
				this.telemetryReporter?.sendTelemetryEvent('loginCancelled');
				throw e;
			}

			/* __GDPR__
				"loginFailed" : { }
			*/
			this.telemetryReporter?.sendTelemetryEvent('loginFailed');

			vscode.window.showErrorMessage(`Sign in failed: ${e}`);
			Logger.error(e);
			throw e;
		}
	}

	public async manuallyProvideToken(): Promise<void> {
		this._githubServer.manuallyProvideToken();
	}

	private async tokenToSession(token: string, scopes: string[]): Promise<vscode.AuthenticationSession> {
		const userInfo = await this._githubServer.getUserInfo(token);
		return {
			id: uuid(),
			accessToken: token,
			account: { label: userInfo.accountName, id: userInfo.id },
			scopes
		};
	}

	private async setToken(session: vscode.AuthenticationSession): Promise<void> {
		const sessionIndex = this._sessions.findIndex(s => s.id === session.id);
		if (sessionIndex > -1) {
			this._sessions.splice(sessionIndex, 1, session);
		} else {
			this._sessions.push(session);
		}

		await this.storeSessions();
	}

	public async removeSession(id: string) {
		try {
			/* __GDPR__
				"logout" : { }
			*/
			this.telemetryReporter?.sendTelemetryEvent('logout');

			Logger.info(`Logging out of ${id}`);
			const sessionIndex = this._sessions.findIndex(session => session.id === id);
			if (sessionIndex > -1) {
				const session = this._sessions[sessionIndex];
				this._sessions.splice(sessionIndex, 1);
				this._sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] });
			} else {
				Logger.error('Session not found');
			}

			await this.storeSessions();
		} catch (e) {
			/* __GDPR__
				"logoutFailed" : { }
			*/
			this.telemetryReporter?.sendTelemetryEvent('logoutFailed');

			vscode.window.showErrorMessage(`Sign out failed: ${e}`);
			Logger.error(e);
			throw e;
		}
	}
}
