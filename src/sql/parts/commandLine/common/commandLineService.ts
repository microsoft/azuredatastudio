/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { ICommandLineProcessing } from 'sql/parts/commandLine/common/commandLine';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import * as Constants from 'sql/parts/connection/common/constants';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import * as platform from 'vs/platform/registry/common/platform';
import { ConnectionProviderProperties, IConnectionProviderRegistry, Extensions as ConnectionProviderExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class CommandLineService implements ICommandLineProcessing {
	private _connectionProfile: ConnectionProfile;
	private _showConnectionDialog: boolean;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IEnvironmentService private _environmentService: IEnvironmentService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _editorService: IEditorService,
	) {
		let profile = null;
		if (this._environmentService && this._environmentService.args.server) {
			profile = new ConnectionProfile(_capabilitiesService, null);
			// We want connection store to use any matching password it finds
			profile.savePassword = true;
			profile.providerName = Constants.mssqlProviderName;
			profile.serverName = _environmentService.args.server;
			profile.databaseName = _environmentService.args.database ? _environmentService.args.database : '';
			profile.userName = _environmentService.args.user ? _environmentService.args.user : '';
			profile.authenticationType = _environmentService.args.integrated ? 'Integrated' : 'SqlLogin';
			profile.connectionName = '';
			profile.setOptionValue('applicationName', Constants.applicationName);
			profile.setOptionValue('databaseDisplayName', profile.databaseName);
			profile.setOptionValue('groupId', profile.groupId);
		}
		this._connectionProfile = profile;
		const registry = platform.Registry.as<IConnectionProviderRegistry>(ConnectionProviderExtensions.ConnectionProviderContributions);
		let sqlProvider = registry.getProperties(Constants.mssqlProviderName);
		// We can't connect to object explorer until the MSSQL connection provider is registered
		if (sqlProvider) {
			this.processCommandLine();
		} else {
			registry.onNewProvider(e => {
				if (e.id === Constants.mssqlProviderName) {
					this.processCommandLine();
				}
			});
		}
	}
	public _serviceBrand: any;
	public processCommandLine(): void {
		if (!this._connectionProfile && !this._connectionManagementService.hasRegisteredServers()) {
			// prompt the user for a new connection on startup if no profiles are registered
			this._connectionManagementService.showConnectionDialog();
		} else if (this._connectionProfile) {
			this._connectionManagementService.connectIfNotConnected(this._connectionProfile, 'connection')
				.then(result => TaskUtilities.newQuery(this._connectionProfile,
					this._connectionManagementService,
					this._queryEditorService,
					this._objectExplorerService,
					this._editorService))
				.catch(() => { });
		}
	}
}