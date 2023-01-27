/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApiType, managerInstance } from '../service/serviceApiManager';
import { SqlMigrationService } from './features';
import * as constants from '../constants/strings';
import * as vscode from 'vscode';

export class MigrationServiceProvider {
	private static instance: MigrationServiceProvider;
	private service!: SqlMigrationService;

	private constructor() {
		managerInstance.onRegisteredApi<SqlMigrationService>(ApiType.SqlMigrationProvider)(provider => {
			this.service = provider;
		});
	}

	static initialize() {
		if (!MigrationServiceProvider.instance) {
			MigrationServiceProvider.instance = new MigrationServiceProvider();
		}
	}

	static getInstance() {
		if (!MigrationServiceProvider.instance) {
			MigrationServiceProvider.initialize();
		}
		return MigrationServiceProvider.instance;
	}

	public async getService(): Promise<SqlMigrationService> {
		if (this.service) {
			return this.service;
		}
		return this.waitUntilProviderReady();
	}

	public async waitUntilProviderReady(): Promise<SqlMigrationService> {
		this.service = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: constants.waitingForService,
			cancellable: false
		}, (progress, token) => {
			return new Promise<SqlMigrationService>(resolve => {
				const interval = setInterval(() => {
					if (this.service) {
						clearInterval(interval);
						resolve(this.service);
					}

				}, 250);
			});
		});
		return this.service;
	}
}
