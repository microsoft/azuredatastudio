/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azdata' {
	import * as vscode from 'vscode';

	/**
	 * Connection profile primary class
	 */
	export class ConnectionProfile {
		providerId: string;
		connectionId: string;
		connectionName: string;
		serverName: string;
		databaseName: string;
		userName: string;
		password: string;
		authenticationType: string;
		savePassword: boolean;
		groupFullName: string;
		groupId: string;
		saveProfile: boolean;
		azureTenantId?: string;

		static createFrom(options: any[]): ConnectionProfile;
	}

	// methods
	export namespace connection {
		/**
		 * Get the current connection based on the active editor or Object Explorer selection
		*/
		export function getCurrentConnection(): Thenable<ConnectionProfile>;
	}
}