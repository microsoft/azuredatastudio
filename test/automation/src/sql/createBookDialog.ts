/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';

const CREATE_BOOK_DIALOG_TITLE = 'New Jupyter Book (Preview)';

const NAME_INPUT_SELECTOR = '.modal .modal-body input[aria-label="Name. Please fill out this field."]';
const LOCATION_INPUT_SELECTOR = '.modal .modal-body input[aria-label="Save location"]';
const CONTENT_FOLDER_INPUT_SELECTOR = '.modal .modal-body input[aria-label="Content folder"]';
const CREATE_BUTTON_SELECTOR = '.modal .modal-footer a[aria-label="Create"]:not(.disabled)';

export class CreateBookDialog extends Dialog {

	constructor(code: Code) {
		super(CREATE_BOOK_DIALOG_TITLE, code);
	}

	async waitForDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	public async setName(name: string): Promise<void> {
		await this.code.waitForSetValue(NAME_INPUT_SELECTOR, name);
	}

	public async setLocation(location: string): Promise<void> {
		await this.code.waitForSetValue(LOCATION_INPUT_SELECTOR, location);
	}

	public async setContentFolder(contentFolder: string): Promise<void> {
		await this.code.waitForSetValue(CONTENT_FOLDER_INPUT_SELECTOR, contentFolder);
	}

	async create(): Promise<void> {
		await this.code.waitAndClick(CREATE_BUTTON_SELECTOR);

		await this.waitForDialogGone();
	}
}
