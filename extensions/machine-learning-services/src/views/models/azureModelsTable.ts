/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { WorkspaceModel } from '../../modelManagement/interfaces';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { azureResource } from '../../modelManagement/azure-resource';

export class AzureModelsTable extends ModelViewBase {

	private _table: azdata.DeclarativeTableComponent;

	/**
	 *
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._table = _modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Id
							displayName: constants.modeIld,
							ariaLabel: constants.modeIld,
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
						{ // Name
							displayName: constants.modelName,
							ariaLabel: constants.modelName,
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
						}
					],
					data: [],
					ariaLabel: constants.mlsConfigTitle
				})
			.component();
	}

	public get component(): azdata.DeclarativeTableComponent {
		return this._table;
	}

	public async loadData(
		account?: azdata.Account | undefined,
		subscription?: azureResource.AzureResourceSubscription | undefined,
		group?: azureResource.AzureResource | undefined,
		workspace?: Workspace | undefined): Promise<void> {
		let models: WorkspaceModel[] | undefined;

		models = await this.listAzureModels(account, subscription, group, workspace);
		let tableData: any[][] = [];

		if (models) {
			tableData = tableData.concat(models.map(model => this.createTableRow(model)));
		}

		this._table.data = tableData;
	}

	private createTableRow(model: WorkspaceModel): any[] {
		if (this._modelBuilder) {
			let editLanguageButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.deleteTitle,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/edit_inverse.svg'),
					light: this.asAbsolutePath('images/light/edit.svg')
				},
				width: 15,
				height: 15
			}).component();
			editLanguageButton.onDidClick(() => {
				/*
				this.onEditLanguage({
					language: language,
					content: content,
					newLang: false
				});
				*/
			});
			return [model.id, model.name, editLanguageButton];
		}

		return [];
	}

	public async reset(): Promise<void> {
		await this.loadData();
	}
}
