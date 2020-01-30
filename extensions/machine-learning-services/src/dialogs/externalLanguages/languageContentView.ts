/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../../mssql/src/mssql';
import { LanguagesDialogModel } from './languagesDialogModel';
import { LanguageViewBase } from './languageViewBase';
import * as constants from '../../common/constants';

export class LanguageContentView extends LanguageViewBase {

	private _serverPath: azdata.RadioButtonComponent;
	private _localPath: azdata.RadioButtonComponent;
	private _extensionFile: azdata.TextComponent;
	private _extensionFileName: azdata.TextComponent;
	private _envVariables: azdata.TextComponent;
	private _parameters: azdata.TextComponent;
	private _isLocalPath: boolean = true;

	/**
	 *
	 */
	constructor(
		parent: LanguageViewBase,
		model: LanguagesDialogModel,
		private _modelBuilder: azdata.ModelBuilder,
		private _formBuilder: azdata.FormBuilder,
		private _languageContent: mssql.ExternalLanguageContent | undefined,
	) {
		super(model, parent);
		this._localPath = this._modelBuilder.radioButton()
			.withProperties({
				value: 'local',
				name: 'extensionLocation',
				label: constants.extLangLocal,
				checked: true
			}).component();

		this._serverPath = this._modelBuilder.radioButton()
			.withProperties({
				value: 'server',
				name: 'extensionLocation',
				label: model.getServerTitle(),
			}).component();

		this._localPath.onDidClick(() => {
			this._isLocalPath = true;
		});
		this._serverPath.onDidClick(() => {
			this._isLocalPath = false;
		});


		let flexRadioButtonsModel = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				justifyContent: 'space-between'
				//width: parent.componentMaxLength
			}).withItems([
				this._localPath, this._serverPath]
			).component();

		this._extensionFile = this._modelBuilder.inputBox().withProperties({
			value: '',
			width: parent.componentMaxLength - parent.browseButtonMaxLength - parent.spaceBetweenComponentsLength
		}).component();
		let fileBrowser = this._modelBuilder.button().withProperties({
			label: '...',
			width: parent.browseButtonMaxLength,
			CSSStyles: {
				'text-align': 'end'
			}
		}).component();

		let flexFilePathModel = this._modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				justifyContent: 'space-between'
			}).withItems([
				this._extensionFile, fileBrowser]
			).component();
		this.filePathSelected(args => {
			this._extensionFile.value = args.filePath;
		});
		fileBrowser.onDidClick(async () => {
			this.onOpenFileBrowser({ filePath: '', target: this._isLocalPath ? constants.localhost : this._model.connectionUrl });
		});

		this._extensionFileName = this._modelBuilder.inputBox().withProperties({
			value: '',
			width: parent.componentMaxLength
		}).component();

		this._envVariables = this._modelBuilder.inputBox().withProperties({
			value: '',
			width: parent.componentMaxLength
		}).component();
		this._parameters = this._modelBuilder.inputBox().withProperties({
			value: '',
			width: parent.componentMaxLength
		}).component();

		this.load();

		this._formBuilder.addFormItems([{
			component: flexRadioButtonsModel,
			title: constants.extLangExtensionFileLocation
		}, {
			component: flexFilePathModel,
			title: constants.extLangExtensionFilePath,
			required: true
		}, {
			component: this._extensionFileName,
			title: constants.extLangExtensionFileName,
			required: true
		}, {
			component: this._envVariables,
			title: constants.extLangEnvVariables
		}, {
			component: this._parameters,
			title: constants.extLangParameters
		}]);
	}

	private load() {
		if (this._languageContent) {
			this._isLocalPath = this._languageContent.isLocalFile;
			this._localPath.checked = this._isLocalPath;
			this._serverPath.checked = !this._isLocalPath;
			this._extensionFile.value = this._languageContent.pathToExtension;
			this._extensionFileName.value = this._languageContent.extensionFileName;
			this._envVariables.value = this._languageContent.environmentVariables;
			this._parameters.value = this._languageContent.parameters;
		}
	}

	public async reset(): Promise<void> {
		return new Promise(resolve => {
			this._isLocalPath = true;
			this._localPath.checked = this._isLocalPath;
			this._serverPath.checked = !this._isLocalPath;
			this.load();
			resolve();
		});
	}

	public get updatedContent(): mssql.ExternalLanguageContent {
		return {
			pathToExtension: this._extensionFile.value || '',
			extensionFileName: this._extensionFileName.value || '',
			parameters: this._parameters.value || '',
			environmentVariables: this._envVariables.value || '',
			isLocalFile: this._isLocalPath || false,
			platform: this._languageContent?.platform
		};
	}
}
