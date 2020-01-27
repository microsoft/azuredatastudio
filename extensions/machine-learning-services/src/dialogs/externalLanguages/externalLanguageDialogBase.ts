/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExternalLanguagesDialogModel } from './externalLanguagesDialogModel';
import * as azdata from 'azdata';

export class ExternalLanguageDialogBase {
	protected dialog: azdata.window.Dialog | undefined;

	constructor(
		private _model: ExternalLanguagesDialogModel) {
	}

	/**
	 * Dialog model instance
	 */
	public get model(): ExternalLanguagesDialogModel {
		return this._model;
	}

	public showInfoMessage(message: string): void {
		this.showMessage(message, azdata.window.MessageLevel.Information);
	}

	public showErrorMessage(message: string): void {
		this.showMessage(message, azdata.window.MessageLevel.Error);
	}

	private showMessage(message: string, level: azdata.window.MessageLevel): void {
		if (this.dialog) {
			this.dialog.message = {
				text: message,
				level: level
			};
		}
	}
}
