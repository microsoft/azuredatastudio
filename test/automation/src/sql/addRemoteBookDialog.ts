/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { Dialog } from './dialog';

const ADD_REMOTE_BOOK_DIALOG_TITLE = 'New Jupyter Book (Preview)';

// The option inputs for this dialog are dynamically generated based on previous selections, so in order to ensure
// that the option we want to select exists we wait on the option element to be created first and then select it.
const LOCATION_SELECT_SELECTOR = '.modal .modal-body .select-container select[aria-label="Location"]';
const LOCATION_OPTION_SELECTOR = (option: string) => `${LOCATION_SELECT_SELECTOR} option[value="${option}"]`;
const REPO_URL_INPUT_SELECTOR = '.modal .modal-body input[aria-label="Repository URL"]';
const SEARCH_BUTTON_SELECTOR = '.modal .modal-body a[aria-label="Search"]:not(.disabled)';
const RELEASES_SELECT_SELECTOR = '.modal .modal-body .select-container select[aria-label="Releases"]';
const RELEASES_OPTION_SELECTOR = (release: string) => `${RELEASES_SELECT_SELECTOR} option[value="${release}"]`;
const JUPYTER_BOOK_SELECT_SELECTOR = '.modal .modal-body .select-container select[aria-label="Jupyter Book"]';
const JUPYTER_BOOK_OPTION_SELECTOR = (jupyterBook: string) => `${JUPYTER_BOOK_SELECT_SELECTOR} option[value="${jupyterBook}"]`;
const VERSION_SELECT_SELECTOR = '.modal .modal-body .select-container select[aria-label="Version"]';
const VERSION_OPTION_SELECTOR = (version: string) => `${VERSION_SELECT_SELECTOR} option[value="${version}"]`;
const LANGUAGE_SELECT_SELECTOR = '.modal .modal-body .select-container select[aria-label="Language"]';
const LANGUAGE_OPTION_SELECTOR = (language: string) => `${LANGUAGE_SELECT_SELECTOR} option[value="${language}"]`;
const ADD_BUTTON_SELECTOR = '.modal .modal-footer a[aria-label="Add"]:not(.disabled)';

export class AddRemoteBookDialog extends Dialog {

	constructor(code: Code) {
		super(ADD_REMOTE_BOOK_DIALOG_TITLE, code);
	}

	async waitForDialog(): Promise<void> {
		await this.waitForNewDialog();
	}

	public async setLocation(location: string): Promise<void> {
		await this.code.waitForElement(LOCATION_OPTION_SELECTOR(location));
		await this.code.waitForSetValue(LOCATION_SELECT_SELECTOR, location);
	}

	public async setRepoUrl(repoUrl: string): Promise<void> {
		await this.code.waitForSetValue(REPO_URL_INPUT_SELECTOR, repoUrl);
	}

	public async search(): Promise<void> {
		await this.code.waitAndClick(SEARCH_BUTTON_SELECTOR);
	}

	public async setRelease(release: string): Promise<void> {
		await this.code.waitForElement(RELEASES_OPTION_SELECTOR(release));
		await this.code.waitForSetValue(RELEASES_SELECT_SELECTOR, release);
	}

	public async setJupyterBook(jupyterBook: string): Promise<void> {
		await this.code.waitForElement(JUPYTER_BOOK_OPTION_SELECTOR(jupyterBook));
		await this.code.waitForSetValue(JUPYTER_BOOK_SELECT_SELECTOR, jupyterBook);
	}

	public async setVersion(version: string): Promise<void> {
		await this.code.waitForElement(VERSION_OPTION_SELECTOR(version));
		await this.code.waitForSetValue(VERSION_SELECT_SELECTOR, version);
	}

	public async setLanguage(language: string): Promise<void> {
		await this.code.waitForElement(LANGUAGE_OPTION_SELECTOR(language));
		await this.code.waitForSetValue(LANGUAGE_SELECT_SELECTOR, language);
	}

	async add(): Promise<void> {
		await this.code.waitAndClick(ADD_BUTTON_SELECTOR);
		await this.waitForDialogGone();
	}
}
