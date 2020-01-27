/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import { AddNewLanguageTab } from './addNewLanguageTab';
import { ExternalLanguagesDialogModel } from './externalLanguagesDialogModel';
import { ExternalLanguageDialogBase } from './externalLanguageDialogBase';
import * as mssql from '../../../../mssql/src/mssql';

const localize = nls.loadMessageBundle();

export class ExternalLanguageEditDialog extends ExternalLanguageDialogBase {
	private _dialog: azdata.window.Dialog | undefined;
	private _addNewLanguageTab: AddNewLanguageTab | undefined;

	constructor(
		model: ExternalLanguagesDialogModel, private _language?: mssql.ExternalLanguage) {
		super(model);
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		this._dialog = azdata.window.createModelViewDialog(localize('externalLanguage.dialogName', "External Languages"));

		this._addNewLanguageTab = new AddNewLanguageTab(this, this._language);

		this._dialog.okButton.hidden = true;
		this._dialog.cancelButton.label = localize('managePackages.cancelButtonText', "Close");

		this._dialog.content = [this._addNewLanguageTab.tab];

		this._dialog.registerCloseValidator(() => {
			return false; // Blocks Enter key from closing dialog.
		});

		azdata.window.openDialog(this._dialog);
	}

	/**
	 * Resets the tabs for given provider Id
	 */
	public async resetPages(): Promise<void> {

	}
}
