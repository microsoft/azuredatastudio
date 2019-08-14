/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import { ClusterRouterApi, Authentication, DefaultApi, EndpointModel } from './apiGenerated';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

class AuthConfiguration implements Authentication {
	public username: string = '';
	public password: string = '';

	constructor(private _ignoreSslVerification: boolean) {
	}

	applyToRequest(requestOptions: request.Options): void {
		requestOptions['agentOptions'] = {
			rejectUnauthorized: !this._ignoreSslVerification
		};
	}
}

class ClusterApiWrapper extends ClusterRouterApi {
	constructor(basePathOrUsername: string, password?: string, basePath?: string, ignoreSslVerification?: boolean) {
		super(basePathOrUsername, password, basePath);
		this.authentications.default = new AuthConfiguration(!!ignoreSslVerification);
	}
}

export async function getEndPoints(
	clusterName: string,
	url: string,
	username: string,
	password: string,
	ignoreSslVerification?: boolean
): Promise<IEndPointsResponse> {

	if (!url || !username || !password) {
		return undefined;
	}

	url = adjustUrl(url);
	let endPointApi = new ClusterApiWrapper(username, password, url, !!ignoreSslVerification);

	try {
		let result = await endPointApi.endpointsGet(clusterName);
		return {
			response: result.response as IHttpResponse,
			endPoints: result.body as EndpointModel[]
		};
	} catch (error) {
		throw new ControllerError(error, localize('bdc.error.getEndPoints', "Error retrieving endpoints from {0}", url));
	}
}

class DefaultApiWrapper extends DefaultApi {
	constructor(basePathOrUsername: string, password?: string, basePath?: string, ignoreSslVerification?: boolean) {
		super(basePathOrUsername, password, basePath);
		this.authentications.default = new AuthConfiguration(!!ignoreSslVerification);
	}
}

export async function getClusterStatus(
	clusterName: string,
	url: string,
	username: string,
	password: string,
	ignoreSslVerification?: boolean
): Promise<IClusterStatusResponse> {

	if (!url) {
		return undefined;
	}

	url = adjustUrl(url);
	const defaultApi = new DefaultApiWrapper(username, password, url, ignoreSslVerification);

	try {
		const clusterStatus = await defaultApi.getClusterStatus('', '', clusterName);
		return {
			response: clusterStatus.response,
			clusterStatus: clusterStatus.body
		};
	} catch (error) {
		throw new ControllerError(error, localize('bdc.error.getClusterStatus', "Error retrieving cluster status from {0}", url));
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

export interface IClusterStatusResponse {
	response: IHttpResponse;
	clusterStatus: IBdcStatus;
}

export interface IHttpResponse {
	method?: string;
	url?: string;
	statusCode?: number;
	statusMessage?: string;
}

export interface IBdcStatus {
	name: string;
	status: IStatus;
	services: IServiceStatus[];
}

export interface IServiceStatus {
	serviceName: string;
	status: IStatus;
	resources: IResourceStatus[];
}

export interface IResourceStatus {
	resourceName: string;
	status: IStatus;
	instances?: IInstanceStatus[];
}

export interface IInstanceStatus {
	instanceName: string;
	status: IStatus;
	dashboards: IDashboard[];
}

export interface IDashboard {
	nodeMetricsUrl: string;
	sqlMetricsUrl: string;
	logsUrl: string;
}

export interface IStatus {
	state: string;
	healthStatus: string;
	details?: string;
}

export class ControllerError extends Error {
	public code?: string;
	public errno?: string;
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
			this.code = error.response.statusCode || '';
			this.message += `${error.response.statusMessage ? ` - ${error.response.statusMessage}` : ''}` || '';
			this.address = error.response.url || '';
		}

		// The body message contains more specific information about the failure
		if (error.body && error.body.reason) {
			this.message += ` - ${error.body.reason}`;
		}
	}
}
