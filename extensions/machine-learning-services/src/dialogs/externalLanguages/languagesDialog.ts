/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { CurrentLanguagesTab } from './currentLanguagesTab';
import { AddEditLanguageTab } from './addEditLanguageTab';
import { LanguagesDialogModel } from './languagesDialogModel';
import { LanguageDialogBase } from './languageDialogBase';
import * as constants from '../../common/constants';

export class LanguagesDialog extends LanguageDialogBase {

	private _currentLanguagesTab: CurrentLanguagesTab | undefined;
	private _addNewLanguageTab: AddEditLanguageTab | undefined;

	constructor(
		model: LanguagesDialogModel) {
		super(model);
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(constants.extLangDialogTitle);

		this._currentLanguagesTab = new CurrentLanguagesTab(this, this.model);

		let languageUpdateModel = {
			language: this.model.createNewLanguage(),
			content: this.model.createNewContent(),
			newLang: true
		};
		this._addNewLanguageTab = new AddEditLanguageTab(this, this.model, languageUpdateModel);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = constants.extLangDoneButtonText;
		this.dialog.content = [this._currentLanguagesTab.tab, this._addNewLanguageTab.tab];

		this.dialog.registerCloseValidator(() => {
			return false; // Blocks Enter key from closing dialog.
		});

		azdata.window.openDialog(this.dialog);
	}

	/**
	 * Resets the tabs for given provider Id
	 */
	public async reset(): Promise<void> {
		await this._currentLanguagesTab?.reset();
		await this._addNewLanguageTab?.reset();
	}
}
