/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import { authenticateKerberos, getHostAndPortFromEndpoint } from '../auth';
import { BdcRouterApi, Authentication, EndpointModel, BdcStatusModel, DefaultApi } from './apiGenerated';
import { TokenRouterApi } from './clusterApiGenerated2';
import * as nls from 'vscode-nls';
import { ConnectControllerDialog, ConnectControllerModel } from '../dialog/connectControllerDialog';
import { getIgnoreSslVerificationConfigSetting } from '../utils';
import { IClusterController, AuthType } from 'bdc';

const localize = nls.loadMessageBundle();

const DEFAULT_KNOX_USERNAME = 'root';

class SslAuth implements Authentication {
	constructor() { }

	applyToRequest(requestOptions: request.Options): void {
		requestOptions['agentOptions'] = {
			rejectUnauthorized: !getIgnoreSslVerificationConfigSetting()
		};
	}
}

export class KerberosAuth extends SslAuth implements Authentication {

	constructor(public kerberosToken: string) {
		super();
	}

	applyToRequest(requestOptions: request.Options): void {
		super.applyToRequest(requestOptions);
		if (requestOptions && requestOptions.headers) {
			requestOptions.headers['Authorization'] = `Negotiate ${this.kerberosToken}`;
		}
		requestOptions.auth = undefined;
	}
}
export class BasicAuth extends SslAuth implements Authentication {
	constructor(public username: string, public password: string) {
		super();
	}

	applyToRequest(requestOptions: request.Options): void {
		super.applyToRequest(requestOptions);
		requestOptions.auth = {
			username: this.username, password: this.password
		};
	}
}

export class OAuthWithSsl extends SslAuth implements Authentication {
	public accessToken: string = '';

	applyToRequest(requestOptions: request.Options): void {
		super.applyToRequest(requestOptions);
		if (requestOptions && requestOptions.headers) {
			requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
		}
		requestOptions.auth = undefined;
	}
}

class BdcApiWrapper extends BdcRouterApi {
	constructor(basePathOrUsername: string, password: string, basePath: string, auth: Authentication) {
		if (password) {
			super(basePathOrUsername, password, basePath);
		} else {
			super(basePath, undefined, undefined);
		}
		this.authentications.default = auth;
	}
}
class DefaultApiWrapper extends DefaultApi {
	constructor(basePathOrUsername: string, password: string, basePath: string, auth: Authentication) {
		if (password) {
			super(basePathOrUsername, password, basePath);
		} else {
			super(basePath, undefined, undefined);
		}
		this.authentications.default = auth;
	}
}

export class ClusterController implements IClusterController {

	private _authPromise: Promise<Authentication>;
	private _url: string;
	private readonly _dialog: ConnectControllerDialog;
	private _connectionPromise: Promise<ClusterController>;

	constructor(url: string,
		private _authType: AuthType,
		private _username?: string,
		private _password?: string
	) {
		if (!url || (_authType === 'basic' && (!_username || !_password))) {
			throw new Error('Missing required inputs for Cluster controller API (URL, username, password)');
		}
		this._url = adjustUrl(url);
		if (this._authType === 'basic') {
			this._authPromise = Promise.resolve(new BasicAuth(_username, _password));
		} else {
			this._authPromise = this.requestTokenUsingKerberos();
		}
		this._dialog = new ConnectControllerDialog(new ConnectControllerModel(
			{
				url: this._url,
				auth: this._authType,
				username: this._username,
				password: this._password
			}));
	}

	public get url(): string {
		return this._url;
	}

	public get authType(): AuthType {
		return this._authType;
	}

	public get username(): string | undefined {
		return this._username;
	}

	public get password(): string | undefined {
		return this._password;
	}

	private async requestTokenUsingKerberos(): Promise<Authentication> {
		let supportsKerberos = await this.verifyKerberosSupported();
		if (!supportsKerberos) {
			throw new Error(localize('error.no.activedirectory', "This cluster does not support Windows authentication"));
		}

		try {

			// AD auth is available, login to keberos and convert to token auth for all future calls
			let host = getHostAndPortFromEndpoint(this._url).host;
			let kerberosToken = await authenticateKerberos(host);
			let tokenApi = new TokenRouterApi(this._url);
			tokenApi.setDefaultAuthentication(new KerberosAuth(kerberosToken));
			let result = await tokenApi.apiV1TokenPost();
			let auth = new OAuthWithSsl();
			auth.accessToken = result.body.accessToken;
			return auth;
		} catch (error) {
			let controllerErr = new ControllerError(error, localize('bdc.error.tokenPost', "Error during authentication"));
			if (controllerErr.code === 401) {
				throw new Error(localize('bdc.error.unauthorized', "You do not have permission to log into this cluster using Windows Authentication"));
			}
			// Else throw the error as-is
			throw controllerErr;
		}
	}

