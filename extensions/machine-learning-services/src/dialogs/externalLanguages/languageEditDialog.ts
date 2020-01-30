/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../common/constants';
import { AddEditLanguageTab } from './addEditLanguageTab';
import { LanguagesDialogModel, LanguageUpdateModel } from './languagesDialogModel';
import { LanguageViewBase } from './languageViewBase';

export class LanguageEditDialog extends LanguageViewBase {

	private _addNewLanguageTab: AddEditLanguageTab | undefined;

	constructor(
		parent: LanguageViewBase,
		model: LanguagesDialogModel,
		private _languageUpdateModel: LanguageUpdateModel) {
		super(model, parent);
	}

	/**
	 * Opens a dialog to edit a language or a content of a language
	 */
	public showDialog(): void {
		this._dialog = azdata.window.createModelViewDialog(constants.extLangDialogTitle);

		this._addNewLanguageTab = new AddEditLanguageTab(this, this._model, this._languageUpdateModel);

		this._dialog.cancelButton.label = constants.extLangCancelButtonText;
		this._dialog.okButton.label = constants.extLangSaveButtonText;
		this._dialog.okButton.onClick(async () => {

		});

		this.dialog?.registerCloseValidator(async (): Promise<boolean> => {
			if (this._addNewLanguageTab) {
				try {
					await this.updateLanguage(this._addNewLanguageTab.updatedData);
					return true;
				} catch (err) {
					this.showErrorMessage(constants.extLangUpdateFailedError, err);
					return false;
				}
			}
			return false;
		});

		this._dialog.content = [this._addNewLanguageTab.tab];
		azdata.window.openDialog(this._dialog);
	}

	/**
	 * Resets the tabs for given provider Id
	 */
	public async reset(): Promise<void> {
		await this._addNewLanguageTab?.reset();
	}
}
