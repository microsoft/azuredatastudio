/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ImportDataModel } from './models';

export abstract class BasePage {

	protected readonly wizardPage: azdata.window.WizardPage;
	protected readonly model: ImportDataModel;
	protected readonly view: azdata.ModelView;

	/**
	 * This method constructs all the elements of the page.
	 */
	public async abstract start(): Promise<boolean>;

	/**
	 * This method is called when the user is entering the page.
	 */
	public async abstract onPageEnter(): Promise<boolean>;

	/**
	 * This method is called when the user is leaving the page.
	 */
	async onPageLeave(): Promise<boolean> {
		return true;
	}

	/**
	 * Override this method to cleanup what you don't need cached in the page.
	 */
	public async cleanup(): Promise<boolean> {
		return true;
	}

	/**
	 * Sets up a navigation validator.
	 * This will be called right before onPageEnter().
	 */
	public abstract setupNavigationValidator(): void;

	public async getServerValues(): Promise<{ connection: azdata.connection.Connection, displayName: string, name: string }[]> {
		let cons = await azdata.connection.getActiveConnections();
		// This user has no active connections ABORT MISSION
		if (!cons || cons.length === 0) {
			return undefined;
		}

		let count = -1;
		let idx = -1;


		let values = cons.map(c => {
			// Handle the code to remember what the user's choice was from before
			count++;
			if (idx === -1) {
				if (this.model.server && c.connectionId === this.model.server.connectionId) {
					idx = count;
				} else if (this.model.serverId && c.connectionId === this.model.serverId) {
					idx = count;
				}
			}

			let usr = c.options.user;
			let srv = c.options.server;

			if (!usr) {
				usr = 'default';
			}

			let finalName = `${srv} (${usr})`;
			return {
				connection: c,
				displayName: finalName,
				name: c.connectionId
			};
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		} else {
			this.deleteServerValues();
		}

		return values;
	}

	public async getDatabaseValues(): Promise<{ displayName: string, name: string }[]> {
		let idx = -1;
		let count = -1;
		let values = (await azdata.connection.listDatabases(this.model.server.connectionId)).map(db => {
			count++;
			if (this.model.database && db === this.model.database) {
				idx = count;
			}

			return {
				displayName: db,
				name: db
			};
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}
		return values;
	}

	protected deleteServerValues() {
		delete this.model.server;
		delete this.model.serverId;
		delete this.model.database;
	}
}
