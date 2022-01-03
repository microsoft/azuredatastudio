/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	IConnectionManagementService,
	ConnectionType, INewConnectionParams, IConnectionCompletionOptions, IConnectionResult
} from 'sql/platform/connection/common/connectionManagement';
import { ConnectionDialogWidget, OnShowUIResponse } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import { ConnectionController } from 'sql/workbench/services/connection/browser/connectionController';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import * as Constants from 'sql/platform/connection/common/constants';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { Deferred } from 'sql/base/common/promise';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as platform from 'vs/base/common/platform';
import Severity from 'vs/base/common/severity';
import { Action, IAction } from 'vs/base/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import * as types from 'vs/base/common/types';
import { trim } from 'vs/base/common/strings';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { CmsConnectionController } from 'sql/workbench/services/connection/browser/cmsConnectionController';
import { entries } from 'sql/base/common/collections';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';

export interface IConnectionValidateResult {
	isValid: boolean;
	connection: IConnectionProfile;
}

export interface IConnectionComponentCallbacks {
	onSetConnectButton: (enable: boolean) => void;
	onCreateNewServerGroup?: () => void;
	onAdvancedProperties?: () => void;
	onSetAzureTimeOut?: () => void;
	onFetchDatabases?: (serverName: string, authenticationType: string, userName?: string, password?: string, token?: string) => Promise<string[]>;
	onAzureTenantSelection?: (azureTenantId?: string) => void;
}

export interface IConnectionComponentController {
	showUiComponent(container: HTMLElement, didChange?: boolean): void;
	initDialog(providers: string[], model: IConnectionProfile): void;
	validateConnection(): IConnectionValidateResult;
	fillInConnectionInputs(connectionInfo: IConnectionProfile): void;
	handleOnConnecting(): void;
	handleResetConnection(): void;
	focusOnOpen(): void;
	closeDatabaseDropdown(): void;
	databaseDropdownExpanded: boolean;
}

export class ConnectionDialogService implements IConnectionDialogService {

	_serviceBrand: undefined;

	private _connectionDialog: ConnectionDialogWidget;
	private _connectionControllerMap: { [providerName: string]: IConnectionComponentController } = {};
	private _model: ConnectionProfile;
	private _params: INewConnectionParams;
	private _options: IConnectionCompletionOptions;
	private _inputModel: IConnectionProfile;
	private _providerNameToDisplayNameMap: { [providerDisplayName: string]: string } = {};
	private _providerDisplayNames: string[] = [];
	private _currentProviderType: string = Constants.mssqlProviderName;
	private _connecting: boolean = false;
	private _connectionErrorTitle = localize('connectionError', "Connection error");
	private _dialogDeferredPromise: Deferred<IConnectionProfile>;

