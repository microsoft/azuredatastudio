/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/sqlConnection';

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { IConnectionComponentCallbacks } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as Constants from 'sql/platform/connection/common/constants';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import * as styler from 'sql/platform/theme/common/styler';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

import * as azdata from 'azdata';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ConnectionWidget, AuthenticationType } from 'sql/workbench/services/connection/browser/connectionWidget';

/**
 * Connection Widget clas for CMS Connections
 */
export class CmsConnectionWidget extends ConnectionWidget {

	private _serverDescriptionInputBox: InputBox;
	protected _authTypeMap: { [providerName: string]: AuthenticationType[] } = {
		[Constants.cmsProviderName]: [AuthenticationType.SqlLogin, AuthenticationType.Integrated]
	};

	constructor(options: azdata.ConnectionOption[],
		callbacks: IConnectionComponentCallbacks,
		providerName: string,
		@IThemeService _themeService: IThemeService,
		@IContextViewService _contextViewService: IContextViewService,
		@ILayoutService _layoutService: ILayoutService,
		@IConnectionManagementService _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService _capabilitiesService: ICapabilitiesService,
		@IClipboardService _clipboardService: IClipboardService,
		@IConfigurationService _configurationService: IConfigurationService,
		@IAccountManagementService _accountManagementService: IAccountManagementService
	) {
		super(options, callbacks, providerName, _themeService, _contextViewService, _connectionManagementService, _capabilitiesService,
			_clipboardService, _configurationService, _accountManagementService);
		let authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		if (authTypeOption) {
			if (OS === OperatingSystem.Windows) {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(AuthenticationType.Integrated);
			} else {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(AuthenticationType.SqlLogin);
			}
			this._authTypeSelectBox = new SelectBox(authTypeOption.categoryValues.map(c => c.displayName), authTypeOption.defaultValue, this._contextViewService, undefined, { ariaLabel: authTypeOption.displayName });
		}
	}

	protected registerListeners(): void {
		super.registerListeners();
		if (this._serverDescriptionInputBox) {
			this._register(styler.attachInputBoxStyler(this._serverDescriptionInputBox, this._themeService));
		}
	}

	protected fillInConnectionForm(authTypeChanged: boolean = false): void {
		// Server Name
		this.addServerNameOption();

		// Authentication type
		this.addAuthenticationTypeOption(authTypeChanged);

		// Login Options
		this.addLoginOptions();

		// Connection Name
		this.addConnectionNameOptions();

		// Server Description
		this.addServerDescriptionOption();

		// Advanced Options
		this.addAdvancedOptions();
	}

	protected addAuthenticationTypeOption(authTypeChanged: boolean = false): void {
		super.addAuthenticationTypeOption(authTypeChanged);
		let authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		let newAuthTypes = authTypeOption.categoryValues;

		// True when opening a CMS dialog to add a registered server
		if (authTypeChanged) {
			// Registered Servers only support Integrated Auth
			newAuthTypes = authTypeOption.categoryValues.filter((option) => option.name === AuthenticationType.Integrated);
			this._authTypeSelectBox.setOptions(newAuthTypes.map(c => c.displayName));
			authTypeOption.defaultValue = AuthenticationType.Integrated;
		} else {
			// CMS supports all auth types
			newAuthTypes = authTypeOption.categoryValues;
			this._authTypeSelectBox.setOptions(newAuthTypes.map(c => c.displayName));
			if (OS === OperatingSystem.Windows) {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(AuthenticationType.Integrated);
			} else {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(AuthenticationType.SqlLogin);
			}
		}
		this._authTypeSelectBox.selectWithOptionName(authTypeOption.defaultValue);
	}

	private addServerDescriptionOption(): void {
		// Registered Server Description
		let serverDescriptionOption = this._optionsMaps['serverDescription'];
		if (serverDescriptionOption) {
			serverDescriptionOption.displayName = localize('serverDescription', "Server Description (optional)");
			let serverDescriptionBuilder = DialogHelper.appendRow(this._tableContainer, serverDescriptionOption.displayName, 'connection-label', 'connection-input', 'server-description-input');
			this._serverDescriptionInputBox = new InputBox(serverDescriptionBuilder, this._contextViewService, { type: 'textarea', flexibleHeight: true });
			this._serverDescriptionInputBox.setHeight('75px');
		}
	}

	public createConnectionWidget(container: HTMLElement, authTypeChanged: boolean = false): void {
		this._container = DOM.append(container, DOM.$('div.connection-table'));
		this._tableContainer = DOM.append(this._container, DOM.$('table.connection-table-content'));
		this.fillInConnectionForm(authTypeChanged);
		this.registerListeners();
		if (this._authTypeSelectBox) {
			this.onAuthTypeSelected(this._authTypeSelectBox.value);
		}

		DOM.addDisposableListener(container, 'paste', e => {
			this._handleClipboard();
		});
	}

	public handleOnConnecting(): void {
		super.handleOnConnecting();
		if (this._serverDescriptionInputBox) {
			this._serverDescriptionInputBox.disable();
		}
	}

	public handleResetConnection(): void {
		super.handleResetConnection();
		if (this._serverDescriptionInputBox) {
			this._serverDescriptionInputBox.enable();
		}
	}

	public get registeredServerDescription(): string {
		return this._serverDescriptionInputBox.value;
	}

	public connect(model: IConnectionProfile): boolean {
		let validInputs = super.connect(model);
		if (this._serverDescriptionInputBox) {
			model.options.registeredServerDescription = this._serverDescriptionInputBox.value;
			model.options.registeredServerName = this._connectionNameInputBox.value;
		}
		return validInputs;
	}

	public fillInConnectionInputs(connectionInfo: IConnectionProfile) {
		super.fillInConnectionInputs(connectionInfo);
		if (connectionInfo) {
			let description = connectionInfo.options.registeredServerDescription ? connectionInfo.options.registeredServerDescription : '';
			this._serverDescriptionInputBox.value = description;
		}
	}
}
