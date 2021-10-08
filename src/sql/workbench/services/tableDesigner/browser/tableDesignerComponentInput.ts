/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerData, DesignerEdit, DesignerEditResult, DesignerComponentInput, DesignerView, DesignerTab, DesignerItemComponentInfo, DropDownProperties, DesignerTableProperties } from 'sql/base/browser/ui/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';

export class TableDesignerComponentInput implements DesignerComponentInput {

	private _data: DesignerData;
	private _view: DesignerView;

	constructor(private readonly _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo) {
	}

	get objectTypeDisplayName(): string {
		return localize('tableDesigner.tableObjectType', "Table");
	}

	async getView(): Promise<DesignerView> {
		if (!this._view) {
			await this.initialize();
		}
		return this._view;
	}

	async getData(): Promise<DesignerData> {
		if (!this._data) {
			await this.initialize();
		}
		return this._data;
	}

	async processEdit(edit: DesignerEdit): Promise<DesignerEditResult> {
		const result = await this._provider.processTableEdit(this._tableInfo, this._data!, edit);
		if (result.isValid) {
			this._data = result.data;
		}
		return {
			isValid: result.isValid,
			errors: result.errors
		};
	}

	private async initialize(): Promise<void> {
		const designerInfo = await this._provider.getTableDesignerInfo(this._tableInfo);

		this._data = designerInfo.data;
		this.setDefaultData();

		const advancedTabComponents: DesignerItemComponentInfo[] = [
			{
				type: 'dropdown',
				propertyName: designers.TableProperty.Schema,
				componentProperties: <DropDownProperties>{
					title: localize('tableDesigner.schemaTitle', "Schema"),
					values: designerInfo.schemas
				}
			}, {
				type: 'input',
				propertyName: designers.TableProperty.Description,
				componentProperties: {
					title: localize('tableDesigner.descriptionTitle', "Description")
				}
			}
		];

		if (designerInfo.view.additionalTableProperties) {
			advancedTabComponents.push(...designerInfo.view.additionalTableProperties);
		}

		const advancedTab = <DesignerTab>{
			title: localize('tableDesigner.advancedTab', "Advanced"),
			components: advancedTabComponents
		};

		const columnProperties: DesignerItemComponentInfo[] = [
			{
				type: 'input',
				propertyName: designers.TableColumnProperty.Name,
				componentProperties: {
					title: localize('tableDesigner.columnNameTitle', "Name"),
					width: 150
				}
			}, {
				type: 'dropdown',
				propertyName: designers.TableColumnProperty.Type,
				componentProperties: {
					title: localize('tableDesigner.columnTypeTitle', "Type"),
					width: 75,
					values: designerInfo.columnTypes
				}
			}, {
				type: 'input',
				propertyName: designers.TableColumnProperty.Length,
				componentProperties: {
					title: localize('tableDesigner.columnLengthTitle', "Length"),
					width: 75
				}
			}, {
				type: 'input',
				propertyName: designers.TableColumnProperty.DefaultValue,
				componentProperties: {
					title: localize('tableDesigner.columnDefaultValueTitle', "Default Value"),
					width: 150
				}
			}, {
				type: 'checkbox',
				propertyName: designers.TableColumnProperty.AllowNulls,
				componentProperties: {
					title: localize('tableDesigner.columnAllowNullTitle', "Allow Nulls"),
				}
			}
		];

		if (designerInfo.view.addtionalTableColumnProperties) {
			columnProperties.push(...designerInfo.view.addtionalTableColumnProperties);
		}

		const columnsTab = <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				{
					type: 'table',
					propertyName: designers.TableProperty.Columns,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.columnsTabTitle', "Columns"),
						columns: [
							designers.TableColumnProperty.Name,
							designers.TableColumnProperty.Type,
							designers.TableColumnProperty.Length,
							designers.TableColumnProperty.DefaultValue,
							designers.TableColumnProperty.AllowNulls
						],
						itemProperties: columnProperties,
						objectTypeDisplayName: localize('tableDesigner.columnTypeName', "Column")
					}
				}
			]
		};

		const tabs = [columnsTab, advancedTab];
		if (designerInfo.view.addtionalTabs) {
			tabs.push(...tabs);
		}

		this._view = {
			components: [{
				type: 'input',
				propertyName: designers.TableColumnProperty.Name,
				componentProperties: {
					title: localize('tableDesigner.nameTitle', "Table name"),
					width: 200
				}
			}],
			tabs: tabs
		};
	}

	private setDefaultData(): void {
		const properties = Object.keys(this._data);
		this.setDefaultInputData(properties, designers.TableProperty.Name);
		this.setDefaultInputData(properties, designers.TableProperty.Schema);
		this.setDefaultInputData(properties, designers.TableProperty.Description);
	}

	private setDefaultInputData(allProperties: string[], property: string): void {
		if (allProperties.indexOf(property) === -1) {
			this._data[property] = {};
		}
	}
}
