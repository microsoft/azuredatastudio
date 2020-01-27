/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import * as mssql from '../../../../mssql';
import { ExternalLanguagesDialogModel } from './externalLanguagesDialogModel';
import { ExternalLanguageEditDialog } from './externalLanguageEditDialog';

export class ExternalLanguagesTable {

	private _table: azdata.DeclarativeTableComponent;

	/**
	 *
	 */
	constructor(private _modelBuilder: azdata.ModelBuilder, private _model: ExternalLanguagesDialogModel) {
		this._table = _modelBuilder.declarativeTable()
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
						{ // Action
							displayName: constants.extLangLanguageCreatedDateColumn,
							ariaLabel: constants.extLangLanguageCreatedDateColumn,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 150,
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
							width: 50,
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
							width: 50,
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

	public get table(): azdata.DeclarativeTableComponent {
		return this._table;
	}

	public async loadData(): Promise<void> {
		let languages: mssql.ExternalLanguage[] | undefined;

		languages = await this._model.GetLanguageList();

		let packageData = languages ? languages.map(language => this.createTableRow(language)) : [];
		this._table.data = packageData;
	}

	private createTableRow(language: mssql.ExternalLanguage): any[] {
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
				this._model.deleteLanguage(language.name);
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
				let editDialog = new ExternalLanguageEditDialog(this._model, language);
				editDialog.showDialog();
			});
			return [language.name, language.createdDate, dropLanguageButton, editLanguageButton];
		}
		return [];
	}
}
