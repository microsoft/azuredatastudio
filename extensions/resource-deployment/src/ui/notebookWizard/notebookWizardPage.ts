/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { EOL } from 'os';
import * as vscode from 'vscode';
import { InitialVariableValues, NotebookWizardPageInfo } from '../../interfaces';
import { initializeWizardPage, InputComponent, InputComponentInfo, setModelValues, Validator } from '../modelViewUtils';
import { ResourceTypePage } from '../resourceTypePage';
import { WizardPageInfo } from '../wizardPageInfo';
import { NotebookWizardModel } from './notebookWizardModel';
import * as loc from '../../localizedConstants';

export class NotebookWizardPage extends ResourceTypePage {

	protected get pageInfo(): NotebookWizardPageInfo {
		return this._model.wizardInfo.pages[this._pageIndex];
	}

	constructor(
		protected _model: NotebookWizardModel,
		protected _pageIndex: number,
		title?: string,
		description?: string
	) {
		super(
			_model.wizardInfo.pages[_pageIndex].title || title || '',
			_model.wizardInfo.pages[_pageIndex].description || description || '',
			_model.wizard
		);
	}

	/**
	 * If the return value is true then done button should be visible to the user
	 */
	private get isDoneButtonVisible(): boolean {
		return !!this._model.wizardInfo.doneAction;
	}

	/**
	 * If the return value is true then generateScript button should be visible to the user
	 */
	private get isGenerateScriptButtonVisible(): boolean {
		return !!this._model.wizardInfo.scriptAction;
	}

	public initialize(initialParamValues?: InitialVariableValues): void {
		initializeWizardPage({
			container: this.wizard.wizardObject,
			inputComponents: this._model.inputComponents,
			wizardInfo: this._model.wizardInfo,
			pageInfo: this.pageInfo,
			page: this.pageObject,
			initialVariableValues: initialParamValues,
			onNewDisposableCreated: (disposable: vscode.Disposable): void => {
				this.wizard.registerDisposable(disposable);
			},
			onNewInputComponentCreated: (
				name: string,
				inputComponentInfo: InputComponentInfo<InputComponent>
			): void => {
				if (name) {
					this._model.inputComponents[name] = inputComponentInfo;
				}
			},
			onNewValidatorCreated: (validator: Validator): void => {
				this.validators.push(validator);
			},
			toolsService: this.wizard.toolsService
		});
	}

	public override async onLeave(): Promise<void> {
		// The following callback registration clears previous navigation validators.
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public override async onEnter(pageInfo: WizardPageInfo): Promise<void> {
		if (pageInfo.isLastPage) {
			// on the last page either one or both of done button and generateScript button are visible depending on configuration of 'runNotebook' in wizard info
			this.wizard.wizardObject.doneButton.hidden = !this.isDoneButtonVisible;
			if (this._model.wizardInfo.doneAction?.label) {
				this.wizard.wizardObject.doneButton.label = this._model.wizardInfo.doneAction.label;
			}
			this.wizard.wizardObject.generateScriptButton.hidden = !this.isGenerateScriptButtonVisible;
			if (this._model.wizardInfo.scriptAction?.label) {
				this.wizard.wizardObject.generateScriptButton.label = this._model.wizardInfo.scriptAction.label;
			}
		} else {
			//on any page but the last page doneButton and generateScriptButton are hidden
			this.wizard.wizardObject.doneButton.hidden = true;
			this.wizard.wizardObject.generateScriptButton.hidden = true;
		}

		if (this.pageInfo.isSummaryPage) {
			await setModelValues(this._model.inputComponents, this.wizard.model);
		}

		/**
		 * Enabling or disabling the generate script button based on page validity.
		 * Since it is a shared button, we have to run this logic every time the user enters the page to reflect the current page status.
		 */
		this.wizard.wizardObject.generateScriptButton.enabled = this.pageObject.valid;

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };

			/**
			 * In case of the last page, when the user presses the ok Button the new page will be undefined.
			 * The first condition checks that edge case.
			 */
			if (pcInfo.newPage === undefined || pcInfo.newPage > pcInfo.lastPage) {
				return this.validatePage();
			}
			return true;
		});
	}

	public validatePage(): boolean {
		const messages: string[] = [];

		this.validators.forEach((validator) => {
			const result = validator();
			if (!result.valid) {
				messages.push(result.message);
			}
		});

		if (messages.length > 0) {
			this.wizard.wizardObject.message = {
				text: messages.length === 1
					? messages[0]
					: loc.multipleValidationErrors,
				description: messages.length === 1 ? undefined : messages.join(EOL),
				level: azdata.window.MessageLevel.Error,
			};
		}
		return messages.length === 0;
	}
}