	private async verifyKerberosSupported(): Promise<boolean> {
		let tokenApi = new TokenRouterApi(this._url);
		tokenApi.setDefaultAuthentication(new SslAuth());
		try {
			await tokenApi.apiV1TokenPost();
			// If we get to here, the route for endpoints doesn't require auth so state this is false
			return false;
		}
		catch (error) {
			let auths = error && error.response && error.response.statusCode === 401 && error.response.headers['www-authenticate'];
			return auths && auths.includes('Negotiate');
		}
	}

	public async getKnoxUsername(sqlLogin: string): Promise<string> {
		try {
			// This all is necessary because prior to CU5 BDC deployments all had the same default username for
			// accessing the Knox gateway. But in the allowRunAsRoot setting was added and defaulted to false - so
			// if that exists and is false then we use the username instead.
			// Note that the SQL username may not necessarily be correct here either - but currently this is what
			// we're requiring to run Notebooks in a BDC
			const config = await this.getClusterConfig();
			return config.spec?.spec?.security?.allowRunAsRoot === false ? sqlLogin : DEFAULT_KNOX_USERNAME;
		} catch (err) {
			console.log(`Unexpected error fetching cluster config for getKnoxUsername ${err}`);
			// Optimistically fall back to SQL login since root shouldn't be typically used going forward
			return sqlLogin;
		}

	}

	public async getClusterConfig(promptConnect: boolean = false): Promise<any> {
		return await this.withConnectRetry<IEndPointsResponse>(
			this.getClusterConfigImpl,
			promptConnect,
			localize('bdc.error.getClusterConfig', "Error retrieving cluster config from {0}", this._url));
	}

	private async getClusterConfigImpl(self: ClusterController): Promise<any> {
		let auth = await self._authPromise;
		let endPointApi = new BdcApiWrapper(self._username, self._password, self._url, auth);
		let options: any = {};

		let result = await endPointApi.getCluster(options);
		return {
			response: result.response as IHttpResponse,
			spec: JSON.parse(result.body.spec)
		};
	}

	public async getEndPoints(promptConnect: boolean = false): Promise<IEndPointsResponse> {
		return await this.withConnectRetry<IEndPointsResponse>(
			this.getEndpointsImpl,
			promptConnect,
			localize('bdc.error.getEndPoints', "Error retrieving endpoints from {0}", this._url));
	}

	private async getEndpointsImpl(self: ClusterController): Promise<IEndPointsResponse> {
		let auth = await self._authPromise;
		let endPointApi = new BdcApiWrapper(self._username, self._password, self._url, auth);
		let options: any = {};

		let result = await endPointApi.endpointsGet(options);
		return {
			response: result.response as IHttpResponse,
			endPoints: result.body as EndpointModel[]
		};
	}

	public async getBdcStatus(promptConnect: boolean = false): Promise<IBdcStatusResponse> {
		return await this.withConnectRetry<IBdcStatusResponse>(
			this.getBdcStatusImpl,
			promptConnect,
			localize('bdc.error.getBdcStatus', "Error retrieving BDC status from {0}", this._url));
	}

	private async getBdcStatusImpl(self: ClusterController): Promise<IBdcStatusResponse> {
		let auth = await self._authPromise;
		const bdcApi = new BdcApiWrapper(self._username, self._password, self._url, auth);

		const bdcStatus = await bdcApi.getBdcStatus('', '', /*all*/ true);
		return {
			response: bdcStatus.response,
			bdcStatus: bdcStatus.body
		};
	}

	public async mountHdfs(mountPath: string, remoteUri: string, credentials: {}, promptConnection: boolean = false): Promise<MountResponse> {
		return await this.withConnectRetry<MountResponse>(
			this.mountHdfsImpl,
			promptConnection,
			localize('bdc.error.mountHdfs', "Error creating mount"),
			mountPath,
			remoteUri,
			credentials);
	}

	private async mountHdfsImpl(self: ClusterController, mountPath: string, remoteUri: string, credentials: {}): Promise<MountResponse> {
		let auth = await self._authPromise;
		const api = new DefaultApiWrapper(self._username, self._password, self._url, auth);

		const mountStatus = await api.createMount('', '', remoteUri, mountPath, credentials);
		return {
			response: mountStatus.response,
			status: mountStatus.body
		};
	}

	public async getMountStatus(mountPath?: string, promptConnect: boolean = false): Promise<MountStatusResponse> {
		return await this.withConnectRetry<MountStatusResponse>(
			this.getMountStatusImpl,
			promptConnect,
			localize('bdc.error.mountHdfs', "Error creating mount"),
			mountPath);
	}

	private async getMountStatusImpl(self: ClusterController, mountPath?: string): Promise<MountStatusResponse> {
		const auth = await self._authPromise;
		const api = new DefaultApiWrapper(self._username, self._password, self._url, auth);

		const mountStatus = await api.listMounts('', '', mountPath);
		return {
			response: mountStatus.response,
			mount: mountStatus.body ? JSON.parse(mountStatus.body) : undefined
		};
	}

