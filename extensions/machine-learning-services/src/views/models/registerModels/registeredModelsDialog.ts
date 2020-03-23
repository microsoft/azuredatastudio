/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CurrentModelsPage } from './currentModelsPage';

import { ModelViewBase, RegisterModelEventName } from '../modelViewBase';
import * as constants from '../../../common/constants';
import { ApiWrapper } from '../../../common/apiWrapper';
import { DialogView } from '../../dialogView';

/**
 * Dialog to render registered model views
 */
export class RegisteredModelsDialog extends ModelViewBase {

	constructor(
		apiWrapper: ApiWrapper,
		root: string) {
		super(apiWrapper, root);
		this.dialogView = new DialogView(this._apiWrapper);
	}
	public dialogView: DialogView;
	public currentLanguagesTab: CurrentModelsPage | undefined;

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public open(): void {

		this.currentLanguagesTab = new CurrentModelsPage(this._apiWrapper, this);

		let registerModelButton = this._apiWrapper.createButton(constants.deployModelTitle);
		registerModelButton.onClick(async () => {
			await this.sendDataRequest(RegisterModelEventName);
		});

		let dialog = this.dialogView.createDialog(constants.registerModelTitle, [this.currentLanguagesTab]);
		dialog.customButtons = [registerModelButton];
		this.mainViewPanel = dialog;
		dialog.okButton.hidden = true;
		dialog.cancelButton.label = constants.extLangDoneButtonText;

		dialog.registerCloseValidator(() => {
			return false; // Blocks Enter key from closing dialog.
		});

		this._apiWrapper.openDialog(dialog);
	}

	/**
	 * Resets the tabs for given provider Id
	 */
	public async refresh(): Promise<void> {
		if (this.dialogView) {
			this.dialogView.refresh();
		}
	}
}
