/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import * as mssql from '../../../../mssql';
import { LanguageViewBase } from './languageViewBase';
import { ApiWrapper } from '../../common/apiWrapper';

export class LanguagesTable extends LanguageViewBase {

	private _table: azdata.DeclarativeTableComponent;

	/**
	 *
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: LanguageViewBase) {
		super(apiWrapper, parent.root, parent);
		this._table = _modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Name
							displayName: constants.extLangLanguageName,
							ariaLabel: constants.extLangLanguageName,
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
						{ // Platform
							displayName: constants.extLangLanguagePlatform,
							ariaLabel: constants.extLangLanguagePlatform,
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
						{ // Created Date
							displayName: constants.extLangLanguageCreatedDate,
							ariaLabel: constants.extLangLanguageCreatedDate,
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

		languages = await this.listLanguages();
		let tableData: any[][] = [];

		if (languages) {

			languages.forEach(language => {
				if (!language.contents || language.contents.length === 0) {
					language.contents.push(this.createNewContent());
				}

				tableData = tableData.concat(language.contents.map(content => this.createTableRow(language, content)));
			});
		}

		this._table.data = tableData;
	}

	private createTableRow(language: mssql.ExternalLanguage, content: mssql.ExternalLanguageContent): any[] {
		if (this._modelBuilder) {
			let dropLanguageButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.deleteTitle,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/delete_inverse.svg'),
					light: this.asAbsolutePath('images/light/delete.svg')
				},
				width: 15,
				height: 15
			}).component();
			dropLanguageButton.onDidClick(async () => {
				await this.deleteLanguage({
					language: language,
					content: content,
					newLang: false
				});
			});

			let editLanguageButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.editTitle,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/edit_inverse.svg'),
					light: this.asAbsolutePath('images/light/edit.svg')
				},
				width: 15,
				height: 15
			}).component();
			editLanguageButton.onDidClick(() => {
				this.onEditLanguage({
					language: language,
					content: content,
					newLang: false
				});
			});
			return [language.name, content.platform, language.createdDate, dropLanguageButton, editLanguageButton];
		}

		return [];
	}

	public async reset(): Promise<void> {
		await this.loadData();
	}
}
