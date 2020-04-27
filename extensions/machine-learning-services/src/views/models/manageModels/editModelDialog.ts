/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ModelViewBase, UpdateModelEventName } from '../modelViewBase';
import * as constants from '../../../common/constants';
import { ApiWrapper } from '../../../common/apiWrapper';
import { DialogView } from '../../dialogView';
import { ModelDetailsEditPage } from './modelDetailsEditPage';
import { ImportedModel } from '../../../modelManagement/interfaces';

/**
 * Dialog to render registered model views
 */
export class EditModelDialog extends ModelViewBase {

	constructor(
		apiWrapper: ApiWrapper,
		root: string,
		private _parentView: ModelViewBase | undefined,
		private _model: ImportedModel) {
		super(apiWrapper, root);
		this.dialogView = new DialogView(this._apiWrapper);
	}
	public dialogView: DialogView;
	public editModelPage: ModelDetailsEditPage | undefined;

	/**
	 * Opens a dialog to edit models.
	 */
	public open(): void {

		this.editModelPage = new ModelDetailsEditPage(this._apiWrapper, this, this._model);

		let registerModelButton = this._apiWrapper.createButton(constants.extLangSaveButtonText);
		registerModelButton.onClick(async () => {
			if (this.editModelPage) {
				const valid = await this.editModelPage.validate();
				if (valid) {
					try {
						await this.sendDataRequest(UpdateModelEventName, this.editModelPage?.data);
						this.showInfoMessage(constants.modelUpdatedSuccessfully);
						if (this._parentView) {
							await this._parentView.refresh();
						}
					} catch (error) {
						this.showInfoMessage(`${constants.modelUpdateFailedError} ${constants.getErrorMessage(error)}`);
					}
				}
			}
		});

		let dialog = this.dialogView.createDialog(constants.editModelTitle, [this.editModelPage]);
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
