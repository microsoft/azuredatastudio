/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Url } from 'url';
import * as localVarRequest from 'request';
import * as http from 'http';
import * as fs from 'fs';
//import * as nls from 'vscode-nls';

//const localize = nls.loadMessageBundle();

export class RemoteBookController {
	//private releases: ReleaseResponse[];
	private _path: string;
	private _url: string;
	private _remoteLocation: string;
	constructor(_url: string,
		_remoteLocation: string) {
		if (_remoteLocation === 'GitHub') {
			this._path = 'https://api.github.com/'.concat(this._url);
		} else {
			this._path = this._url;
		}
	}


	//validate URL
	// validate URL exists

	// get versions

	// show versions

	// pick version

	// open file

	public async validate(): Promise<boolean> {
		if (this._remoteLocation === 'SharedFile') {
			try {
				let fileExists = fs.existsSync(this._path);
				return fileExists;
			}
			catch (error) {
				throw (error);
			}
		}
		return false;
	}

	public async getReleases() {
		let localVarRequestOptions: localVarRequest.Options = {
			method: 'GET',
			uri: 'https://api.github.com/repos/microsoft/azuredatastudio/releases',
			json: true,
		};

		return new Promise<{ response: http.IncomingMessage; body: IVersionsResponse; }>((resolve, reject) => {
			localVarRequest(localVarRequestOptions, (error, response, body) => {
				let versions = JSON.parse(body);
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: versions });
					} else {
						reject({ response: response, body: versions });
					}
				}
			});
		});
	}
}
/* aewq
async function call<T>(f: (...args: any[]) => Promise<T>, errorMessage: string, ...args: any[]): Promise<T> {
	try {
		return await f(this, ...args);
	} catch (error) {
		throw error;
	}
}
*/


export interface IHttpResponse {
	method?: string;
	url?: string;
	statusCode?: number;
	statusMessage?: string;
}

export interface IVersionsResponse {
	response: IHttpResponse;
	versions: VersionsModel[];
}

export class VersionsModel {
	id: string;
	name: string;
	tag_name: string;
	browser_download_url: Url;
}

export interface ReleaseResponse {
	response: IHttpResponse;
	status: string;
}
/*
export async function fetch(url: string): Promise<any> {
	return new Promise<any>((resolve, reject) => {
		request.get(url, (error, response, body) => {
			if (error) {
				return reject(error);
			}

			if (response.statusCode === 404) {
				return reject('Resource Not found');
			}

			if (response.statusCode !== 200) {
				return reject(
					response.statusCode);
			}

			resolve(body);
		});
	});
}*/

