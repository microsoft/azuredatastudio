/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as querystring from 'querystring';
import * as azdata from 'azdata';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
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
import { IEnvironmentService, INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';

//#region decorators
enum Command {
	connect = 'connect',
	openConnectionDialog = 'openConnectionDialog'
}

type PathHandler = (args: NativeParsedArgs) => Promise<boolean>;
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
			ipc.on('ads:processCommandLine', (event: any, args: NativeParsedArgs) => this.onLaunched(args));
		}
		// we only get the ipc from main during window reuse
		if (environmentService) {
			this.onLaunched(environmentService.args);
		}
		if (urlService) {
			urlService.registerHandler(this);
		}
	}

	private onLaunched(args: NativeParsedArgs) {
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
	public async processCommandLine(args: NativeParsedArgs): Promise<void> {
		let profile: IConnectionProfile = undefined;
		let commandName = undefined;

		if (args) {
			if (this._commandService) {
				commandName = args.command;
			}
			if (args.server) {
				profile = await this.readProfileFromArgs(args);
			}
		}
		let showConnectDialogOnStartup: boolean = this._configurationService.getValue('workbench.showConnectDialogOnStartup');
		if (showConnectDialogOnStartup && !commandName && !profile && !this._connectionManagementService.hasRegisteredServers()) {
			// prompt the user for a new connection on startup if no profiles are registered
			await this._connectionManagementService.showConnectionDialog(undefined, {
				showDashboard: true,
				saveTheConnection: true,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			});
			return;
		}
		let connectedContext: azdata.ConnectedContext = undefined;
		// Need not connect when opening connection dialog explicitly.
		if (profile && commandName !== Command.openConnectionDialog) {
			if (this._notificationService) {
				this._notificationService.status(localize('connectingLabel', "Connecting: {0}", profile.serverName), { hideAfter: 2500 });
			}
			try {
				await this._connectionManagementService.connectIfNotConnected(profile, args.showDashboard ? 'dashboard' : 'connection', true);
				// Before sending to extensions, we should a) serialize to IConnectionProfile or things will fail,
				// and b) use the latest version of the profile from the service so most fields are filled in.
				let updatedProfile = this._connectionManagementService.getConnectionProfileById(profile.id);
				connectedContext = { connectionProfile: new ConnectionProfile(this._capabilitiesService, updatedProfile).toIConnectionProfile() };
			} catch (err) {
				this.logService.warn('Failed to connect due to error: ' + getErrorMessage(err));
			}
		}

		if (commandName) {
			if (this._notificationService) {
				this._notificationService.status(localize('runningCommandLabel', "Running command: {0}", commandName), { hideAfter: 2500 });
			}
			if (commandName === Command.connect || commandName === Command.openConnectionDialog) {
				// Run handlers for 'connect' and 'openConnectionDialog' commands.
				await this.runCommandHandler(commandName, args);
			} else {
				// Execute other commands via commandService.
				await this._commandService.executeCommand(commandName, connectedContext);
			}
		} else if (connectedContext) {
			// If we were given a file and it was opened with the sql editor,
			// we want to connect the given profile to to it.
			// If more than one file was passed, only show the connection dialog error on one of them.
			if (args._ && args._.length > 0) {
				await Promise.all(args._.map((f, i) => this.processFile(URI.file(f).toString(), profile, i === 0)));
			}
			else if (this._capabilitiesService.getCapabilities(profile.providerName)?.connection?.isQueryProvider) {
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

	/**
	 * Handles user provided URL to initiate command handler for supported commands.
	 * @param uri User provided URL in format: azuredatastudio://{command}?{option1}={value1}&{option2}={value2}...
	 * @returns True if URL was opened successfully, false otherwise
	 * @throws Error if invalid URL handler used.
	 */
	public async handleURL(uri: URI): Promise<boolean> {
		let key = uri.authority;
		let args = this.parseProtocolArgs(uri);

		const result = await this.runCommandHandler(key, args);
		if (typeof result !== 'boolean') {
			throw new Error('Invalid URL Handler used in commandLine code.');
		}

		return result;
	}

	private async runCommandHandler(key: string, args: NativeParsedArgs) {
		let method = pathMappings[key];

		if (!method) {
			return false;
		}
		method = method.bind(this);
		return await method(args);
	}

	@pathHandler({
		path: Command.connect
	})
	public async handleConnect(args: NativeParsedArgs): Promise<boolean> {
		try {
			if (!args.server) {
				this._notificationService.warn(localize('warnServerRequired', "Cannot connect as no server information was provided"));
				return true;
			}
			let isOpenOk = await this.confirmConnect(args);
			if (isOpenOk) {
				const connectionProfile = await this.readProfileFromArgs(args);
				try {
					await this._connectionManagementService.connect(connectionProfile, undefined, {
						saveTheConnection: true,
						showDashboard: true,
						showConnectionDialogOnError: true,
						showFirewallRuleOnError: true
					});
				} catch (err) {
					this.logService.warn('Failed to connect due to error: ' + getErrorMessage(err));
				}
			}
		} catch (err) {
			this._notificationService.error(localize('errConnectUrl', "Could not open URL due to error {0}", getErrorMessage(err)));
		}
		// Handled either way
		return true;
	}

	@pathHandler({
		path: Command.openConnectionDialog
	})
	public async handleOpenConnectionDialog(args: NativeParsedArgs): Promise<boolean> {
		try {
			if (!args.server) {
				this._notificationService.warn(localize('warnServerRequired', "Cannot connect as no server information was provided"));
				return true;
			}
			let isOpenOk = await this.confirmConnect(args);
			if (!isOpenOk) {
				// returning true will ensure the request won't be looped (since urlService opens url with shouldStop = false)
				return true;
			}

			const connectionProfile = await this.readProfileFromArgs(args);
			await this._connectionManagementService.showConnectionDialog(undefined, {
				saveTheConnection: true,
				showDashboard: true,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			}, connectionProfile);
		} catch (err) {
			this._notificationService.error(localize('errConnectUrl', "Could not open URL due to error {0}", getErrorMessage(err)));
		}
		return true;
	}

	private async confirmConnect(args: NativeParsedArgs): Promise<boolean> {
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

	private parseProtocolArgs(uri: URI): NativeParsedArgs {
		let args: NativeParsedArgs = querystring.parse(uri.query);
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

	private async readProfileFromArgs(args: NativeParsedArgs): Promise<IConnectionProfile | undefined> {
		// Handle unsupported provider first thing before setting default provider.
		if (args.provider && !this._capabilitiesService.providers[args.provider]) {
			const installed = await this._connectionManagementService.handleUnsupportedProvider(args.provider);
			if (!installed) {
				// User cancelled install prompt so exit early since we won't be able to connect
				return undefined;
			}
		}

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
			5. If user exists but doesn't have @, then its SqlLogin
			6. If user doesn't exist, then integrated
		*/
		profile.authenticationType =
			args.authenticationType ? args.authenticationType :
				args.integrated ? Constants.AuthenticationType.Integrated :
					args.aad ? Constants.AuthenticationType.AzureMFA :
						(args.user && args.user.length > 0) ? args.user.includes('@') ? Constants.AuthenticationType.AzureMFA : Constants.AuthenticationType.SqlLogin :
							Constants.AuthenticationType.Integrated;

		profile.connectionName = '';
		const applicationName = args.applicationName
			? args.applicationName + '-' + Constants.applicationName
			: Constants.applicationName;
		profile.setOptionValue('applicationName', applicationName);
		profile.setOptionValue('databaseDisplayName', profile.databaseName);
		profile.setOptionValue('groupId', profile.groupId);
		// Set all advanced options
		let advancedOptions = this.getAdvancedOptions(args.connectionProperties, profile.getOptionKeyIdNames());
		advancedOptions.forEach((v, k) => {
			profile.setOptionValue(k, v);
		});
		return this._connectionManagementService ? this.tryMatchSavedProfile(profile) : profile;
	}

	private getAdvancedOptions(options: string, idNames: string[]): Map<string, string> {
		const ignoredProperties = idNames.concat(['password', 'azureAccountToken']);
		let advancedOptionsMap = new Map<string, string>();
		if (options) {
			try {
				// Decode options if they contain any encoded URL characters
				options = decodeURI(options);
				JSON.parse(options, (k, v) => {
					if (!(k in ignoredProperties)) {
						advancedOptionsMap.set(k, v);
					}
				});
			} catch (e) {
				throw new Error(localize('commandline.propertiesFormatError', 'Advanced connection properties could not be parsed as JSON, error occurred: {0} Received properties value: {1}', e, options));
			}
		}
		return advancedOptionsMap;
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
