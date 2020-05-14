/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Url } from 'url';
import * as request from 'request';
//import * as nls from 'vscode-nls';

//const localize = nls.loadMessageBundle();

export class RemoteBookController {
	//private releases: ReleaseResponse[];
	//private _url: string;
	constructor(url: string,
		remoteLocation: string) {
	}

	//validate URL
	// validate URL exists

	// get versions

	// show versions

	// pick version

	// open file

}

export async function getReleases() {
	let releases = await fetch('https://api.github.com/repos/microsoft/azuredatastudio/releases');

	console.log(releases);
}
/*
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
}
