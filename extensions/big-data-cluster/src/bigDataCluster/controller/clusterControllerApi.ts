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

	public async getEndPoints(): Promise<IEndPointsResponse> {
		let auth = await this.authPromise;
		let endPointApi = new BdcApiWrapper(this.username, this.password, this._url, auth);
		let options: any = {};
		try {
			let result = await endPointApi.endpointsGet(options);
			return {
				response: result.response as IHttpResponse,
				endPoints: result.body as EndpointModel[]
			};
		} catch (error) {
			// TODO handle 401 by reauthenticating
			throw new ControllerError(error, localize('bdc.error.getEndPoints', "Error retrieving endpoints from {0}", this._url));
		}
	}

	public async getBdcStatus(): Promise<IBdcStatusResponse> {
		let auth = await this.authPromise;
		const bdcApi = new BdcApiWrapper(this.username, this.password, this._url, auth);

		try {
			const bdcStatus = await bdcApi.getBdcStatus('', '', /*all*/ true);
			return {
				response: bdcStatus.response,
				bdcStatus: bdcStatus.body
			};
		} catch (error) {
			// TODO handle 401 by reauthenticating
			throw new ControllerError(error, localize('bdc.error.getBdcStatus', "Error retrieving BDC status from {0}", this._url));
		}
	}

	public async mountHdfs(mountPath: string, remoteUri: string, credentials: {}): Promise<MountResponse> {
		let auth = await this.authPromise;
		const api = new DefaultApiWrapper(this.username, this.password, this._url, auth);

		try {
			const mountStatus = await api.createMount('', '', remoteUri, mountPath, credentials);
			return {
				response: mountStatus.response,
				status: mountStatus.body
			};
		} catch (error) {
			// TODO handle 401 by reauthenticating
			throw new ControllerError(error, localize('bdc.error.mountHdfs', "Error creating mount"));
		}
	}

	public async getMountStatus(mountPath?: string): Promise<MountStatusResponse> {
		let auth = await this.authPromise;
		const api = new DefaultApiWrapper(this.username, this.password, this._url, auth);

		try {
			const mountStatus = await api.listMounts('', '', mountPath);
			return {
				response: mountStatus.response,
				mount: mountStatus.body ? JSON.parse(mountStatus.body) : undefined
			};
		} catch (error) {
			// TODO handle 401 by reauthenticating
			throw new ControllerError(error, localize('bdc.error.mountHdfs', "Error creating mount"));
		}
	}

	public async refreshMount(mountPath: string): Promise<MountResponse> {
		let auth = await this.authPromise;
		const api = new DefaultApiWrapper(this.username, this.password, this._url, auth);

		try {
			const mountStatus = await api.refreshMount('', '', mountPath);
			return {
				response: mountStatus.response,
				status: mountStatus.body
			};
		} catch (error) {
			// TODO handle 401 by reauthenticating
			throw new ControllerError(error, localize('bdc.error.refreshHdfs', "Error refreshing mount"));
		}
	}

	public async deleteMount(mountPath: string): Promise<MountResponse> {
		let auth = await this.authPromise;
		const api = new DefaultApiWrapper(this.username, this.password, this._url, auth);

		try {
			const mountStatus = await api.deleteMount('', '', mountPath);
			return {
				response: mountStatus.response,
				status: mountStatus.body
			};
		} catch (error) {
			// TODO handle 401 by reauthenticating
			throw new ControllerError(error, localize('bdc.error.deleteHdfs', "Error deleting mount"));
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
