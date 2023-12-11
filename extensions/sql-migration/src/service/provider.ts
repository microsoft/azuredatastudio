/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApiType, MigrationExtensionService } from './features';
import * as constants from '../constants/strings';
import * as vscode from 'vscode';

export class MigrationServiceProvider {
	private services: Map<ApiType, MigrationExtensionService> = new Map();

	constructor() {
	}

	public addService(service: MigrationExtensionService) {
		this.services.set(service.providerId, service);
	}

	public async getService(serviceId: ApiType): Promise<MigrationExtensionService> {
		if (this.services.has(serviceId)) {
			return this.services.get(serviceId)!;
		}
		return this.waitUntilProviderReady(serviceId);
	}

	public async waitUntilProviderReady(serviceId: ApiType): Promise<MigrationExtensionService> {
		const service = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: constants.waitingForService(serviceId),
			cancellable: false
		}, (progress, token) => {
			return new Promise<MigrationExtensionService>(resolve => {
				const interval = setInterval(() => {
					if (this.services.has(serviceId)) {
						clearInterval(interval);
						resolve(this.services.get(serviceId)!);
					}
				}, 250);
			});
		});
		return service;
	}
}

export const migrationServiceProvider = new MigrationServiceProvider();