	/**
	 * This is used to work around the interconnectedness of this code
	 */
	private ignoreNextConnect = false;
	private _connectionManagementService: IConnectionManagementService;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IClipboardService private _clipboardService: IClipboardService,
		@ICommandService private _commandService: ICommandService,
		@ILogService private _logService: ILogService,
	) {
		this.initializeConnectionProviders();
	}

	/**
	 * Set the initial value for the connection provider and listen to the provider change event
	 */
	private initializeConnectionProviders() {
		this.setConnectionProviders();
		if (this._capabilitiesService) {
			this._capabilitiesService.onCapabilitiesRegistered(() => {
				this.setConnectionProviders();
				if (this._connectionDialog) {
					this._connectionDialog.updateConnectionProviders(this._providerDisplayNames, this._providerNameToDisplayNameMap);
				}
			});
		}
	}

	/**
	 * Update the available provider types using the values from capabilities service
	 */
	private setConnectionProviders() {
		if (this._capabilitiesService) {
			this._providerDisplayNames = [];
			this._providerNameToDisplayNameMap = {};
			entries(this._capabilitiesService.providers).forEach(p => {
				this._providerDisplayNames.push(p[1].connection.displayName);
				this._providerNameToDisplayNameMap[p[0]] = p[1].connection.displayName;
			});
		}
	}

	/**
	 * Gets the default provider with the following actions
	 * 	1. Checks if master provider(map) has data
	 * 	2. If so, filters provider parameter against master map
	 * 	3. Fetches the result array and extracts the first element
	 * 	4. If none of the above data exists, returns 'MSSQL'
	 * @returns: Default provider as string
	 */
	private getDefaultProviderName(): string {
		let defaultProvider: string;
		if (this._providerNameToDisplayNameMap) {
			let keys = Object.keys(this._providerNameToDisplayNameMap);
			let filteredKeys: string[];
			if (keys && keys.length > 0) {
				if (this._params && this._params.providers && this._params.providers.length > 0) {
					//Filter providers from master keys.
					filteredKeys = keys.filter(key => this._params.providers.some(x => x === key));
				}
				if (filteredKeys && filteredKeys.length > 0) {
					defaultProvider = filteredKeys[0];
				}
			}
		}
		if (!defaultProvider && this._configurationService) {
			defaultProvider = WorkbenchUtils.getSqlConfigValue<string>(this._configurationService, Constants.defaultEngine);
		}
		// as a fallback, default to MSSQL if the value from settings is not available
		return defaultProvider || Constants.mssqlProviderName;
	}

	private getDefaultAuthenticationTypeName(): string {
		let defaultAuthenticationType: string;
		if (!defaultAuthenticationType && this._configurationService) {
			defaultAuthenticationType = WorkbenchUtils.getSqlConfigValue<string>(this._configurationService, Constants.defaultAuthenticationType);
		}

		return defaultAuthenticationType || Constants.sqlLogin;  // as a fallback, default to sql login if the value from settings is not available

	}

	private handleOnConnect(params: INewConnectionParams, profile?: IConnectionProfile): void {
		this._logService.debug('ConnectionDialogService: onConnect event is received');
		if (!this._connecting) {
			this._logService.debug('ConnectionDialogService: Start connecting');
			this._connecting = true;
			this.handleProviderOnConnecting();
			if (!profile) {
				let result = this.uiController.validateConnection();
				if (!result.isValid) {
					this._logService.debug('ConnectionDialogService: Connection is invalid');
					this._connecting = false;
					this._connectionDialog.resetConnection();
					return;
				}
				profile = result.connection;

				if (params.oldProfileId && params.isEditConnection) {
					profile.id = params.oldProfileId;
				}

				profile.serverName = trim(profile.serverName);

				// append the port to the server name for SQL Server connections
				if (this._currentProviderType === Constants.mssqlProviderName ||
					this._currentProviderType === Constants.cmsProviderName) {
					let portPropertyName: string = 'port';
					let portOption: string = profile.options[portPropertyName];
					if (portOption && portOption.indexOf(',') === -1) {
						profile.serverName = profile.serverName + ',' + portOption;
					}
					profile.options[portPropertyName] = undefined;
					profile.providerName = Constants.mssqlProviderName;
				}

				// Disable password prompt during reconnect if connected with an empty password
				if (profile.password === '' && profile.savePassword === false) {
					profile.savePassword = true;
				}

				this.handleDefaultOnConnect(params, profile).catch(err => onUnexpectedError(err));
			} else {
				profile.serverName = trim(profile.serverName);
				this._connectionManagementService.addSavedPassword(profile).then(async (connectionWithPassword) => {
					await this.handleDefaultOnConnect(params, connectionWithPassword);
				}).catch(err => onUnexpectedError(err));
			}
		}
	}

	private handleOnCancel(params: INewConnectionParams): void {
		if (this.ignoreNextConnect) {
			this._connectionDialog.resetConnection();
			this._connectionDialog.close('cancel');
			this.ignoreNextConnect = false;
			this._dialogDeferredPromise.resolve(undefined);
			return;
		}
		if (this.uiController.databaseDropdownExpanded) {
			this.uiController.closeDatabaseDropdown();
		} else {
			if (params && params.input && params.connectionType === ConnectionType.editor) {
				this._connectionManagementService.cancelEditorConnection(params.input);
			} else {
				this._connectionManagementService.cancelConnection(this._model);
			}
			if (params && params.input && params.input.onConnectCanceled) {
				params.input.onConnectCanceled();
			}
			this._connectionDialog.resetConnection();
			this._connecting = false;
		}
		this.uiController.databaseDropdownExpanded = false;
		if (this._dialogDeferredPromise) {
			this._dialogDeferredPromise.resolve(undefined);
		}
	}

	private async handleDefaultOnConnect(params: INewConnectionParams, connection: IConnectionProfile): Promise<void> {
		if (this.ignoreNextConnect) {
			this._connectionDialog.resetConnection();
			this._connectionDialog.close('ok');
			this.ignoreNextConnect = false;
			this._connecting = false;
			this._dialogDeferredPromise.resolve(connection);
			return;
		}
		let fromEditor = params && params.connectionType === ConnectionType.editor;
		let isTemporaryConnection = params && params.connectionType === ConnectionType.temporary;
		let uri: string = undefined;
		if (fromEditor && params && params.input) {
			uri = params.input.uri;
		}
		let options: IConnectionCompletionOptions = this._options || {
			params: params,
			saveTheConnection: !isTemporaryConnection,
			showDashboard: params && params.showDashboard !== undefined ? params.showDashboard : !fromEditor && !isTemporaryConnection,
			showConnectionDialogOnError: false,
			showFirewallRuleOnError: true
		};

		try {
			const connectionResult = await this._connectionManagementService.connectAndSaveProfile(connection, uri, options, params && params.input);
			this._connecting = false;
			if (connectionResult && connectionResult.connected) {
				this._connectionDialog.close('ok');
				if (this._dialogDeferredPromise) {
					this._dialogDeferredPromise.resolve(connectionResult.connectionProfile);
				}
			} else if (connectionResult && connectionResult.errorHandled) {
				this._connectionDialog.resetConnection();
				this._logService.debug(`ConnectionDialogService: Error handled and connection reset - Error: ${connectionResult.errorMessage}`);
			} else {
				this._connectionDialog.resetConnection();
				this.showErrorDialog(Severity.Error, this._connectionErrorTitle, connectionResult.errorMessage, connectionResult.callStack);
				this._logService.debug(`ConnectionDialogService: Connection error: ${connectionResult.errorMessage}`);
			}
		} catch (err) {
			this._connecting = false;
			this._connectionDialog.resetConnection();
			this.showErrorDialog(Severity.Error, this._connectionErrorTitle, err);
			this._logService.debug(`ConnectionDialogService: Error encountered while connecting ${err}`);
		}
	}

	private get uiController(): IConnectionComponentController {
		// Find the provider name from the selected provider type, or throw an error if it does not correspond to a known provider
		let providerName = this._currentProviderType;
		if (!providerName) {
			throw Error('Invalid provider type');
		}

		// Set the model name, initialize the controller if needed, and return the controller
		this._model.providerName = providerName;
		if (!this._connectionControllerMap[providerName]) {
			if (providerName === Constants.cmsProviderName) {
				this._connectionControllerMap[providerName] =
					this._instantiationService.createInstance(CmsConnectionController,
						this._capabilitiesService.getCapabilities(providerName).connection, {
						onSetConnectButton: (enable: boolean) => this.handleSetConnectButtonEnable(enable)
					}, providerName);
			} else {
				this._connectionControllerMap[providerName] =
					this._instantiationService.createInstance(ConnectionController,
						this._capabilitiesService.getCapabilities(providerName).connection, {
						onSetConnectButton: (enable: boolean) => this.handleSetConnectButtonEnable(enable)
					}, providerName);
			}
		}
		return this._connectionControllerMap[providerName];
	}

	private handleSetConnectButtonEnable(enable: boolean): void {
		this._connectionDialog.connectButtonState = enable;
	}

	private handleShowUiComponent(input: OnShowUIResponse) {
		if (input.selectedProviderDisplayName) {
			// If the call is for specific providers
			let isProviderInParams: boolean = false;
			if (this._params && this._params.providers) {
				this._params.providers.forEach((provider) => {
					if (input.selectedProviderDisplayName === this._providerNameToDisplayNameMap[provider]) {
						isProviderInParams = true;
						this._currentProviderType = provider;
					}
				});
			}
			if (!isProviderInParams) {
				let uniqueProvidersMap = this._connectionManagementService.getUniqueConnectionProvidersByNameMap(this._providerNameToDisplayNameMap);
				this._currentProviderType = Object.keys(uniqueProvidersMap).find((key) => uniqueProvidersMap[key] === input.selectedProviderDisplayName);
			}
		}
		this._model.providerName = this._currentProviderType;
		const previousModel = this._model;
		this._model = new ConnectionProfile(this._capabilitiesService, this._model);
		if (previousModel) {
			previousModel.dispose();
		}
		if (this._inputModel && this._inputModel.options) {
			this.uiController.showUiComponent(input.container,
				this._inputModel.options.authTypeChanged);
		} else {
			this.uiController.showUiComponent(input.container);
		}

	}

	private handleInitDialog() {
		this.uiController.initDialog(this._params && this._params.providers, this._model);
	}

	private handleFillInConnectionInputs(connectionInfo: IConnectionProfile): void {
		this._connectionManagementService.addSavedPassword(connectionInfo).then(connectionWithPassword => {
			if (this._model) {
				this._model.dispose();
			}
			this._model = this.createModel(connectionWithPassword);

			this.uiController.fillInConnectionInputs(this._model);
		}).catch(err => onUnexpectedError(err));
		this._connectionDialog.updateProvider(this._providerNameToDisplayNameMap[connectionInfo.providerName]);
	}

	private handleProviderOnResetConnection(): void {
		this.uiController.handleResetConnection();
	}

	private handleProviderOnConnecting(): void {
		this.uiController.handleOnConnecting();
	}

	private updateModelServerCapabilities(model: IConnectionProfile) {
		if (this._model) {
			this._model.dispose();
		}
		this._model = this.createModel(model);
		if (this._model.providerName) {
			this._currentProviderType = this._model.providerName;
			if (this._connectionDialog) {
				this._connectionDialog.updateProvider(this._providerNameToDisplayNameMap[this._currentProviderType]);
			}
		}
	}

	private createModel(model: IConnectionProfile): ConnectionProfile {
		const defaultProvider = this.getDefaultProviderName();
		let providerName = model ? model.providerName : defaultProvider;
		providerName = providerName ? providerName : defaultProvider;
		if (model && !model.providerName) {
			model.providerName = providerName;
		}

		const defaultAuthenticationType = this.getDefaultAuthenticationTypeName();
		let authenticationTypeName = model ? model.authenticationType : defaultAuthenticationType;
		authenticationTypeName = authenticationTypeName ? authenticationTypeName : defaultAuthenticationType;
		if (model && !model.authenticationType) {
			model.authenticationType = authenticationTypeName;
		}

		let newProfile = new ConnectionProfile(this._capabilitiesService, model || providerName);
		newProfile.saveProfile = true;
		newProfile.generateNewId();
		// If connecting from a query editor set "save connection" to false
		if (this._params?.connectionType === ConnectionType.editor) {
			newProfile.saveProfile = false;
		}
		return newProfile;
	}

	private async showDialogWithModel(): Promise<void> {
		this.updateModelServerCapabilities(this._inputModel);
		await this.doShowDialog(this._params);
	}

	public openDialogAndWait(
		connectionManagementService: IConnectionManagementService,
		params?: INewConnectionParams,
		model?: IConnectionProfile,
		connectionResult?: IConnectionResult,
		doConnect: boolean = true): Promise<IConnectionProfile> {

		if (!doConnect) {
			this.ignoreNextConnect = true;
		}
		this._dialogDeferredPromise = new Deferred<IConnectionProfile>();

		this.showDialog(connectionManagementService, params,
			model,
			connectionResult).then(() => {
			}, error => {
				this._dialogDeferredPromise.reject(error);
			});
		return this._dialogDeferredPromise.promise;
	}

	public async showDialog(
		connectionManagementService: IConnectionManagementService,
		params?: INewConnectionParams,
		model?: IConnectionProfile,
		connectionResult?: IConnectionResult,
		connectionOptions?: IConnectionCompletionOptions,
	): Promise<void> {

		this._connectionManagementService = connectionManagementService;

		this._options = connectionOptions;
		this._params = params;
		this._inputModel = model;

		this.updateModelServerCapabilities(model);

		// If connecting from a query editor set "save connection" to false
		if (params && (params.input && params.connectionType === ConnectionType.editor ||
			params.connectionType === ConnectionType.temporary)) {
			this._model.saveProfile = false;
		}
		await this.showDialogWithModel();

		if (connectionResult && connectionResult.errorMessage) {
			this.showErrorDialog(Severity.Error, this._connectionErrorTitle, connectionResult.errorMessage, connectionResult.callStack);
		}
	}

	private async doShowDialog(params: INewConnectionParams): Promise<void> {
		if (!this._connectionDialog) {
			this._connectionDialog = this._instantiationService.createInstance(ConnectionDialogWidget, this._providerDisplayNames, this._providerNameToDisplayNameMap[this._model.providerName], this._providerNameToDisplayNameMap);
			this._connectionDialog.onCancel(() => {
				this._connectionDialog.databaseDropdownExpanded = this.uiController.databaseDropdownExpanded;
				this.handleOnCancel(this._connectionDialog.newConnectionParams);
			});
			this._connectionDialog.onConnect((profile) => {
				this.handleOnConnect(this._connectionDialog.newConnectionParams, profile as IConnectionProfile);
			});
			this._connectionDialog.onShowUiComponent((input) => this.handleShowUiComponent(input));
			this._connectionDialog.onInitDialog(() => this.handleInitDialog());
			this._connectionDialog.onFillinConnectionInputs((input) => this.handleFillInConnectionInputs(input as IConnectionProfile));
			this._connectionDialog.onResetConnection(() => this.handleProviderOnResetConnection());
			this._connectionDialog.render();
			this._connectionDialog.onClosed(() => {
				this._model?.dispose();
			});
		}
		this._connectionDialog.newConnectionParams = params;
		this._connectionDialog.updateProvider(this._providerNameToDisplayNameMap[this._currentProviderType]);

		const recentConnections: ConnectionProfile[] = this._connectionManagementService.getRecentConnections(params.providers);
		await this._connectionDialog.open(recentConnections.length > 0);
		this.uiController.focusOnOpen();
		recentConnections.forEach(conn => conn.dispose());
	}

	private showErrorDialog(severity: Severity, headerTitle: string, message: string, messageDetails?: string): void {
		// Kerberos errors are currently very hard to understand, so adding handling of these to solve the common scenario
		// note that ideally we would have an extensible service to handle errors by error code and provider, but for now
		// this solves the most common "hard error" that we've noticed
		const helpLink = 'https://aka.ms/sqlopskerberos';
		let actions: IAction[] = [];
		if (!platform.isWindows && types.isString(message) && message.toLowerCase().indexOf('kerberos') > -1 && message.toLowerCase().indexOf('kinit') > -1) {
			// Log the original error to console for debugging
			this._logService.error(`Kerberos connection failure. Message : ${message} Message Details : ${messageDetails}`);
			message = [
				localize('kerberosErrorStart', "Connection failed due to Kerberos error."),
				localize('kerberosHelpLink', "Help configuring Kerberos is available at {0}", helpLink),
				localize('kerberosKinit', "If you have previously connected you may need to re-run kinit.")
			].join('\r\n');
			actions.push(new Action('Kinit', 'Run kinit', null, true, async () => {
				this._connectionDialog.close();
				await this._clipboardService.writeText('kinit\r');
				await this._commandService.executeCommand('workbench.action.terminal.focus');
				// setTimeout to allow for terminal Instance to load.
				setTimeout(() => {
					return this._commandService.executeCommand('workbench.action.terminal.paste');
				}, 10);
				return;
			}));

		}
		this._logService.error(message);
		this._errorMessageService.showDialog(severity, headerTitle, message, messageDetails, actions);
	}
}
