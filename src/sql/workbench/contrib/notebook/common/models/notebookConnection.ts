/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export namespace constants {
	export const userPropName = 'user';
	export const knoxPortPropName = 'knoxport';
	export const clusterPropName = 'clustername';
	export const passwordPropName = 'password';
	export const defaultKnoxPort = '30443';
}
/**
 * This is a temporary connection definition, with known properties for Knox gateway connections.
 * Long term this should be refactored to an extension contribution
 *
 * @export
 */
export class NotebookConnection {
	private _host: string;
	private _knoxPort: string;

	constructor(private _connectionProfile: IConnectionProfile) {
		if (!this._connectionProfile) {
			throw new Error(localize('connectionInfoMissing', "connectionInfo is required"));
		}
	}

	public get connectionProfile(): IConnectionProfile {
		return this._connectionProfile;
	}


	public get host(): string {
		if (!this._host) {
			this.ensureHostAndPort();
		}
		return this._host;
	}

	/**
	 * Sets host and port values, using any ',' or ':' delimited port in the hostname in
	 * preference to the built in port.
	 */
	private ensureHostAndPort(): void {
		this._host = this.connectionProfile.serverName;
		this._knoxPort = NotebookConnection.getKnoxPortOrDefault(this.connectionProfile);
		// determine whether the host has either a ',' or ':' in it
		this.setHostAndPort(',');
		this.setHostAndPort(':');
	}

	// set port and host correctly after we've identified that a delimiter exists in the host name
	private setHostAndPort(delimeter: string): void {
		let originalHost = this._host;
		let index = originalHost.indexOf(delimeter);
		if (index > -1) {
			this._host = originalHost.slice(0, index);
			this._knoxPort = originalHost.slice(index + 1);
		}
	}

	public get user(): string {
		return this._connectionProfile.options[constants.userPropName];
	}

	public get password(): string {
		return this._connectionProfile.options[constants.passwordPropName];
	}

	public get knoxport(): string {
		if (!this._knoxPort) {
			this.ensureHostAndPort();
		}
		return this._knoxPort;
	}

	private static getKnoxPortOrDefault(connectionProfile: IConnectionProfile): string {
		let port = connectionProfile.options[constants.knoxPortPropName];
		if (!port) {
			port = constants.defaultKnoxPort;
		}
		return port;
	}
}
