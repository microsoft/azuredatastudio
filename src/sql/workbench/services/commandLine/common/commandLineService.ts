/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICommandLineProcessing } from 'sql/workbench/services/commandLine/common/commandLine';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import * as Constants from 'sql/platform/connection/common/constants';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import * as platform from 'vs/platform/registry/common/platform';
import { IConnectionProviderRegistry, Extensions as ConnectionProviderExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { warn } from 'sql/base/common/log';

export class CommandLineService implements ICommandLineProcessing {
	private _connectionProfile: ConnectionProfile;
	private _showConnectionDialog: boolean;
	private _commandName: string;

	constructor(
		@ICapabilitiesService _capabilitiesService: ICapabilitiesService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEnvironmentService private _environmentService: IEnvironmentService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _editorService: IEditorService,
		@ICommandService private _commandService: ICommandService,
		@IWorkspaceConfigurationService private _configurationService: IWorkspaceConfigurationService
	) {
		let profile = null;
		if (this._environmentService) {
			if (this._commandService) {
				this._commandName = this._environmentService.args.command;
			}
			if (this._environmentService.args.server) {
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
		}
		this._connectionProfile = profile;
		const registry = platform.Registry.as<IConnectionProviderRegistry>(ConnectionProviderExtensions.ConnectionProviderContributions);
		let sqlProvider = registry.getProperties(Constants.mssqlProviderName);
		// We can't connect to object explorer until the MSSQL connection provider is registered
		if (sqlProvider) {
			this.processCommandLine().catch(reason => { warn('processCommandLine failed: ' + reason); });
		} else {
			registry.onNewProvider(e => {
				if (e.id === Constants.mssqlProviderName) {
					this.processCommandLine().catch(reason => { warn('processCommandLine failed: ' + reason); });
				}
			});
		}
	}
	public _serviceBrand: any;
	// We base our logic on the combination of (server, command) values.
	// (serverName, commandName) => Connect object explorer and execute the command, passing the connection profile to the command. Do not load query editor.
	// (null, commandName) => Launch the command with a null connection. If the command implementation needs a connection, it will need to create it.
	// (serverName, null) => Connect object explorer and open a new query editor
	// (null, null) => Prompt for a connection unless there are registered servers
	public processCommandLine(): Promise<void> {

		let self = this;
		return new Promise<void>((resolve, reject) => {
			let showConnectDialogOnStartup: boolean = this._configurationService.getValue('workbench.showConnectDialogOnStartup');
			if (showConnectDialogOnStartup && !self._commandName && !self._connectionProfile && !self._connectionManagementService.hasRegisteredServers()) {
				// prompt the user for a new connection on startup if no profiles are registered
				self._connectionManagementService.showConnectionDialog()
					.then(() => {
						resolve();
					},
						error => {
							reject(error);
						});
			} else if (self._connectionProfile) {
				if (!self._commandName) {
					self._connectionManagementService.connectIfNotConnected(self._connectionProfile, 'connection', true)
						.then(() => {
							TaskUtilities.newQuery(self._connectionProfile,
								self._connectionManagementService,
								self._queryEditorService,
								self._objectExplorerService,
								self._editorService)
								.then(() => {
									resolve();
								}, error => {
									// ignore query editor failing to open.
									// the tests don't mock this out
									warn('unable to open query editor ' + error);
									resolve();
								});
						}, error => {
							reject(error);
						});
				} else {
					self._connectionManagementService.connectIfNotConnected(self._connectionProfile, 'connection', true)
						.then(() => {
							self._commandService.executeCommand(self._commandName, self._connectionProfile.id).then(() => resolve(), error => reject(error));
						}, error => {
							reject(error);
						});
				}
			} else if (self._commandName) {
				self._commandService.executeCommand(self._commandName).then(() => resolve(), error => reject(error));
			}
			else {
				resolve();
			}
		});
	}
}