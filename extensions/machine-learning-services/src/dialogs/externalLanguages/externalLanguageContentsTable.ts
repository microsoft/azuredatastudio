/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import * as mssql from '../../../../mssql/src/mssql';
import { ExternalLanguagesDialogModel } from './externalLanguagesDialogModel';

export class ExternalLanguageContentsTable {

	public component: azdata.DeclarativeTableComponent;
	private _onEdit: vscode.EventEmitter<mssql.ExternalLanguageContent> = new vscode.EventEmitter<mssql.ExternalLanguageContent>();
	public readonly onEdit: vscode.Event<mssql.ExternalLanguageContent> = this._onEdit.event;

	/**
	 *
	 */
	constructor(private _modelBuilder: azdata.ModelBuilder, private _model: ExternalLanguagesDialogModel, private _language: mssql.ExternalLanguage) {
		this.component = _modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Status icon
							displayName: constants.extLangLanguageNameColumn,
							ariaLabel: constants.extLangLanguageNameColumn,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 100,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Status icon
							displayName: 'File Name',
							ariaLabel: constants.extLangLanguageNameColumn,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 100,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Status icon
							displayName: 'Env Variables',
							ariaLabel: constants.extLangLanguageNameColumn,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 100,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Action
							displayName: '',
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 20,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Action
							displayName: '',
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 20,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						}
					],
					data: [],
					ariaLabel: constants.mlsConfigTitle
				})
			.component();
	}

	public loadData(): void {
		let languageContents: mssql.ExternalLanguageContent[] | undefined;

		languageContents = this._language.contents;

		let packageData = languageContents ? languageContents.map(language => this.createTableRow(language)) : [];
		this.component.data = packageData;
	}

	private createTableRow(languageContent: mssql.ExternalLanguageContent): any[] {

		if (this._modelBuilder) {
			let dropLanguageButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.deleteTitle,
				iconPath: {
					dark: this._model.asAbsolutePath('images/dark/delete_inverse.svg'),
					light: this._model.asAbsolutePath('images/light/delete.svg')
				},
				width: 15,
				height: 15
			}).component();
			dropLanguageButton.onDidClick(async () => {
				//this._model.deleteLanguage(language.name);
			});

			let editLanguageButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.deleteTitle,
				iconPath: {
					dark: this._model.asAbsolutePath('images/dark/edit_inverse.svg'),
					light: this._model.asAbsolutePath('images/light/edit.svg')
				},
				width: 15,
				height: 15
			}).component();
			editLanguageButton.onDidClick(async () => {
				this._onEdit.fire(languageContent);
			});
			return [languageContent.platform, languageContent.extensionFileName, languageContent.environmentVariables, dropLanguageButton, editLanguageButton];
		}
		return [];
	}
}
