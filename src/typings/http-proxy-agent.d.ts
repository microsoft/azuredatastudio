/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'http-proxy-agent' {

	interface IHttpProxyAgentOptions {
		host: string;
		port: number;
		auth?: string;
	}

	class HttpProxyAgent {
		constructor(proxy: string);
		constructor(opts: IHttpProxyAgentOptions);
	}

	export = HttpProxyAgent;
}