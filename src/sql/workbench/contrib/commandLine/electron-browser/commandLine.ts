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
import { ParsedArgs } from 'vs/platform/environment/node/argv';
import * as Constants from 'sql/platform/connection/common/constants';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ipcRenderer as ipc } from 'electron';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { localize } from 'vs/nls';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { URI } from 'vs/base/common/uri';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { IURLService, IURLHandler } from 'vs/platform/url/common/url';
import { getErrorMessage } from 'vs/base/common/errors';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { find } from 'vs/base/common/arrays';
import { INativeEnvironmentService } from 'vs/platform/environment/node/environmentService';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';

export interface SqlArgs {
	_?: string[];
	authenticationType?: string
	database?: string;
	server?: string;
	user?: string;
	command?: string;
	provider?: string;
	aad?: boolean; // deprecated - used by SSMS - authenticationType should be used instead
	integrated?: boolean; // deprecated - used by SSMS - authenticationType should be used instead.
}

//#region decorators

type PathHandler = (uri: URI) => Promise<boolean>;

const pathMappings: { [key: string]: PathHandler } = {};

interface PathHandlerOptions {
	path: string
}

function pathHandler({ path }: PathHandlerOptions) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const method: PathHandler = descriptor.value;

		pathMappings[path] = method;
	};
}
//#endregion

export class CommandLineWorkbenchContribution implements IWorkbenchContribution, IURLHandler {

	constructor(
		@ICapabilitiesService private readonly _capabilitiesService: ICapabilitiesService,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IEnvironmentService environmentService: INativeEnvironmentService,
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
		let sqlProvider = this._capabilitiesService.getCapabilities(Constants.mssqlProviderName);
		// We can't connect to object explorer until the MSSQL connection provider is registered
		if (sqlProvider) {
			this.processCommandLine(args).catch(reason => { this.logService.warn('processCommandLine failed: ' + reason); });
		} else {
			this._capabilitiesService.onCapabilitiesRegistered(e => {
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
				await Promise.all(args._.map((f, i) => this.processFile(URI.file(f).toString(), profile, i === 0)));
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
		let key = uri.authority;

		let method = pathMappings[key];

		if (!method) {
			return false;
		}
		method = method.bind(this);
		const result = await method(uri);

		if (typeof result !== 'boolean') {
			throw new Error('Invalid URL Handler used in commandLine code.');
		}

		return result;
	}

	@pathHandler({
		path: 'connect'
	})
	public async handleConnect(uri: URI): Promise<boolean> {
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

	@pathHandler({
		path: 'openConnectionDialog'
	})
	public async handleOpenConnectionDialog(uri: URI): Promise<boolean> {
		try {
			let args = this.parseProtocolArgs(uri);
			if (!args.server) {
				this._notificationService.warn(localize('warnServerRequired', "Cannot connect as no server information was provided"));
				return true;
			}
			let isOpenOk = await this.confirmConnect(args);
			if (!isOpenOk) {
				return false;
			}

			const connectionProfile = this.readProfileFromArgs(args);
			await this._connectionManagementService.showConnectionDialog(undefined, undefined, connectionProfile);
		} catch (err) {
			this._notificationService.error(localize('errConnectUrl', "Could not open URL due to error {0}", getErrorMessage(err)));
		}
		return true;
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
		let activeEditor = this._editorService.editors.filter(v => v.resource.toString() === uriString).pop();
		if (activeEditor instanceof QueryEditorInput && activeEditor.state.connected) {
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: activeEditor },
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

	private readProfileFromArgs(args: SqlArgs) {
		let profile = new ConnectionProfile(this._capabilitiesService, null);
		// We want connection store to use any matching password it finds
		profile.savePassword = true;
		profile.providerName = args.provider ?? Constants.mssqlProviderName;
		profile.serverName = args.server;
		profile.databaseName = args.database ?? '';
		profile.userName = args.user ?? '';

		/*
			Authentication Type:
			1. Take --authenticationType, if not
			2. Take --integrated, if not
			3. take --aad, if not
			4. If user exists, and user has @, then it's azureMFA
			5. If user doesn't exist, or user doesn't have @, then integrated
		*/
		profile.authenticationType =
			args.authenticationType ? args.authenticationType :
				args.integrated ? Constants.integrated :
					args.aad ? Constants.azureMFA :
						(args.user && args.user.length > 0) ? args.user.includes('@') ? Constants.azureMFA : Constants.integrated :
							Constants.integrated;

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
			match = find(connections, (c) => this.matchProfile(profile, c));
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
