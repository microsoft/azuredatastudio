/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { NotebookWizardPageInfo } from '../../interfaces';
import { initializeWizardPage, InputComponents, InputComponent, setModelValues, Validator } from '../modelViewUtils';
import { WizardPageBase } from '../wizardPageBase';
import { NotebookWizard } from './notebookWizard';

const localize = nls.loadMessageBundle();

export class NotebookWizardPage extends WizardPageBase<NotebookWizard> {
	private inputComponents: InputComponents = {};

	protected get pageInfo(): NotebookWizardPageInfo {
		return this.wizard.wizardInfo.pages[this._pageIndex];
	}

	constructor(wizard: NotebookWizard, private _pageIndex: number) {
		super(wizard.wizardInfo.pages[_pageIndex].title, wizard.wizardInfo.pages[_pageIndex].description || '', wizard);
	}

	public initialize(): void {
		const self = this;
		initializeWizardPage({
			container: this.wizard.wizardObject,
			wizardInfo: this.wizard.wizardInfo,
			pageInfo: this.pageInfo,
			page: this.pageObject,
			onNewDisposableCreated: (disposable: vscode.Disposable): void => {
				self.wizard.registerDisposable(disposable);
			},
			onNewInputComponentCreated: (name: string, component: InputComponent): void => {
				self.inputComponents[name] = { component: component };
			},
			onNewValidatorCreated: (validator: Validator): void => {
				self.validators.push(validator);
			}
		});
	}


	public onLeave() {
		setModelValues(this.inputComponents, this.wizard.model);
		// The following callback registration clears previous navigation validators.
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public onEnter() {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const messages: string[] = [];

				this.validators.forEach(validator => {
					const result = validator();
					if (!result.valid) {
						messages.push(result.message);
					}
				});

				if (messages.length > 0) {
					this.wizard.wizardObject.message = {
						text: messages.length === 1 ? messages[0] : localize('wizardPage.ValidationError', "There are some errors on this page, click 'Show Details' to view the errors."),
						description: messages.length === 1 ? undefined : messages.join(EOL),
						level: azdata.window.MessageLevel.Error
					};
				}
				return messages.length === 0;
			}
			return true;
		});
	}
}
