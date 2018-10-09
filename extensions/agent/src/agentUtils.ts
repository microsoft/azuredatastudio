'use strict';

import * as sqlops from 'sqlops';

export class AgentUtils {

	private static _agentService: sqlops.AgentServicesProvider;
	private static _connectionService: sqlops.ConnectionProvider;
	private static _queryProvider: sqlops.QueryProvider;

	public static async getAgentService(): Promise<sqlops.AgentServicesProvider> {
		if (!AgentUtils._agentService) {
			let currentConnection = await sqlops.connection.getCurrentConnection();
			this._agentService = sqlops.dataprotocol.getProvider<sqlops.AgentServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.AgentServicesProvider);
		}
		return AgentUtils._agentService;
	}

	public static async getDatabases(ownerUri: string): Promise<string[]> {
		if (!AgentUtils._connectionService) {
			let currentConnection = await sqlops.connection.getCurrentConnection();
			this._connectionService = sqlops.dataprotocol.getProvider<sqlops.ConnectionProvider>(currentConnection.providerName, sqlops.DataProviderType.ConnectionProvider);
		}
		return AgentUtils._connectionService.listDatabases(ownerUri).then(result => {
			if (result && result.databaseNames && result.databaseNames.length > 0) {
				return result.databaseNames;
			}
		});
	}

	public static async getQueryProvider(): Promise<sqlops.QueryProvider> {
		if (!AgentUtils._queryProvider) {
			let currentConnection = await sqlops.connection.getCurrentConnection();
			this._queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(currentConnection.providerName, sqlops.DataProviderType.QueryProvider);
		}
		return this._queryProvider;
	}

}