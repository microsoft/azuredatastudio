/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../../mssql';
import { LanguageViewBase } from './languageViewBase';
import * as constants from '../../common/constants';
import { ApiWrapper } from '../../common/apiWrapper';

export class LanguageContentView extends LanguageViewBase {

	private _serverPath: azdata.RadioButtonComponent;
	private _localPath: azdata.RadioButtonComponent;
	public extensionFile: azdata.TextComponent;
	public extensionFileName: azdata.TextComponent;
	public envVariables: azdata.TextComponent;
	public parameters: azdata.TextComponent;
	private _isLocalPath: boolean = true;

	/**
	 *
	 */
	constructor(
		apiWrapper: ApiWrapper,
		parent: LanguageViewBase,
		private _modelBuilder: azdata.ModelBuilder,
		private _formBuilder: azdata.FormBuilder,
		private _languageContent: mssql.ExternalLanguageContent | undefined,
	) {
		super(apiWrapper, parent.root, parent);
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
				label: this.getServerTitle(),
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

		this.extensionFile = this._modelBuilder.inputBox().withProperties({
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
				this.extensionFile, fileBrowser]
			).component();
		this.filePathSelected(args => {
			this.extensionFile.value = args.filePath;
		});
		fileBrowser.onDidClick(async () => {
			this.onOpenFileBrowser({ filePath: '', target: this._isLocalPath ? constants.localhost : this.connectionUrl });
		});

		this.extensionFileName = this._modelBuilder.inputBox().withProperties({
			value: '',
			width: parent.componentMaxLength
		}).component();

		this.envVariables = this._modelBuilder.inputBox().withProperties({
			value: '',
			width: parent.componentMaxLength
		}).component();
		this.parameters = this._modelBuilder.inputBox().withProperties({
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
			component: this.extensionFileName,
			title: constants.extLangExtensionFileName,
			required: true
		}, {
			component: this.envVariables,
			title: constants.extLangEnvVariables
		}, {
			component: this.parameters,
			title: constants.extLangParameters
		}]);
	}

	private load() {
		if (this._languageContent) {
			this._isLocalPath = this._languageContent.isLocalFile;
			this._localPath.checked = this._isLocalPath;
			this._serverPath.checked = !this._isLocalPath;
			this.extensionFile.value = this._languageContent.pathToExtension;
			this.extensionFileName.value = this._languageContent.extensionFileName;
			this.envVariables.value = this._languageContent.environmentVariables;
			this.parameters.value = this._languageContent.parameters;
		}
	}

	public async reset(): Promise<void> {
		this._isLocalPath = true;
		this._localPath.checked = this._isLocalPath;
		this._serverPath.checked = !this._isLocalPath;
		this.load();
	}

	public get updatedContent(): mssql.ExternalLanguageContent {
		return {
			pathToExtension: this.extensionFile.value || '',
			extensionFileName: this.extensionFileName.value || '',
			parameters: this.parameters.value || '',
			environmentVariables: this.envVariables.value || '',
			isLocalFile: this._isLocalPath || false,
			platform: this._languageContent?.platform
		};
	}
}
