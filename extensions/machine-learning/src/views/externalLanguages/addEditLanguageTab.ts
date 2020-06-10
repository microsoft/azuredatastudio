/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import { LanguageViewBase, LanguageUpdateModel } from './languageViewBase';
import { LanguageContentView } from './languageContentView';
import { ApiWrapper } from '../../common/apiWrapper';

export class AddEditLanguageTab extends LanguageViewBase {
	private _dialogTab: azdata.window.DialogTab;
	public languageName: azdata.TextComponent | undefined;
	private _editMode: boolean = false;
	public saveButton: azdata.ButtonComponent | undefined;
	public languageView: LanguageContentView | undefined;

	constructor(
		apiWrapper: ApiWrapper,
		parent: LanguageViewBase,
		private _languageUpdateModel: LanguageUpdateModel) {
		super(apiWrapper, parent.root, parent);
		this._editMode = !this._languageUpdateModel.newLang;
		this._dialogTab = apiWrapper.createTab(constants.extLangNewLanguageTabTitle);
		this._dialogTab.registerContent(async view => {
			let language = this._languageUpdateModel.language;
			let content = this._languageUpdateModel.content;
			this.languageName = view.modelBuilder.inputBox().withProperties({
				value: language.name,
				width: '150px',
				enabled: !this._editMode
			}).withValidation(component => component.value !== '').component();

			let formBuilder = view.modelBuilder.formContainer();
			formBuilder.addFormItem({
				component: this.languageName,
				title: constants.extLangLanguageName,
				required: true
			});

			this.languageView = new LanguageContentView(this._apiWrapper, this, view.modelBuilder, formBuilder, content);

			if (!this._editMode) {
				this.saveButton = view.modelBuilder.button().withProperties({
					label: constants.extLangInstallButtonText,
					width: '100px'
				}).component();
				this.saveButton.onDidClick(async () => {
					try {
						await this.updateLanguage(this.updatedData);
					} catch (err) {
						this.showErrorMessage(constants.extLangInstallFailedError, err);
					}
				});

				formBuilder.addFormItem({
					component: this.saveButton,
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
				name: this.languageName?.value || '',
				contents: this._languageUpdateModel.language.contents
			},
			content: this.languageView?.updatedContent || this._languageUpdateModel.content,
			newLang: this._languageUpdateModel.newLang
		};
	}

	public get tab(): azdata.window.DialogTab {
		return this._dialogTab;
	}

	public async reset(): Promise<void> {
		if (this.languageName) {
			this.languageName.value = this._languageUpdateModel.language.name;
		}
		this.languageView?.reset();
	}
}
