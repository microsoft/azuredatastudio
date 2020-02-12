/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as http from 'http';
import * as url from 'url';
import { AddressInfo } from 'net';

export type WebHandler = (req: http.IncomingMessage, reqUrl: url.UrlWithParsedQuery, res: http.ServerResponse) => void;

export class SimpleWebServer {
	private readonly pathMappings = new Map<string, WebHandler>();
	private readonly server: http.Server;

	constructor() {
		this.server = http.createServer((req, res) => {
			const reqUrl = url.parse(req.url!, /* parseQueryString */ true);

			const handler = this.pathMappings.get(reqUrl.pathname);
			if (handler) {
				return handler(req, reqUrl, res);
			}

			console.error('Unhandled request ', reqUrl);
		});
	}

	public async shutdown(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.server.close((error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	public startup(): Promise<string> {
		let portTimeout: NodeJS.Timer;
		const portPromise = new Promise<string>((resolve, reject) => {
			portTimeout = setTimeout(() => {
				reject(new Error('Timed out waiting for the server to start'));
			}, 5000);

			this.server.on('listening', () => {
				// TODO: What are string addresses?
				const address = this.server.address() as AddressInfo;
				if (address!.port === undefined) {
					reject(new Error('Port was not defined'));
				}
				resolve(address.port.toString());
			});

			this.server.on('error', () => {
				reject(new Error('Server error'));
			});

			this.server.on('close', () => {
				reject(new Error('Server closed'));
			});

			this.server.listen(0);
		});

		const clearPortTimeout = () => {
			clearTimeout(portTimeout);
		};

		portPromise.then(clearPortTimeout, clearPortTimeout);

		return portPromise;
	}

	public on(pathMapping: string, handler: WebHandler) {
		this.pathMappings.set(pathMapping, handler);
	}
}
