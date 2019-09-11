/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as querystring from 'querystring';
import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IEnvironmentService, ParsedArgs } from 'vs/platform/environment/common/environment';
import * as Constants from 'sql/platform/connection/common/constants';
import * as platform from 'vs/platform/registry/common/platform';
import { IConnectionProviderRegistry, Extensions as ConnectionProviderExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ipcRenderer as ipc } from 'electron';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { localize } from 'vs/nls';
import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';
import { URI } from 'vs/base/common/uri';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { openNewQuery } from 'sql/workbench/parts/query/browser/queryActions';
import { IURLService, IURLHandler } from 'vs/platform/url/common/url';
import { getErrorMessage } from 'vs/base/common/errors';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';

const connectAuthority = 'connect';

interface SqlArgs {
	_?: string[];
	aad?: boolean;
	database?: string;
	integrated?: boolean;
	server?: string;
	user?: string;
	command?: string;
	provider?: string;
}

export class CommandLineWorkbenchContribution implements IWorkbenchContribution, IURLHandler {

	constructor(
		@ICapabilitiesService private readonly _capabilitiesService: ICapabilitiesService,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@IEditorService private readonly _editorService: IEditorService,
		@ICommandService private readonly _commandService: ICommandService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IURLService urlService: IURLService,
		@IDialogService private readonly dialogService: IDialogService
	) {
		if (ipc) {
			ipc.on('ads:processCommandLine', (event: any, args: ParsedArgs) => this.onLaunched(args));
		}
		// we only get the ipc from main during window reuse
		if (environmentService) {
			this.onLaunched(environmentService.args);
		}
		if (urlService) {
			urlService.registerHandler(this);
		}
	}

	private onLaunched(args: ParsedArgs) {
		const registry = platform.Registry.as<IConnectionProviderRegistry>(ConnectionProviderExtensions.ConnectionProviderContributions);
		let sqlProvider = registry.getProperties(Constants.mssqlProviderName);
		// We can't connect to object explorer until the MSSQL connection provider is registered
		if (sqlProvider) {
			this.processCommandLine(args).catch(reason => { this.logService.warn('processCommandLine failed: ' + reason); });
		} else {
			registry.onNewProvider(e => {
				if (e.id === Constants.mssqlProviderName) {
					this.processCommandLine(args).catch(reason => { this.logService.warn('processCommandLine failed: ' + reason); });
				}
			});
		}
	}

