/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { NotebookWizardPageInfo } from '../../interfaces';
import { initializeWizardPage, InputComponentInfo, setModelValues } from '../modelViewUtils';
import { getDialogMessage, Validator } from '../validation/validations';
import { WizardPageBase } from '../wizardPageBase';
import { WizardPageInfo } from '../wizardPageInfo';
import { NotebookWizard } from './notebookWizard';

export class NotebookWizardPage extends WizardPageBase<NotebookWizard> {

	protected get pageInfo(): NotebookWizardPageInfo {
		return this.wizard.wizardInfo.pages[this._pageIndex];
	}

	constructor(
		wizard: NotebookWizard,
		protected _pageIndex: number,
		title?: string,
		description?: string
	) {
		super(
			wizard.wizardInfo.pages[_pageIndex].title || title || '',
			wizard.wizardInfo.pages[_pageIndex].description || description || '',
			wizard
		);
	}

	/**
	 * If the return value is true then done button should be visible to the user
	 */
	private get isDoneButtonVisible(): boolean {
		return !!this.wizard.wizardInfo.doneAction;
	}

	/**
	 * If the return value is true then generateScript button should be visible to the user
	 */
	private get isGenerateScriptButtonVisible(): boolean {
		return !!this.wizard.wizardInfo.scriptAction;
	}

	public initialize(): void {
		initializeWizardPage({
			container: this.wizard.wizardObject,
			inputComponents: this.wizard.inputComponents,
			wizardInfo: this.wizard.wizardInfo,
			pageInfo: this.pageInfo,
			page: this.pageObject,
			onNewDisposableCreated: (disposable: vscode.Disposable): void => {
				this.wizard.registerDisposable(disposable);
			},
			onNewInputComponentCreated: (
				name: string,
				inputComponentInfo: InputComponentInfo
			): void => {
				if (name) {
					this.wizard.inputComponents[name] = inputComponentInfo;
				}
			},
			onNewValidatorCreated: (validator: Validator): void => {
				this.validators.push(validator);
			},
			toolsService: this.wizard.toolsService
		});
	}

	public async onLeave(): Promise<void> {
		// The following callback registration clears previous navigation validators.
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public async onEnter(pageInfo: WizardPageInfo): Promise<void> {
		if (pageInfo.isLastPage) {
			// on the last page either one or both of done button and generateScript button are visible depending on configuration of 'runNotebook' in wizard info
			this.wizard.wizardObject.doneButton.hidden = !this.isDoneButtonVisible;
			this.wizard.wizardObject.generateScriptButton.hidden = !this.isGenerateScriptButtonVisible;
		} else {
			//on any page but the last page doneButton and generateScriptButton are hidden
			this.wizard.wizardObject.doneButton.hidden = true;
			this.wizard.wizardObject.generateScriptButton.hidden = true;
		}

		if (this.pageInfo.isSummaryPage) {
			await setModelValues(this.wizard.inputComponents, this.wizard.model);
		}

		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const messages: string[] = [];

				await Promise.all(this.validators.map(async (validator) => {
					const result = await validator();
					if (!result.valid) {
						messages.push(result.message!);
					}
				}));

				if (messages.length > 0) {
					this.wizard.wizardObject.message = getDialogMessage(messages);
				}
				return messages.length === 0;
			}
			return true;
		});
	}
}

