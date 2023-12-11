/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

import * as azdata from 'azdata';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ConnectionWidget } from 'sql/workbench/services/connection/browser/connectionWidget';
import { ILogService } from 'vs/platform/log/common/log';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';
import { defaultSelectBoxStyles } from 'sql/platform/theme/browser/defaultStyles';

/**
 * Connection Widget clas for CMS Connections
 */
export class CmsConnectionWidget extends ConnectionWidget {

	private _serverDescriptionInputBox: InputBox;
	protected _authTypeMap: { [providerName: string]: Constants.AuthenticationType[] } = {
		[Constants.cmsProviderName]: [Constants.AuthenticationType.SqlLogin, Constants.AuthenticationType.Integrated]
	};

	constructor(options: azdata.ConnectionOption[],
		callbacks: IConnectionComponentCallbacks,
		providerName: string,
		@IThemeService _themeService: IThemeService,
		@IContextViewService _contextViewService: IContextViewService,
		@ILayoutService _layoutService: ILayoutService,
		@IConnectionManagementService _connectionManagementService: IConnectionManagementService,
		@IAccountManagementService _accountManagementService: IAccountManagementService,
		@ILogService _logService: ILogService,
		@IErrorMessageService _errorMessageService: IErrorMessageService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(options, callbacks, providerName, _themeService, _contextViewService, _connectionManagementService, _accountManagementService, _logService, _errorMessageService, configurationService);
		let authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		if (authTypeOption) {
			let authTypeDefault = this.getAuthTypeDefault(authTypeOption, OS);
			let authTypeDefaultDisplay = this.getAuthTypeDisplayName(authTypeDefault);
			this._authTypeSelectBox = this._register(new SelectBox(authTypeOption.categoryValues.map(c => c.displayName), authTypeDefaultDisplay, defaultSelectBoxStyles, this._contextViewService, undefined, { ariaLabel: authTypeOption.displayName }));
		}
	}

	protected override fillInConnectionForm(authTypeChanged: boolean = false): void {
		// Server Name
		this.addServerNameOption();

		// Authentication type
		this.addAuthenticationTypeOption(authTypeChanged);

		// Login Options
		this.addLoginOptions();

		// Add Custom connection options
		this.addCustomConnectionOptions();

		// Connection Name
		this.addConnectionNameOptions();

		// Server Description
		this.addServerDescriptionOption();

		// Advanced Options
		this.addAdvancedOptions();
	}

	protected override addAuthenticationTypeOption(authTypeChanged: boolean = false): void {
		super.addAuthenticationTypeOption(authTypeChanged);
		let authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		let newAuthTypes = authTypeOption.categoryValues;

		// True when opening a CMS dialog to add a registered server
		if (authTypeChanged) {
			// Registered Servers only support Integrated Auth
			newAuthTypes = authTypeOption.categoryValues.filter((option) => option.name === Constants.AuthenticationType.Integrated);
			this._authTypeSelectBox.setOptions(newAuthTypes.map(c => c.displayName));
			authTypeOption.defaultValue = Constants.AuthenticationType.Integrated;
		} else {
			// CMS supports all auth types
			newAuthTypes = authTypeOption.categoryValues;
			this._authTypeSelectBox.setOptions(newAuthTypes.map(c => c.displayName));
			if (OS === OperatingSystem.Windows) {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(Constants.AuthenticationType.Integrated);
			} else {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(Constants.AuthenticationType.SqlLogin);
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
			this._serverDescriptionInputBox = new InputBox(serverDescriptionBuilder, this._contextViewService, {
				type: 'textarea',
				flexibleHeight: true,
				inputBoxStyles: defaultInputBoxStyles
			});
			this._serverDescriptionInputBox.setHeight('75px');
		}
	}

	public override createConnectionWidget(container: HTMLElement, authTypeChanged: boolean = false): void {
		this._container = DOM.append(container, DOM.$('div.connection-table'));
		this._tableContainer = DOM.append(this._container, DOM.$('table.connection-table-content'));
		this.fillInConnectionForm(authTypeChanged);
		this.registerListeners();
		if (this._authTypeSelectBox) {
			this.onAuthTypeSelected(this._authTypeSelectBox.value, false);
		}
	}

	public override handleOnConnecting(): void {
		super.handleOnConnecting();
		if (this._serverDescriptionInputBox) {
			this._serverDescriptionInputBox.disable();
		}
	}

	public override handleResetConnection(): void {
		super.handleResetConnection();
		if (this._serverDescriptionInputBox) {
			this._serverDescriptionInputBox.enable();
		}
	}

	public get registeredServerDescription(): string {
		return this._serverDescriptionInputBox.value;
	}

	public override async connect(model: IConnectionProfile): Promise<boolean> {
		let validInputs = await super.connect(model);
		if (this._serverDescriptionInputBox) {
			model.options.registeredServerDescription = this._serverDescriptionInputBox.value;
			model.options.registeredServerName = this._connectionNameInputBox.value;
		}
		return validInputs;
	}

	public override fillInConnectionInputs(connectionInfo: IConnectionProfile) {
		super.fillInConnectionInputs(connectionInfo);
		if (connectionInfo) {
			let description = connectionInfo.options.registeredServerDescription ? connectionInfo.options.registeredServerDescription : '';
			this._serverDescriptionInputBox.value = description;
		}
	}
}
