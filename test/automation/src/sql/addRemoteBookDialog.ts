/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';

const ADD_REMOTE_BOOK_DIALOG_TITLE = 'New Jupyter Book (Preview)';

const LOCATION_SELECT_SELECTOR = '.modal .modal-body select[aria-label="Location"]';
const REPO_URL_INPUT_SELECTOR = '.modal .modal-body input[aria-label="Repository URL"]';
const SEARCH_BUTTON_SELECTOR = '.modal .modal-body a[aria-label="Search"]:not(.disabled)';
const RELEASES_SELECT_SELECTOR = '.modal .modal-body select[aria-label="Releases2"]';
const JUPYTER_BOOK_SELECT_SELECTOR = '.modal .modal-body select[aria-label="Jupyter Book"]';
const VERSION_SELECT_SELECTOR = '.modal .modal-body select[aria-label="Version"]';
const LANGUAGE_SELECT_SELECTOR = '.modal .modal-body select[aria-label="Language"]';
const ADD_BUTTON_SELECTOR = '.modal .modal-footer a[aria-label="Add"]:not(.disabled)';

export class AddRemoteBookDialog extends Dialog {

	constructor(code: Code) {
		super(ADD_REMOTE_BOOK_DIALOG_TITLE, code);
	}

	async waitForDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	public async setLocation(location: string): Promise<void> {
		await this.code.waitForSetValue(LOCATION_SELECT_SELECTOR, location);
	}

	public async setRepoUrl(repoUrl: string): Promise<void> {
		await this.code.waitForSetValue(REPO_URL_INPUT_SELECTOR, repoUrl);
	}

	public async search(): Promise<void> {
		await this.code.waitAndClick(SEARCH_BUTTON_SELECTOR);
		// TODO - wait for selects
	}

	public async setRelease(release: string): Promise<void> {
		const releases = await this.code.waitForElements(RELEASES_SELECT_SELECTOR, true);
		this.code.logger.log(`RELEASES ${releases.length}`);
		await this.code.waitForSetValue(RELEASES_SELECT_SELECTOR, release);
		await this.code.dispatchKeybinding('enter');
	}

	public async setJupyterBook(jupyterBook: string): Promise<void> {
		await this.code.waitForSetValue(JUPYTER_BOOK_SELECT_SELECTOR, jupyterBook);
	}

	public async setVersion(version: string): Promise<void> {
		await this.code.waitForSetValue(VERSION_SELECT_SELECTOR, version);
	}

	public async setLanguage(language: string): Promise<void> {
		await this.code.waitForSetValue(LANGUAGE_SELECT_SELECTOR, language);
	}

	async add(): Promise<void> {
		await this.code.waitAndClick(ADD_BUTTON_SELECTOR);

		await this.waitForDialogGone();
	}
}
