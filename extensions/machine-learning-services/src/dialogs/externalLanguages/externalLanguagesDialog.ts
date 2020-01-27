/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import { CurrentLanguagesTab } from './currentLanguagesTab';
import { AddNewLanguageTab } from './addNewLanguageTab';
import { ExternalLanguagesDialogModel } from './externalLanguagesDialogModel';
import { ExternalLanguageDialogBase } from './externalLanguageDialogBase';

const localize = nls.loadMessageBundle();

export class ExternalLanguagesDialog extends ExternalLanguageDialogBase {

	private _currentLanguagesTab: CurrentLanguagesTab | undefined;
	private _addNewLanguageTab: AddNewLanguageTab | undefined;

	constructor(
		model: ExternalLanguagesDialogModel) {
		super(model);
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(localize('externalLanguage.dialogName', "External Languages"));

		this._currentLanguagesTab = new CurrentLanguagesTab(this);
		this._addNewLanguageTab = new AddNewLanguageTab(this);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = localize('managePackages.cancelButtonText', "Close");

		this.dialog.content = [this._currentLanguagesTab.tab, this._addNewLanguageTab.tab];

		this.dialog.registerCloseValidator(() => {
			return false; // Blocks Enter key from closing dialog.
		});

		azdata.window.openDialog(this.dialog);
	}

	/**
	 * Resets the tabs for given provider Id
	 */
	public async resetPages(): Promise<void> {
	}


}
