/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICommandLineProcessing } from 'sql/workbench/services/commandLine/common/commandLine';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IEnvironmentService, ParsedArgs } from 'vs/platform/environment/common/environment';
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
import { ipcRenderer as ipc} from 'electron';

export class CommandLineService implements ICommandLineProcessing {

	constructor(
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEnvironmentService private _environmentService: IEnvironmentService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _editorService: IEditorService,
		@ICommandService private _commandService: ICommandService,
		@IWorkspaceConfigurationService private _configurationService: IWorkspaceConfigurationService
	) {
		if (ipc) {
		    ipc.on('ads:processCommandLine', (event: any, args: ParsedArgs) => this.onLaunched(args));
		}
		// we only get the ipc from main during window reuse
		this.onLaunched(_environmentService.args);
	}

	private onLaunched(args: ParsedArgs)
	{
		const registry = platform.Registry.as<IConnectionProviderRegistry>(ConnectionProviderExtensions.ConnectionProviderContributions);
		let sqlProvider = registry.getProperties(Constants.mssqlProviderName);
		// We can't connect to object explorer until the MSSQL connection provider is registered
		if (sqlProvider) {
			this.processCommandLine(args).catch(reason => { warn('processCommandLine failed: ' + reason); });
		} else {
			registry.onNewProvider(e => {
				if (e.id === Constants.mssqlProviderName) {
					this.processCommandLine(args).catch(reason => { warn('processCommandLine failed: ' + reason); });
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
	public processCommandLine(args: ParsedArgs): Promise<void> {
		let profile = undefined;
		let commandName = undefined;
		if (args) {
			if (this._commandService) {
				commandName = args.command;
			}

			if (args.server) {
				profile = new ConnectionProfile(this._capabilitiesService, null);
				// We want connection store to use any matching password it finds
				profile.savePassword = true;
				profile.providerName = Constants.mssqlProviderName;
				profile.serverName = args.server;
				profile.databaseName = args.database ? args.database : '';
				profile.userName = args.user ? args.user : '';
				profile.authenticationType = args.integrated ? 'Integrated' : 'SqlLogin';
				profile.connectionName = '';
				profile.setOptionValue('applicationName', Constants.applicationName);
				profile.setOptionValue('databaseDisplayName', profile.databaseName);
				profile.setOptionValue('groupId', profile.groupId);
			}
	    }
		let self = this;
		return new Promise<void>((resolve, reject) => {
			let showConnectDialogOnStartup: boolean = self._configurationService.getValue('workbench.showConnectDialogOnStartup');
			if (showConnectDialogOnStartup && !commandName && !profile && !self._connectionManagementService.hasRegisteredServers()) {
				// prompt the user for a new connection on startup if no profiles are registered
				self._connectionManagementService.showConnectionDialog()
					.then(() => {
						resolve();
					},
						error => {
							reject(error);
						});
			} else if (profile) {
				if (!commandName) {
					self._connectionManagementService.connectIfNotConnected(profile, 'connection', true)
						.then(() => {
							TaskUtilities.newQuery(profile,
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
					self._connectionManagementService.connectIfNotConnected(profile, 'connection', true)
						.then(() => {
							self._commandService.executeCommand(commandName, profile.id).then(() => resolve(), error => reject(error));
						}, error => {
							reject(error);
						});
				}
			} else if (commandName) {
				self._commandService.executeCommand(commandName).then(() => resolve(), error => reject(error));
			}
			else {
				resolve();
			}
		});
	}
}