/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import * as constants from '../constants';
import * as LocalizedConstants from '../localizedConstants';
import * as utils from '../utils';
import { IFileSource, IHdfsOptions, IRequestParams, FileSourceFactory } from './fileSources';
import { IEndpoint } from './objectExplorerNodeProvider';

function appendIfExists(uri: string, propName: string, propValue: string): string {
	if (propValue) {
		uri = `${uri};${propName}=${propValue}`;
	}
	return uri;
}

interface IValidationResult {
	isValid: boolean;
	errors: string;
}

export class Connection {
	private _host: string;
	private _knoxPort: string;

	constructor(private connectionInfo: sqlops.ConnectionInfo, private connectionUri?: string, private _connectionId?: string) {
		if (!this.connectionInfo) {
			throw new Error(localize('connectionInfoMissing', 'connectionInfo is required'));
		}

		if (!this._connectionId) {
			this._connectionId = UUID.generateUuid();
		}
	}

	public get uri(): string {
		return this.connectionUri;
	}

	public saveUriWithPrefix(prefix: string): string {
		let uri = `${prefix}${this.host}`;
		uri = appendIfExists(uri, constants.knoxPortPropName, this.knoxport);
		uri = appendIfExists(uri, constants.userPropName, this.user);
		uri = appendIfExists(uri, constants.groupIdPropName, this.connectionInfo.options[constants.groupIdPropName]);
		this.connectionUri = uri;
		return this.connectionUri;
	}

	public async tryConnect(factory?: FileSourceFactory): Promise<sqlops.ConnectionInfoSummary> {
		let fileSource = this.createHdfsFileSource(factory, {
			timeout: this.connecttimeout
		});
		let summary: sqlops.ConnectionInfoSummary = undefined;
		try {
			await fileSource.enumerateFiles(constants.hdfsRootPath);
			summary = {
				ownerUri: this.connectionUri,
				connectionId: this.connectionId,
				connectionSummary: {
					serverName: this.host,
					databaseName: undefined,
					userName: this.user
				},
				errorMessage: undefined,
				errorNumber: undefined,
				messages: undefined,
				serverInfo: this.getEmptyServerInfo()
			};
		} catch (error) {
			summary = {
				ownerUri: this.connectionUri,
				connectionId: undefined,
				connectionSummary: undefined,
				errorMessage: this.getConnectError(error),
				errorNumber: undefined,
				messages: undefined,
				serverInfo: undefined
			};
		}
		return summary;
	}

	private getConnectError(error: string | Error): string {
		let errorMsg = utils.getErrorMessage(error);
		if (errorMsg.indexOf('ETIMEDOUT') > -1) {
			errorMsg = LocalizedConstants.msgTimeout;
		} else if (errorMsg.indexOf('ENOTFOUND') > -1) {
			errorMsg = LocalizedConstants.msgTimeout;
		}
		return localize('connectError', 'Connection failed with error: {0}', errorMsg);
	}

	private getEmptyServerInfo(): sqlops.ServerInfo {
		let info: sqlops.ServerInfo = {
			serverMajorVersion: 0,
			serverMinorVersion: 0,
			serverReleaseVersion: 0,
			engineEditionId: 0,
			serverVersion: '',
			serverLevel: '',
			serverEdition: '',
			isCloud: false,
			azureVersion: 0,
			osVersion: '',
			options: {}
		};
		return info;
	}

	public get connectionId(): string {
		return this._connectionId;
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
		this._host = this.connectionInfo.options[constants.hostPropName];
		this._knoxPort = Connection.getKnoxPortOrDefault(this.connectionInfo);
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
		return this.connectionInfo.options[constants.userPropName];
	}

	public get password(): string {
		return this.connectionInfo.options[constants.passwordPropName];
	}

	public get knoxport(): string {
		if (!this._knoxPort) {
			this.ensureHostAndPort();
		}
		return this._knoxPort;
	}

	private static getKnoxPortOrDefault(connInfo: sqlops.ConnectionInfo): string {
		let port = connInfo.options[constants.knoxPortPropName];
		if (!port) {
			port = constants.defaultKnoxPort;
		}
		return port;
	}

	public get connecttimeout(): number {
		let timeoutSeconds: number = this.connectionInfo.options['connecttimeout'];
		if (!timeoutSeconds) {
			timeoutSeconds = constants.hadoopConnectionTimeoutSeconds;
		}
		// connect timeout is in milliseconds
		return timeoutSeconds * 1000;
	}

	public get sslverification(): string {
		return this.connectionInfo.options['sslverification'];
	}

	public get groupId(): string {
		return this.connectionInfo.options[constants.groupIdName];
	}

	public async isMatch(connectionInfo: sqlops.ConnectionInfo): Promise<boolean> {
		if (!connectionInfo) {
			return false;
		}
		let profile = connectionInfo as sqlops.IConnectionProfile;
		if (profile) {
			let result: IEndpoint = await utils.getClusterEndpoint(profile.id, constants.hadoopKnoxEndpointName);
			if (result === undefined || !result.ipAddress || !result.port) {
				return false;
			}
			return connectionInfo.options.groupId === this.groupId
				&& result.ipAddress === this.host
				&& String(result.port).startsWith(this.knoxport)
				&& String(result.port).endsWith(this.knoxport);
				// TODO: enable the user check when the unified user is used
				//&& connectionInfo.options.user === this.user;
		}
	}

	public createHdfsFileSource(factory?: FileSourceFactory, additionalRequestParams?: IRequestParams): IFileSource {
		factory = factory || FileSourceFactory.instance;
		let options: IHdfsOptions = {
			protocol: 'https',
			host: this.host,
			port: this.knoxport,
			user: this.user,
			path: 'gateway/default/webhdfs/v1',
			requestParams: {
				auth: {
					user: this.user,
					pass: this.password
				}
			}
		};
		if (additionalRequestParams) {
			options.requestParams = Object.assign(options.requestParams, additionalRequestParams);
		}
		return factory.createHdfsFileSource(options);
	}
}
