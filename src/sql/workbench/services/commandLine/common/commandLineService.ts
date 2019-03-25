/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as azdata from 'azdata';
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
import { ICommandService } from 'vs/platform/commands/common/commands';
import { warn } from 'sql/base/common/log';
import { ipcRenderer as ipc} from 'electron';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export class CommandLineService implements ICommandLineProcessing {
	public _serviceBrand: any;

	constructor(
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEnvironmentService private _environmentService: IEnvironmentService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _editorService: IEditorService,
		@ICommandService private _commandService: ICommandService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		if (ipc) {
		    ipc.on('ads:processCommandLine', (event: any, args: ParsedArgs) => this.onLaunched(args));
		}
		// we only get the ipc from main during window reuse
		if (_environmentService) {
		    this.onLaunched(_environmentService.args);
		}
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

	// We base our logic on the combination of (server, command) values.
	// (serverName, commandName) => Connect object explorer and execute the command, passing the connection profile to the command. Do not load query editor.
	// (null, commandName) => Launch the command with a null connection. If the command implementation needs a connection, it will need to create it.
	// (serverName, null) => Connect object explorer and open a new query editor
	// (null, null) => Prompt for a connection unless there are registered servers
	public async processCommandLine(args: ParsedArgs): Promise<void> {
		let profile: IConnectionProfile = undefined;
		let commandName = undefined;
		if (args) {
			if (this._commandService) {
				commandName = args.command;
			}

			if (args.server) {
				profile = this.readProfileFromArgs(args);
			}
	    }
		let showConnectDialogOnStartup: boolean = this._configurationService.getValue('workbench.showConnectDialogOnStartup');
		if (showConnectDialogOnStartup && !commandName && !profile && !this._connectionManagementService.hasRegisteredServers()) {
			// prompt the user for a new connection on startup if no profiles are registered
			await this._connectionManagementService.showConnectionDialog();
			return;
		}
		let connectedContext: azdata.ConnectedContext = undefined;
		if (profile) {
			try {
				await this._connectionManagementService.connectIfNotConnected(profile, 'connection', true);
				// Before sending to extensions, we should a) serialize to IConnectionProfile or things will fail,
				// and b) use the latest version of the profile from the service so most fields are filled in.
				let updatedProfile = this._connectionManagementService.getConnectionProfileById(profile.id);
				connectedContext = { connectionProfile: new ConnectionProfile(this._capabilitiesService, updatedProfile).toIConnectionProfile() };
			} catch (err) {
				warn('Failed to connect due to error' + err.message);
			}
		}
		if (commandName) {
			await this._commandService.executeCommand(commandName, connectedContext);
		} else if (profile) {
			// Default to showing new query
			try {
				await TaskUtilities.newQuery(profile,
					this._connectionManagementService,
					this._queryEditorService,
					this._objectExplorerService,
					this._editorService);
			} catch (error) {
				warn('unable to open query editor ' + error);
				// Note: we are intentionally swallowing this error.
				// In part this is to accommodate unit testing where we don't want to set up the query stack
			}
		}
	}

	private readProfileFromArgs(args: ParsedArgs) {
		let profile = new ConnectionProfile(this._capabilitiesService, null);
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
		return profile;
	}
}
