/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azdata' {
	import * as vscode from 'vscode';

	// methods
	export namespace connection {

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
			options: { [name: string]: any };

			static createFrom(options: any[]): ConnectionProfile;
		}

		/**
		 * Get the current connection based on the active editor or Object Explorer selection
		 */
		export function getCurrentConnection(): Thenable<ConnectionProfile>;

		/**
		 * Get known connection profiles including active connections, recent connections and saved connections.
		 * @param activeConnectionsOnly Indicates whether only get the active connections, default value is false.
		 * @returns array of connections
		 */
		export function getConnections(activeConnectionsOnly?: boolean): Thenable<ConnectionProfile[]>;
	}
}