	// We base our logic on the combination of (server, command) values.
	// (serverName, commandName) => Connect object explorer and execute the command, passing the connection profile to the command. Do not load query editor.
	// (null, commandName) => Launch the command with a null connection. If the command implementation needs a connection, it will need to create it.
	// (serverName, null) => Connect object explorer and open a new query editor if no file names are passed. If file names are passed, connect their editors to the server.
	// (null, null) => Prompt for a connection unless there are registered servers
	public async processCommandLine(args: SqlArgs): Promise<void> {
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
			if (this._notificationService) {
				this._notificationService.status(localize('connectingLabel', "Connecting: {0}", profile.serverName), { hideAfter: 2500 });
			}
			try {
				await this._connectionManagementService.connectIfNotConnected(profile, 'connection', true);
				// Before sending to extensions, we should a) serialize to IConnectionProfile or things will fail,
				// and b) use the latest version of the profile from the service so most fields are filled in.
				let updatedProfile = this._connectionManagementService.getConnectionProfileById(profile.id);
				connectedContext = { connectionProfile: new ConnectionProfile(this._capabilitiesService, updatedProfile).toIConnectionProfile() };
			} catch (err) {
				this.logService.warn('Failed to connect due to error' + getErrorMessage(err));
			}
		}
		if (commandName) {
			if (this._notificationService) {
				this._notificationService.status(localize('runningCommandLabel', "Running command: {0}", commandName), { hideAfter: 2500 });
			}
			await this._commandService.executeCommand(commandName, connectedContext);
		} else if (profile) {
			// If we were given a file and it was opened with the sql editor,
			// we want to connect the given profile to to it.
			// If more than one file was passed, only show the connection dialog error on one of them.
			if (args._ && args._.length > 0) {
				await args._.forEach((f, i) => this.processFile(URI.file(f).toString(), profile, i === 0));
			}
			else {
				// Default to showing new query
				if (this._notificationService) {
					this._notificationService.status(localize('openingNewQueryLabel', "Opening new query: {0}", profile.serverName), { hideAfter: 2500 });
				}
				try {
					await this.instantiationService.invokeFunction(openNewQuery, profile);
				} catch (error) {
					this.logService.warn('unable to open query editor ' + error);
					// Note: we are intentionally swallowing this error.
					// In part this is to accommodate unit testing where we don't want to set up the query stack
				}
			}
		}
	}

	public async handleURL(uri: URI): Promise<boolean> {
		// Catch file URLs
		let authority = uri.authority.toLowerCase();
		if (authority === connectAuthority) {
			try {
				let args = this.parseProtocolArgs(uri);
				if (!args.server) {
					this._notificationService.warn(localize('warnServerRequired', "Cannot connect as no server information was provided"));
					return true;
				}
				let isOpenOk = await this.confirmConnect(args);
				if (isOpenOk) {
					await this.processCommandLine(args);
				}
			} catch (err) {
				this._notificationService.error(localize('errConnectUrl', "Could not open URL due to error {0}", getErrorMessage(err)));
			}
			// Handled either way
			return true;
		}

		return false;
	}

	private async confirmConnect(args: SqlArgs): Promise<boolean> {
		let detail = args && args.server ? localize('connectServerDetail', "This will connect to server {0}", args.server) : '';
		const result = await this.dialogService.confirm({
			message: localize('confirmConnect', "Are you sure you want to connect?"),
			detail: detail,
			primaryButton: localize('open', "&&Open"),
			type: 'question'
		});

		if (result.confirmed) {
			return true;
		}
		return false;
	}

	private parseProtocolArgs(uri: URI): SqlArgs {
		let args: SqlArgs = querystring.parse(uri.query);
		// Clear out command, not supporting arbitrary command via this path
		args.command = undefined;
		return args;
	}

	// If an open and connectable query editor exists for the given URI, attach it to the connection profile
	private async processFile(uriString: string, profile: IConnectionProfile, warnOnConnectFailure: boolean): Promise<void> {
		let activeEditor = this._editorService.editors.filter(v => v.getResource().toString() === uriString).pop();
		if (activeEditor) {
			let queryInput = activeEditor as QueryInput;
			if (queryInput && queryInput.state.connected) {
				let options: IConnectionCompletionOptions = {
					params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: queryInput },
					saveTheConnection: false,
					showDashboard: false,
					showConnectionDialogOnError: warnOnConnectFailure,
					showFirewallRuleOnError: warnOnConnectFailure
				};
				if (this._notificationService) {
					this._notificationService.status(localize('connectingQueryLabel', "Connecting query file"), { hideAfter: 2500 });
				}
				await this._connectionManagementService.connect(profile, uriString, options);
			}
		}
	}

	private readProfileFromArgs(args: SqlArgs) {
		let profile = new ConnectionProfile(this._capabilitiesService, null);
		// We want connection store to use any matching password it finds
		profile.savePassword = true;
		profile.providerName = args.provider ? args.provider : Constants.mssqlProviderName;
		profile.serverName = args.server;
		profile.databaseName = args.database ? args.database : '';
		profile.userName = args.user ? args.user : '';
		profile.authenticationType = args.integrated ? Constants.integrated : args.aad ? Constants.azureMFA : (profile.userName.length > 0) ? Constants.sqlLogin : Constants.integrated;
		profile.connectionName = '';
		profile.setOptionValue('applicationName', Constants.applicationName);
		profile.setOptionValue('databaseDisplayName', profile.databaseName);
		profile.setOptionValue('groupId', profile.groupId);
		return this._connectionManagementService ? this.tryMatchSavedProfile(profile) : profile;
	}

	private tryMatchSavedProfile(profile: ConnectionProfile) {
		let match: ConnectionProfile = undefined;
		// If we can find a saved mssql provider connection that matches the args, use it
		let groups = this._connectionManagementService.getConnectionGroups([Constants.mssqlProviderName]);
		if (groups && groups.length > 0) {
			let rootGroup = groups[0];
			let connections = ConnectionProfileGroup.getConnectionsInGroup(rootGroup);
			match = connections.find((c) => this.matchProfile(profile, c));
		}
		return match ? match : profile;
	}

	// determines if the 2 profiles are a functional match
	// profile1 is the profile generated from command line parameters
	private matchProfile(profile1: ConnectionProfile, profile2: ConnectionProfile): boolean {
		return equalsIgnoreCase(profile1.serverName, profile2.serverName)
			&& equalsIgnoreCase(profile1.providerName, profile2.providerName)
			// case sensitive servers can have 2 databases whose name differs only in case
			&& profile1.databaseName === profile2.databaseName
			&& equalsIgnoreCase(profile1.userName, profile2.userName)
			&& profile1.authenticationType === profile2.authenticationType;
	}
}
