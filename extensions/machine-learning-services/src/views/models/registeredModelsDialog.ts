/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CurrentModelsTab } from './currentModelsTab';

import { ModelViewBase } from './modelViewBase';
import * as constants from '../../common/constants';
import { ApiWrapper } from '../../common/apiWrapper';
import { RegisterModelTab } from './registerModelTab';

export class RegisteredModelsDialog extends ModelViewBase {

	public currentLanguagesTab: CurrentModelsTab | undefined;
	public registerModelTab: RegisterModelTab | undefined;

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

		this.currentLanguagesTab = new CurrentModelsTab(this._apiWrapper, this);
		this.registerModelTab = new RegisterModelTab(this._apiWrapper, this);

		this.dialog.okButton.hidden = true;
		this.dialog.cancelButton.label = constants.extLangDoneButtonText;
		this.dialog.content = [this.currentLanguagesTab.tab, this.registerModelTab.tab];

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
	}
}