	public async refreshMount(mountPath: string, promptConnect: boolean = false): Promise<MountResponse> {
		return await this.withConnectRetry<MountResponse>(
			this.refreshMountImpl,
			promptConnect,
			localize('bdc.error.refreshHdfs', "Error refreshing mount"),
			mountPath);
	}

	private async refreshMountImpl(self: ClusterController, mountPath: string): Promise<MountResponse> {
		const auth = await self._authPromise;
		const api = new DefaultApiWrapper(self._username, self._password, self._url, auth);

		const mountStatus = await api.refreshMount('', '', mountPath);
		return {
			response: mountStatus.response,
			status: mountStatus.body
		};
	}

	public async deleteMount(mountPath: string, promptConnect: boolean = false): Promise<MountResponse> {
		return await this.withConnectRetry<MountResponse>(
			this.deleteMountImpl,
			promptConnect,
			localize('bdc.error.deleteHdfs', "Error deleting mount"),
			mountPath);
	}

	private async deleteMountImpl(self: ClusterController, mountPath: string): Promise<MountResponse> {
		let auth = await self._authPromise;
		const api = new DefaultApiWrapper(self._username, self._password, self._url, auth);

		const mountStatus = await api.deleteMount('', '', mountPath);
		return {
			response: mountStatus.response,
			status: mountStatus.body
		};
	}

	/**
	 * Helper function that wraps a function call in a try/catch and if promptConnect is true
	 * will prompt the user to re-enter connection information and if that succeeds updates
	 * this with the new information.
	 * @param f The API function we're wrapping
	 * @param promptConnect Whether to actually prompt for connection on failure
	 * @param errorMessage The message to include in the wrapped error thrown
	 * @param args The args to pass to the function
	 */
	private async withConnectRetry<T>(f: (...args: any[]) => Promise<T>, promptConnect: boolean, errorMessage: string, ...args: any[]): Promise<T> {
		try {
			try {
				return await f(this, ...args);
			} catch (error) {
				if (promptConnect) {
					// We don't want to open multiple dialogs here if multiple calls come in the same time so check
					// and see if we have are actively waiting on an open dialog to return and if so then just wait
					// on that promise.
					if (!this._connectionPromise) {
						this._connectionPromise = this._dialog.showDialog();
					}
					const controller = await this._connectionPromise;
					if (controller) {
						this._username = controller._username;
						this._password = controller._password;
						this._url = controller._url;
						this._authType = controller._authType;
						this._authPromise = controller._authPromise;
					}
					return await f(this, args);
				}
				throw error;
			}
		} catch (error) {
			throw new ControllerError(error, errorMessage);
		} finally {
			this._connectionPromise = undefined;
		}
	}
}

/**
 * Fixes missing protocol and wrong character for port entered by user
 */
function adjustUrl(url: string): string {
	if (!url) {
		return undefined;
	}

	url = url.trim().replace(/ /g, '').replace(/,(\d+)$/, ':$1');
	if (!url.includes('://')) {
		url = `https://${url}`;
	}
	return url;
}

export interface IClusterRequest {
	url: string;
	username: string;
	password?: string;
	method?: string;
}

export interface IEndPointsResponse {
	response: IHttpResponse;
	endPoints: EndpointModel[];
}

export interface IBdcStatusResponse {
	response: IHttpResponse;
	bdcStatus: BdcStatusModel;
}

export enum MountState {
	Creating = 'Creating',
	Ready = 'Ready',
	Error = 'Error'
}

export interface MountInfo {
	mount: string;
	remote: string;
	state: MountState;
	error?: string;
}

export interface MountResponse {
	response: IHttpResponse;
	status: any;
}
export interface MountStatusResponse {
	response: IHttpResponse;
	mount: MountInfo[];
}

export interface IHttpResponse {
	method?: string;
	url?: string;
	statusCode?: number;
	statusMessage?: string;
}

export class ControllerError extends Error {
	public code?: number;
	public reason?: string;
	public address?: string;
	public statusMessage?: string;
	/**
	 *
	 * @param error The original error to wrap
	 * @param messagePrefix Optional text to prefix the error message with
	 */
	constructor(error: any, messagePrefix?: string) {
		super(messagePrefix);
		// Pull out the response information containing details about the failure
		if (error.response) {
			this.code = error.response.statusCode;
			this.message += `${error.response.statusMessage ? ` - ${error.response.statusMessage}` : ''}` || '';
			this.address = error.response.url || '';
			this.statusMessage = error.response.statusMessage;
		}
		else if (error.message) {
			this.message += ` - ${error.message}`;
		}

		// The body message contains more specific information about the failure
		if (error.body && error.body.reason) {
			this.message += ` - ${error.body.reason}`;
		}
	}
}
