/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../constants';
import { IFileSource, IHdfsOptions, FileSourceFactory } from './fileSources';

export class SqlClusterConnection {
	private _connection: azdata.connection.Connection;
	private _profile: azdata.IConnectionProfile;
	private _host: string;
	private _port: string;
	private _user: string;
	private _password: string;

	constructor(connectionInfo: azdata.connection.Connection | azdata.IConnectionProfile) {
		this.validate(connectionInfo);

		if ('id' in connectionInfo) {
			this._profile = connectionInfo;
			this._connection = this.toConnection(this._profile);
		} else {
			this._connection = connectionInfo;
		}
		this._host = this._connection.options[constants.hostPropName];
		this._port = this._connection.options[constants.knoxPortPropName];
		this._user = this._connection.options[constants.userPropName];
		this._password = this._connection.options[constants.passwordPropName];
	}

	public get connection(): azdata.connection.Connection { return this._connection; }
	public get host(): string { return this._host; }
	public get port(): number { return this._port ? Number.parseInt(this._port) : constants.defaultKnoxPort; }
	public get user(): string { return this._user; }
	public get password(): string { return this._password; }

	public isMatch(connection: SqlClusterConnection | azdata.ConnectionInfo): boolean {
		if (!connection) { return false; }
		let options1 = connection instanceof SqlClusterConnection ?
			connection._connection.options : connection.options;
		let options2 = this._connection.options;
		return [constants.hostPropName, constants.knoxPortPropName, constants.userPropName]
			.every(e => options1[e] === options2[e]);
	}

	public async createHdfsFileSource(): Promise<IFileSource> {
		let options: IHdfsOptions = {
			protocol: 'https',
			host: this.host,
			port: this.port,
			user: this.user,
			path: 'gateway/default/webhdfs/v1',
			requestParams: {
			}
		};
		if (this.isIntegratedAuth()) {
			options.requestParams.isKerberos = this.isIntegratedAuth();
			options.requestParams.auth = undefined;
		} else {
			options.requestParams.auth = {
				user: this.user,
				pass: this.password
			};
		}
		let fileSource = await FileSourceFactory.instance.createHdfsFileSource(options);
		return fileSource;
	}

	public isIntegratedAuth(): boolean {
		let authType: string = this._connection.options[constants.authenticationTypePropName];
		return authType && authType.toLowerCase() === constants.integratedAuth;
	}

	public updateUsername(username: string): void {
		if (username) {
			this._user = username;
		}
	}

	public updatePassword(password: string): void {
		if (password) {
			this._password = password;
		}
	}

	private validate(connectionInfo: azdata.ConnectionInfo): void {
		if (!connectionInfo) {
			throw new Error(localize('connectionInfoUndefined', "ConnectionInfo is undefined."));
		}
		if (!connectionInfo.options) {
			throw new Error(localize('connectionInfoOptionsUndefined', "ConnectionInfo.options is undefined."));
		}
		let missingProperties: string[] = this.getMissingProperties(connectionInfo);
		if (missingProperties && missingProperties.length > 0) {
			throw new Error(localize('connectionInfoOptionsMissingProperties',
				"Some missing properties in connectionInfo.options: {0}",
				missingProperties.join(', ')));
		}
	}

	private getMissingProperties(connectionInfo: azdata.ConnectionInfo): string[] {
		if (!connectionInfo || !connectionInfo.options) { return undefined; }
		let requiredProps = [constants.hostPropName, constants.knoxPortPropName];
		let authType = connectionInfo.options[constants.authenticationTypePropName] && connectionInfo.options[constants.authenticationTypePropName].toLowerCase();
		if (authType !== constants.integratedAuth) {
			requiredProps.push(constants.userPropName, constants.passwordPropName);
		}
		return requiredProps.filter(e => connectionInfo.options[e] === undefined);
	}

	private toConnection(connProfile: azdata.IConnectionProfile): azdata.connection.Connection {
		let connection: azdata.connection.Connection = Object.assign(connProfile,
			{ connectionId: this._profile.id });
		return connection;
	}
}
