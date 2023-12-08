/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AuthenticationProviderInformation, AuthenticationSession, AuthenticationSessionsChangeEvent, IAuthenticationCreateSessionOptions, IAuthenticationProvider, IAuthenticationService } from 'vs/workbench/services/authentication/common/authentication';
import { Event } from 'vs/workbench/workbench.web.main';

export class TestAuthenticationService implements IAuthenticationService {
	_serviceBrand: undefined;
	isAuthenticationProviderRegistered(id: string): boolean {
		return true;
	}

	getProviderIds(): string[] {
		throw new Error('Method not implemented.');
	}

	registerAuthenticationProvider(id: string, provider: IAuthenticationProvider): void {
		return undefined;
	}

	unregisterAuthenticationProvider(id: string): void {
		return undefined;
	}

	isAccessAllowed(providerId: string, accountName: string, extensionId: string): boolean {
		return true;
	}

	updateAllowedExtension(providerId: string, accountName: string, extensionId: string, extensionName: string, isAllowed: boolean): void {
		return undefined;
	}

	updateSessionPreference(providerId: string, extensionId: string, session: AuthenticationSession): void {
		return undefined;
	}

	getSessionPreference(providerId: string, extensionId: string, scopes: string[]): string {
		return '';
	}

	removeSessionPreference(providerId: string, extensionId: string, scopes: string[]): void {
		return undefined;
	}

	showGetSessionPrompt(providerId: string, accountName: string, extensionId: string, extensionName: string): Promise<boolean> {
		return Promise.resolve(false);
	}

	selectSession(providerId: string, extensionId: string, extensionName: string, scopes: string[], possibleSessions: readonly AuthenticationSession[]): Promise<AuthenticationSession> {
		throw new Error('Method not implemented.');
	}

	requestSessionAccess(providerId: string, extensionId: string, extensionName: string, scopes: string[], possibleSessions: readonly AuthenticationSession[]): void {
		return undefined;
	}

	completeSessionAccessRequest(providerId: string, extensionId: string, extensionName: string, scopes: string[]): Promise<void> {
		return Promise.resolve();
	}

	requestNewSession(providerId: string, scopes: string[], extensionId: string, extensionName: string): Promise<void> {
		return Promise.resolve();
	}

	sessionsUpdate(providerId: string, event: AuthenticationSessionsChangeEvent): void {
		return undefined;
	}

	onDidRegisterAuthenticationProvider: Event<AuthenticationProviderInformation>;
	onDidUnregisterAuthenticationProvider: Event<AuthenticationProviderInformation>;
	onDidChangeSessions: Event<{ providerId: string; label: string; event: AuthenticationSessionsChangeEvent; }>;
	declaredProviders: AuthenticationProviderInformation[];
	onDidChangeDeclaredProviders: Event<AuthenticationProviderInformation[]>;

	getSessions(id: string, scopes?: string[], activateImmediate?: boolean): Promise<readonly AuthenticationSession[]> {
		throw new Error('Method not implemented.');
	}

	getLabel(providerId: string): string {
		return '';
	}

	supportsMultipleAccounts(providerId: string): boolean {
		return true;
	}

	createSession(providerId: string, scopes: string[], options?: IAuthenticationCreateSessionOptions): Promise<AuthenticationSession> {
		throw new Error('Method not implemented.');
	}

	removeSession(providerId: string, sessionId: string): Promise<void> {
		return Promise.resolve();
	}

	manageTrustedExtensionsForAccount(providerId: string, accountName: string): Promise<void> {
		return Promise.resolve();
	}

	removeAccountSessions(providerId: string, accountName: string, sessions: AuthenticationSession[]): Promise<void> {
		return Promise.resolve();
	}

}
