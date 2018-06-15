'use strict';

import * as sqlops from 'sqlops';

export class AgentUtils {

	private static _agentService: sqlops.AgentServicesProvider;
	private static _connectionService: sqlops.ConnectionProvider;

	public static async getAgentService(): Promise<sqlops.AgentServicesProvider> {
		if (!AgentUtils._agentService) {
			let currentConnection = await sqlops.connection.getCurrentConnection();
			this._agentService = sqlops.dataprotocol.getProvider<sqlops.AgentServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.AgentServicesProvider);
		}
		return AgentUtils._agentService;
	}

	public static async getDatabases(ownerUri: string): Promise<string[]> {
		let currentConnection = await sqlops.connection.getCurrentConnection();
		if (!AgentUtils._connectionService) {
			this._connectionService = sqlops.dataprotocol.getProvider<sqlops.ConnectionProvider>(currentConnection.providerName, sqlops.DataProviderType.ConnectionProvider);
		}
		return AgentUtils._connectionService.listDatabases(ownerUri).then(result => {
			if (result && result.databaseNames && result.databaseNames.length > 0) {
				return result.databaseNames;
			}
		});
	}
}