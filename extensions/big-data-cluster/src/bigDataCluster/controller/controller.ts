/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EndpointRouterApi } from './apiGenerated';
import { IEndPointsResponse, IControllerError, IEndPointsRequest, IHttpResponse, IEndPoint } from './types';

export class BdcController {

	// this fixes missing protocol and wrong character for port entered by user
	private static adjustUrl(url: string): string {
		if (!url) {
			return undefined;
		}

		url = url.trim().replace(/ /g, '').replace(/,(\d+)$/, ':$1');
		if (!url.includes('://')) {
			url = `https://${url}`;
		}
		return url;
	}

	public static async getEndPoints(
		url: string, username: string, password: string, ignoreSslVerification?: boolean
	): Promise<IEndPointsResponse> {

		if (!url || !username || !password) {
			return undefined;
		}

		url = this.adjustUrl(url);
		let ep = new EndpointRouterApi(username, password, url);
		ep.ignoreSslVerification = !!ignoreSslVerification;

		let controllerResponse: IEndPointsResponse = undefined;
		let controllerError: IControllerError = undefined;
		let request = <IEndPointsRequest>{
			url: url,
			username: username,
			password: password,
			method: 'endPointsGet'
		};

		try {
			let result = await ep.endpointsGet();
			controllerResponse = <IEndPointsResponse>{
				response: result.response as IHttpResponse,
				endPoints: result.body as IEndPoint[],
				request
			};
		} catch (error) {
			if ('response' in error) {
				let err: IEndPointsResponse = error as IEndPointsResponse;
				let errCode = `${err.response.statusCode || ''}`;
				let errMessage = err.response.statusMessage;
				let errUrl = err.response.url;
				controllerError = <IControllerError>{
					address: errUrl,
					code: errCode,
					errno: errCode,
					message: errMessage,
					name: undefined
				};
			} else {
				controllerError = error as IControllerError;
			}
			controllerError = Object.assign(controllerError, { request }) as IControllerError;
		}

		if (!controllerResponse && !controllerError) {
			return undefined;
		}

		return new Promise<IEndPointsResponse>((resolve, reject) => {
			if (controllerResponse) {
				resolve(controllerResponse);
			} else {
				reject(controllerError);
			}
		});
	}
}