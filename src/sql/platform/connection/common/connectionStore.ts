/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

const RECENT_CONNECTIONS_STATE_KEY = 'recentConnections';

export const IConnectionStore = createDecorator<IConnectionStore>('connectionStore');
export interface IConnectionStore {
	getMru(providers?: string[]): ReadonlyArray<ConnectionProfile>;
	getPassword(profile: ConnectionProfile): Promise<string>;
	savePassword(profile: ConnectionProfile): Promise<boolean>;
	clearMru(): void;
	saveToMru(profile: ConnectionProfile): void;
	removeFromMru(profile: ConnectionProfile): boolean;
}

/**
 * Manages recently used connections and saved password store
 *
 */
export class ConnectionStore implements IConnectionStore {
	// newest at the front (posisiton 0 is newest)
	private mru: Array<ConnectionProfile>;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICredentialsService private readonly credentialService: ICredentialsService
	) {
		try {
			const configRaw = this.storageService.get(RECENT_CONNECTIONS_STATE_KEY, StorageScope.GLOBAL, '[]');
			this.mru = JSON.parse(configRaw);
		} catch (e) {
			this.mru = [];
		}

		this.storageService.onWillSaveState(() => this.storageService.store(RECENT_CONNECTIONS_STATE_KEY, JSON.stringify(this.mru), StorageScope.GLOBAL));
	}

	public async getPassword(profile: ConnectionProfile): Promise<string> {
		const cred = await this.credentialService.readCredential(profile.toString());
		return cred.password;
	}

	public savePassword(profile: ConnectionProfile): Promise<boolean> {
		return this.credentialService.saveCredential(profile.toString(), profile.password);
	}

	/**
	 * Gets the list of recently used connections. These will not include the password - a separate call to
	 * {addSavedPassword} is needed to fill that before connecting
	 *
	 * @returns the array of connections, empty if none are found
	 */
	public getMru(providers?: string[]): ConnectionProfile[] {
		return this.mru.slice().filter(c => providers.some(p => p === c.providerName));
	}

	/**
	 * Adds a connection to the active connections list.
	 * Connection is only added if there are no other connections with the same connection ID in the list.
	 * Password values are stored to a separate credential store if the "savePassword" option is true
	 *
	 * @param conn the connection to add
	 * @param addToMru Whether to add this connection to the MRU
	 * @returns a Promise that returns when the connection was saved
	 */
	public saveToMru(conn: ConnectionProfile): void {
		const maxConnections = this.getMaxRecentConnectionsCount();
		this.mru.unshift(conn);
		if (this.mru.length > maxConnections) {
			this.mru = this.mru.slice(0, maxConnections);
		}
	}

	/**
	 * Clear all recently used connections from the MRU list.
	 */
	public clearMru(): void {
		this.mru = new Array<ConnectionProfile>();
	}

	public removeFromMru(conn: ConnectionProfile): boolean {
		const oldMru = this.mru;
		this.mru = this.mru.filter(c => c.matches(conn));
		if (oldMru.length !== this.mru.length) {
			return true;
		} else {
			return false;
		}
	}

	private getMaxRecentConnectionsCount(): number {
		return this.configurationService.getValue('sql.maxRecentConnections');
	}
}

registerSingleton(IConnectionStore, ConnectionStore, true);
