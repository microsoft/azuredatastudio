/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

export class ChangePasswordController {
	private _passwordDialog: OptionsDialog;
	private _options: { [name: string]: any };

	constructor(private _onCloseChangePasswordProperties: () => void,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
	}


	private handleOnOk(): void {
		this._options = this._passwordDialog.optionValues;
	}

	public showDialog(providerOptions: azdata.ConnectionOption[], options: { [name: string]: any }): void {
		this._options = options;
		let serviceOptions = providerOptions.map(option => ChangePasswordController.connectionOptionToServiceOption(option));
		this.advancedDialog.open(serviceOptions, this._options);
	}

	public get advancedDialog() {
		if (!this._passwordDialog) {
			this._passwordDialog = this._instantiationService.createInstance(
				OptionsDialog, localize('passwordChangeProperties', "Change password to continue login."), TelemetryKeys.ModalDialogName.PasswordChangeProperties, { hasBackButton: false, cancelLabel: localize('changePasswordProperties.Cancel', "Cancel") });
			this._passwordDialog.onCloseEvent(() => this._onCloseChangePasswordProperties());
			this._passwordDialog.onOk(() => this.handleOnOk());
			this._passwordDialog.render();
		}
		return this._passwordDialog;
	}

	public set advancedDialog(dialog: OptionsDialog) {
		this._passwordDialog = dialog;
	}

	public static connectionOptionToServiceOption(connectionOption: azdata.ConnectionOption): azdata.ServiceOption {
		return {
			name: connectionOption.name,
			displayName: connectionOption.displayName,
			description: connectionOption.description,
			groupName: connectionOption.groupName,
			valueType: connectionOption.valueType,
			defaultValue: connectionOption.defaultValue,
			objectType: undefined,
			categoryValues: connectionOption.categoryValues,
			isRequired: connectionOption.isRequired,
			isArray: undefined,
		};
	}
}
