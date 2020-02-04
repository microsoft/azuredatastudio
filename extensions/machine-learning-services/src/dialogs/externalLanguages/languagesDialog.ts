/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CurrentLanguagesTab } from './currentLanguagesTab';
import { AddEditLanguageTab } from './addEditLanguageTab';
import { LanguageViewBase } from './languageViewBase';
import * as constants from '../../common/constants';
import { ApiWrapper } from '../../common/apiWrapper';

export class LanguagesDialog extends LanguageViewBase {

	public currentLanguagesTab: CurrentLanguagesTab | undefined;
	public addNewLanguageTab: AddEditLanguageTab | undefined;

	constructor(
		apiWrapper: ApiWrapper,
		root: string) {
		super(apiWrapper, root);
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		this.dialog = this._apiWrapper.createModelViewDialog(constants.extLangDialogTitle);

		this.currentLanguagesTab = new CurrentLanguagesTab(this._apiWrapper, this);

		let languageUpdateModel = {
			language: this.createNewLanguage(),
			content: this.createNewContent(),
			newLang: true
		};
		this.addNewLanguageTab = new AddEditLanguageTab(this._apiWrapper, this, languageUpdateModel);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = constants.extLangDoneButtonText;
		this.dialog.content = [this.currentLanguagesTab.tab, this.addNewLanguageTab.tab];

		this.dialog.registerCloseValidator(() => {
			return false; // Blocks Enter key from closing dialog.
		});

		this._apiWrapper.openDialog(this.dialog);
	}

	/**
	 * Resets the tabs for given provider Id
	 */
	public async reset(): Promise<void> {
		await this.currentLanguagesTab?.reset();
		await this.addNewLanguageTab?.reset();
	}
}
