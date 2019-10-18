/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';

import { authenticateKerberos, getHostAndPortFromEndpoint } from '../auth';
import { BdcRouterApi, Authentication, EndpointModel, BdcStatusModel, DefaultApi } from './apiGenerated';
import { TokenRouterApi } from './clusterApiGenerated2';
import { AuthType } from '../constants';
import * as nls from 'vscode-nls';
import { AddControllerDialog, AddControllerDialogModel, getAuthCategory } from '../dialog/addControllerDialog';
import { ConnectControllerDialog, ConnectControllerModel } from '../dialog/connectControllerDialog';

const localize = nls.loadMessageBundle();

class SslAuth implements Authentication {

	constructor(private _ignoreSslVerification: boolean) {
	}

	applyToRequest(requestOptions: request.Options): void {
		requestOptions['agentOptions'] = {
			rejectUnauthorized: !this._ignoreSslVerification
		};
	}
}

export class KerberosAuth extends SslAuth implements Authentication {

	constructor(public kerberosToken: string, ignoreSslVerification: boolean) {
		super(ignoreSslVerification);
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
	constructor(public username: string, public password: string, ignoreSslVerification: boolean) {
		super(ignoreSslVerification);
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

export class ClusterController {

	private authPromise: Promise<Authentication>;
	private _url: string;
	private readonly dialog: ConnectControllerDialog;
	private connectionPromise: Promise<ClusterController>;

	constructor(url: string,
		private authType: AuthType,
		private username?: string,
		private password?: string,
		ignoreSslVerification?: boolean
	) {
		if (!url || (authType === 'basic' && (!username || !password))) {
			throw new Error('Missing required inputs for Cluster controller API (URL, username, password)');
		}
		this._url = adjustUrl(url);
		if (this.authType === 'basic') {
			this.authPromise = Promise.resolve(new BasicAuth(username, password, !!ignoreSslVerification));
		} else {
			this.authPromise = this.requestTokenUsingKerberos(ignoreSslVerification);
		}
		this.dialog = new ConnectControllerDialog(new ConnectControllerModel(
			{
				url: this._url,
				auth: this.authType,
				username: this.username,
				password: this.password
			}));
	}

	private async requestTokenUsingKerberos(ignoreSslVerification?: boolean): Promise<Authentication> {
		let supportsKerberos = await this.verifyKerberosSupported(ignoreSslVerification);
		if (!supportsKerberos) {
			throw new Error(localize('error.no.activedirectory', "This cluster does not support Windows authentication"));
		}

		try {

			// AD auth is available, login to keberos and convert to token auth for all future calls
			let host = getHostAndPortFromEndpoint(this._url).host;
			let kerberosToken = await authenticateKerberos(host);
			let tokenApi = new TokenRouterApi(this._url);
			tokenApi.setDefaultAuthentication(new KerberosAuth(kerberosToken, !!ignoreSslVerification));
			let result = await tokenApi.apiV1TokenPost();
			let auth = new OAuthWithSsl(ignoreSslVerification);
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

	private async verifyKerberosSupported(ignoreSslVerification: boolean): Promise<boolean> {
		let tokenApi = new TokenRouterApi(this._url);
		tokenApi.setDefaultAuthentication(new SslAuth(!!ignoreSslVerification));
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

	public async getEndPoints(promptConnect: boolean = false): Promise<IEndPointsResponse> {
		try {
			return await this.withConnectRetry<IEndPointsResponse>(this.getEndpointsImpl, promptConnect);
		} catch (error) {
			throw new ControllerError(error, localize('bdc.error.getEndPoints', "Error retrieving endpoints from {0}", this._url));
		}
	}

	private async getEndpointsImpl(self: ClusterController): Promise<IEndPointsResponse> {
		let auth = await self.authPromise;
		let endPointApi = new BdcApiWrapper(self.username, self.password, self._url, auth);
		let options: any = {};

		let result = await endPointApi.endpointsGet(options);
		return {
			response: result.response as IHttpResponse,
			endPoints: result.body as EndpointModel[]
		};
	}

	public async getBdcStatus(promptConnect: boolean = false): Promise<IBdcStatusResponse> {
		try {
			return await this.withConnectRetry<IBdcStatusResponse>(this.getBdcStatusImpl, promptConnect);
		} catch (error) {
			throw new ControllerError(error, localize('bdc.error.getBdcStatus', "Error retrieving BDC status from {0}", this._url));
		}
	}

	private async getBdcStatusImpl(self: ClusterController): Promise<IBdcStatusResponse> {
		let auth = await self.authPromise;
		const bdcApi = new BdcApiWrapper(self.username, self.password, self._url, auth);

		const bdcStatus = await bdcApi.getBdcStatus('', '', /*all*/ true);
		return {
			response: bdcStatus.response,
			bdcStatus: bdcStatus.body
		};
	}

	public async mountHdfs(mountPath: string, remoteUri: string, credentials: {}, promptConnection: boolean = false): Promise<MountResponse> {
		try {
			return await this.withConnectRetry<MountResponse>(this.mountHdfsImpl, promptConnection, mountPath, remoteUri, credentials);
		} catch (error) {
			throw new ControllerError(error, localize('bdc.error.mountHdfs', "Error creating mount"));
		}
	}

	private async mountHdfsImpl(self: ClusterController, mountPath: string, remoteUri: string, credentials: {}): Promise<MountResponse> {
		let auth = await self.authPromise;
		const api = new DefaultApiWrapper(self.username, self.password, self._url, auth);

		const mountStatus = await api.createMount('', '', remoteUri, mountPath, credentials);
		return {
			response: mountStatus.response,
			status: mountStatus.body
		};
	}

	public async getMountStatus(mountPath?: string, promptConnect: boolean = false): Promise<MountStatusResponse> {
		try {
			return await this.withConnectRetry<MountStatusResponse>(this.getMountStatusImpl, promptConnect, mountPath);
		} catch (error) {
			throw new ControllerError(error, localize('bdc.error.mountHdfs', "Error creating mount"));
		}
	}

	private async getMountStatusImpl(self: ClusterController, mountPath?: string): Promise<MountStatusResponse> {
		const auth = await self.authPromise;
		const api = new DefaultApiWrapper(self.username, self.password, self._url, auth);

		const mountStatus = await api.listMounts('', '', mountPath);
		return {
			response: mountStatus.response,
			mount: mountStatus.body ? JSON.parse(mountStatus.body) : undefined
		};
	}

	public async refreshMount(mountPath: string, promptConnect: boolean = false): Promise<MountResponse> {
		try {
			return await this.withConnectRetry<MountResponse>(this.refreshMountImpl, promptConnect, mountPath);
		} catch (error) {
			throw new ControllerError(error, localize('bdc.error.refreshHdfs', "Error refreshing mount"));
		}
	}

	private async refreshMountImpl(self: ClusterController, mountPath: string): Promise<MountResponse> {
		const auth = await self.authPromise;
		const api = new DefaultApiWrapper(self.username, self.password, self._url, auth);

		const mountStatus = await api.refreshMount('', '', mountPath);
		return {
			response: mountStatus.response,
			status: mountStatus.body
		};
	}

	public async deleteMount(mountPath: string, promptConnect: boolean = false): Promise<MountResponse> {
		try {
			return await this.withConnectRetry<MountResponse>(this.deleteMountImpl, promptConnect, mountPath);
		} catch (error) {
			throw new ControllerError(error, localize('bdc.error.deleteHdfs', "Error deleting mount"));
		}
	}

	private async deleteMountImpl(mountPath: string): Promise<MountResponse> {
		let auth = await this.authPromise;
		const api = new DefaultApiWrapper(this.username, this.password, this._url, auth);

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
	 * @param args The args to pass to the function
	 */
	private async withConnectRetry<T>(f: (...args: any[]) => Promise<T>, promptConnect: boolean, ...args: any[]): Promise<T> {
		try {
			return await f(this, args);
		} catch (error) {
			if (promptConnect) {
				// We don't want to open multiple dialogs here if multiple calls come in the same time so check
				// and see if we have are actively waiting on an open dialog to return and if so then just wait
				// on that promise.
				if (!this.connectionPromise) {
					this.connectionPromise = this.dialog.showDialog();
				}
				const controller = await this.connectionPromise;
				this.connectionPromise = undefined;
				if (controller) {
					this.username = controller.username;
					this.password = controller.password;
					this._url = controller._url;
					this.authType = controller.authType;
					this.authPromise = controller.authPromise;
				}
				return await f(this, args);
			}
			throw error;
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
