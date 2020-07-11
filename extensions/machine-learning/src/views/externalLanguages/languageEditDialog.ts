/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../../common/constants';
import { AddEditLanguageTab } from './addEditLanguageTab';
import { LanguageViewBase, LanguageUpdateModel } from './languageViewBase';
import { ApiWrapper } from '../../common/apiWrapper';

export class LanguageEditDialog extends LanguageViewBase {

	public addNewLanguageTab: AddEditLanguageTab | undefined;

	constructor(
		apiWrapper: ApiWrapper,
		parent: LanguageViewBase,
		private _languageUpdateModel: LanguageUpdateModel) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Opens a dialog to edit a language or a content of a language
	 */
	public showDialog(): void {
		this._dialog = this._apiWrapper.createModelViewDialog(constants.extLangDialogTitle);

		this.addNewLanguageTab = new AddEditLanguageTab(this._apiWrapper, this, this._languageUpdateModel);

		this._dialog.cancelButton.label = constants.extLangCancelButtonText;
		this._dialog.okButton.label = constants.extLangSaveButtonText;

		this.dialog?.registerCloseValidator(async (): Promise<boolean> => {
			return await this.onSave();
		});

		this._dialog.content = [this.addNewLanguageTab.tab];
		this._apiWrapper.openDialog(this._dialog);
	}

	public async onSave(): Promise<boolean> {
		if (this.addNewLanguageTab) {
			try {
				await this.updateLanguage(this.addNewLanguageTab.updatedData);
				return true;
			} catch (err) {
				this.showErrorMessage(constants.extLangUpdateFailedError, err);
				return false;
			}
		}
		return false;
	}
	/**
	 * Resets the tabs for given provider Id
	 */
	public async reset(): Promise<void> {
		await this.addNewLanguageTab?.reset();
	}
}
