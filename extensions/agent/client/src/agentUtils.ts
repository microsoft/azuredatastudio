'use strict';

import * as sqlops from 'sqlops';

export class AgentUtils {
	private static _agentService: sqlops.AgentServicesProvider;

	public static async getAgentService(): Promise<sqlops.AgentServicesProvider> {
		if (!AgentUtils._agentService) {
			let currentConnection = await sqlops.connection.getCurrentConnection();
			this._agentService = sqlops.dataprotocol.getProvider<sqlops.AgentServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.AgentServicesProvider);
		}

		return AgentUtils._agentService;
	}
}