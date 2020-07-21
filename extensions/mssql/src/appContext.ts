/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Global context for the application
 */
export class AppContext {

	private serviceMap: Map<string, any> = new Map();

	constructor(public readonly extensionContext: vscode.ExtensionContext) { }

	public getService<T>(serviceName: string): T {
		const service = this.serviceMap.get(serviceName) as T;
		if (!service) {
			console.warn('Service ', serviceName, ' is not registered');
		}
		return service;
	}

	public registerService<T>(serviceName: string, service: T): void {
		if (this.serviceMap.has(serviceName)) {
			console.warn('Multiple services ', serviceName, ' registered!');
		} else {
			this.serviceMap.set(serviceName, service);
		}
	}
}
