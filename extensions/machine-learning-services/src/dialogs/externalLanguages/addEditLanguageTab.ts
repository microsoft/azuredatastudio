/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import { LanguageViewBase } from './languageViewBase';
import { LanguageContentView } from './languageContentView';
import { LanguagesDialogModel, LanguageUpdateModel } from './languagesDialogModel';

export class AddEditLanguageTab extends LanguageViewBase {
	private _dialogTab: azdata.window.DialogTab;
	private _languageName: azdata.TextComponent | undefined;
	private _editMode: boolean = false;
	private _saveButton: azdata.ButtonComponent | undefined;
	private _languageView: LanguageContentView | undefined;

	constructor(parent: LanguageViewBase, model: LanguagesDialogModel, private _languageUpdateModel: LanguageUpdateModel) {
		super(model, parent);
		this._editMode = !this._languageUpdateModel.newLang;
		let language = this._languageUpdateModel.language;
		let content = this._languageUpdateModel.content;

		this._dialogTab = azdata.window.createTab(constants.extLangNewLanguageTabTitle);
		this._dialogTab.registerContent(async view => {

			this._languageName = view.modelBuilder.inputBox().withProperties({
				value: language.name,
				width: '150px'
			}).withValidation(component => component.value !== '').component();
			this._languageName.enabled = !this._editMode;

			let formBuilder = view.modelBuilder.formContainer();
			formBuilder.addFormItem({
				component: this._languageName,
				title: constants.extLangLanguageName,
				required: true
			});

			this._languageView = new LanguageContentView(this, this._model, view.modelBuilder, formBuilder, content);

			if (!this._editMode) {
				this._saveButton = view.modelBuilder.button().withProperties({
					label: constants.extLangInstallButtonText,
					width: '100px'
				}).component();
				this._saveButton.onDidClick(async () => {
					try {
						await this.updateLanguage(this.updatedData);
					} catch (err) {
						this.showErrorMessage(constants.extLangInstallFailedError, err);
					}
				});

				formBuilder.addFormItem({
					component: this._saveButton,
					title: ''
				});
			}

			await view.initializeModel(formBuilder.component());
			await this.reset();
		});
	}

	public get updatedData(): LanguageUpdateModel {
		return {
			language: {
				name: this._languageName?.value || '',
				contents: this._languageUpdateModel.language.contents
			},
			content: this._languageView?.updatedContent || this._languageUpdateModel.content,
			newLang: this._languageUpdateModel.newLang
		};
	}

	public get tab(): azdata.window.DialogTab {
		return this._dialogTab;
	}

	public async reset(): Promise<void> {
		try {
			if (this._languageName) {
				this._languageName.value = '';
			}
			this._languageView?.reset();
		} finally {
		}
	}
}
