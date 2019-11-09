/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { ILogService } from 'vs/platform/log/common/log';
import { Connection } from 'sql/base/common/connection';

export class ConnectionStatusManager {

	private readonly connections = new Map<string, Connection>();

	constructor(@ILogService private readonly logService: ILogService) {
	}

	public findConnection(id: string): Connection | undefined {
		return this.connections.get(id);
	}

	public findConnectionProfile(connectionProfile: ConnectionProfile): Connection | undefined {
		for (const [, connection] of this.connections) {
			if (connection[1].profile.matches(connectionProfile)) {
				return connection[1];
			}
		}
		return undefined;
	}

	public deleteConnection(id: string): void {
		if (this.connections.has(id)) {
			this.connections.delete(id);
			this.logService.info(`Deleted connection ${id}`);
		} else {
			this.logService.warn(`Attempted to delete connection that doesn't exist`);
		}
	}

	public addConnection(connection: Connection): void {
		this.logService.info(`Adding connection ${connection.id}`);
		if (this.connections.has(connection.id)) {
			this.logService.error(`Attempted to add connection ${connection.id}, but it already exists`);
			throw new Error('Attempted to add a connection that already exists');
		}
	}
}
