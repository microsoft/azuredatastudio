/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../constants';
import { IFileSource, IHdfsOptions, IRequestParams, FileSourceFactory } from './fileSources';

export class SqlClusterConnection {
	private _sqlClusterConnObj: sqlops.connection.Connection;
	private _sqlClusterConnProfile: sqlops.IConnectionProfile;
	private _host: string;
	private _port: string;
	private _user: string;
	private _pass: string;

	constructor(connectionInfo: sqlops.connection.Connection | sqlops.IConnectionProfile) {
		if (!this.isValid(connectionInfo)) {
			throw new Error(localize('invalidConnectionInfo', 'Invalid ConnectionInfo is provided.'));
		}
		if ('id' in connectionInfo) {
			this._sqlClusterConnProfile = connectionInfo;
			this._sqlClusterConnObj = this.toConnObj(this._sqlClusterConnProfile);
		} else {
			this._sqlClusterConnObj = connectionInfo;
			this._sqlClusterConnProfile = this.toConnProfile(this._sqlClusterConnObj);
		}
		this._host = this._sqlClusterConnObj.options[constants.hostPropName];
		this._port = this._sqlClusterConnObj.options[constants.knoxPortPropName];
		this._user = this._sqlClusterConnObj.options[constants.userPropName];
		this._pass = this._sqlClusterConnObj.options[constants.passwordPropName];
	}

	public get sqlClusterConnObj(): sqlops.connection.Connection { return this._sqlClusterConnObj; }
	public get sqlClusterConnProfile(): sqlops.IConnectionProfile { return this._sqlClusterConnProfile; }
	public get host(): string { return this._host; }
	public get port(): string { return this._port || constants.defaultKnoxPort; }
	public get user(): string { return this._user; }
	public get pass(): string { return this._pass; }

	public isMatch(obj: SqlClusterConnection | sqlops.ConnectionInfo): boolean {
		if (!obj) { return false; }
		let options1 = 'options' in obj ? obj.options : obj._sqlClusterConnObj.options;
		let options2 = this._sqlClusterConnObj.options;
		return [ constants.hostPropName, constants.knoxPortPropName, constants.userPropName ]
			.every(e => options1[e] === options2[e]);
	}

	public createHdfsFileSource(): IFileSource {
		let options: IHdfsOptions = {
			protocol: 'https',
			host: this.host,
			port: this.port,
			user: this.user,
			path: 'gateway/default/webhdfs/v1',
			requestParams: {
				auth: {
					user: this.user,
					pass: this.pass
				}
			}
		};
		return FileSourceFactory.instance.createHdfsFileSource(options);
	}

	private isValid(connectionInfo: sqlops.ConnectionInfo): boolean {
		return connectionInfo && connectionInfo.options &&
			[ constants.hostPropName, constants.knoxPortPropName,
				constants.userPropName, constants.passwordPropName ]
			.every(e => connectionInfo.options[e] !== undefined);
	}

	private toConnObj(connProfile: sqlops.IConnectionProfile): sqlops.connection.Connection {
		let connection: sqlops.connection.Connection = Object.assign(connProfile,
			{ connectionId: this._sqlClusterConnProfile.id });
		return connection;
	}

	private toConnProfile(connectionInfo: sqlops.connection.Connection): sqlops.IConnectionProfile {
		let options = connectionInfo.options;
		let connProfile: sqlops.IConnectionProfile = Object.assign(<sqlops.IConnectionProfile>{},
			connectionInfo,
			{
				serverName: `${options[constants.hostPropName]},${options[constants.knoxPortPropName]}`,
				userName: options[constants.userPropName],
				password: options[constants.passwordPropName],
				id: connectionInfo.connectionId,
			}
		);
		return connProfile;
	}
}
