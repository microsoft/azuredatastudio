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

			/**
			 * Get connection string
			 */
			getConnectionString(includePassword: boolean): Thenable<string>;

			/**
			 * Get the credentials for an active connection
			 * @param {string} connectionId The id of the connection
			 * @returns {{ [name: string]: string}} A dictionary containing the credentials as they would be included in the connection's options dictionary
			 */
			getCredentials(): Thenable<{ [name: string]: string }>;

			/**
			 * create a connection profile from an options map
			 */
			static from(options: any[]): ConnectionProfile;
		}

		/**
		 * Get the current connection based on the active editor or Object Explorer selection
		*/
		export function getCurrentConnection(): Thenable<ConnectionProfile>;

		/**
		 * Get all connections
		*/
		export function getConnections(): Thenable<ConnectionProfile[]>;

		/**
		 * Get all active connections
		*/
		export function getActiveConnections(): Thenable<ConnectionProfile[]>;

		/**
		 * Get connection profile from connectionId
		*/
		export function getConnectionProfile(connectionId: string): Thenable<ConnectionProfile>;
	}
}