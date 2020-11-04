/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as request from 'request';
import * as constants from '../common/constants';

const localize = nls.loadMessageBundle();

export interface IPyPiClient {
	fetchPypiPackage(packageName: string): Promise<any>;
}

export class PyPiClient implements IPyPiClient {

	private readonly RequestTimeout = 10000;
	private getLink(packageName: string): string {
		return `https://pypi.org/pypi/${packageName}/json`;
	}

	public async fetchPypiPackage(packageName: string): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			request.get(this.getLink(packageName), { timeout: this.RequestTimeout }, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(constants.PackageNotFoundError);
				}

				if (response.statusCode !== 200) {
					return reject(
						localize('managePackages.packageRequestError',
							"Package info request failed with error: {0} {1}",
							response.statusCode,
							response.statusMessage));
				}

				resolve(body);
			});
		});
	}
}
