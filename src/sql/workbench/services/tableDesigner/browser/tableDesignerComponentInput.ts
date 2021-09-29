/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerData, DesignerEdit, DesignerEditResult, DesignerComponentInput, DesignerView, DesignerTab, ComponentDefinition, TableComponentDefinition, InputComponentDefinition, DropdownComponentDefinition, InputComponentData } from 'sql/base/browser/ui/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';

export class TableDesignerComponentInput implements DesignerComponentInput {

	private _data: DesignerData;
	private _view: DesignerView;

	constructor(private readonly _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo) {
	}

	get objectType(): string {
		return localize('tableDesigner.tableObjectType', "Type");
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
			errorMessages: result.errorMessages
		};
	}

	private async initialize(): Promise<void> {
		const designerInfo = await this._provider.getTableDesignerInfo(this._tableInfo);

		this._data = designerInfo.data;
		this.setDefaultData();

		const advancedTabComponents: ComponentDefinition[] = [];

		advancedTabComponents.push({
			type: 'input',
			title: localize('tableDesigner.schemaTitle', "Schema"),
			property: designers.TableProperty.Schema
		});

		advancedTabComponents.push({
			type: 'input',
			title: localize('tableDesigner.descriptionTitle', "Description"),
			property: designers.TableProperty.Description
		});

		if (designerInfo.view.additionalTableProperties) {
			advancedTabComponents.push(...designerInfo.view.additionalTableProperties);
		}

		const advancedTab = <DesignerTab>{
			title: localize('tableDesigner.advancedTab', "Advanced"),
			components: advancedTabComponents
		};

		const columnProperties: ComponentDefinition[] = [];

		columnProperties.push(
			{
				type: 'input',
				title: localize('tableDesigner.columnNameTitle', "Name"),
				property: designers.TableColumnProperty.Name,
				width: 150
			}
		);

		columnProperties.push(
			<DropdownComponentDefinition>{
				type: 'dropdown',
				title: localize('tableDesigner.columnTypeTitle', "Type"),
				property: designers.TableColumnProperty.Type,
				width: 75,
				options: designerInfo.columnTypes
			}
		);

		columnProperties.push(
			<InputComponentDefinition>{
				type: 'input',
				title: localize('tableDesigner.columnLengthTitle', "Length"),
				property: designers.TableColumnProperty.Length,
				width: 75
			}
		);

		columnProperties.push(
			{
				type: 'input',
				title: localize('tableDesigner.columnDefaultValueTitle', "Default Value"),
				property: designers.TableColumnProperty.DefaultValue,
				width: 150
			}
		);

		columnProperties.push(
			{
				type: 'checkbox',
				title: localize('tableDesigner.columnAllowNullTitle', "Allow Nulls"),
				property: designers.TableColumnProperty.AllowNulls
			}
		);

		if (designerInfo.view.addtionalTableColumnProperties) {
			columnProperties.push(...designerInfo.view.addtionalTableColumnProperties);
		}

		const columnsTab = <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				<TableComponentDefinition>{
					type: 'table',
					property: designers.TableProperty.Columns,
					columns: [
						designers.TableColumnProperty.Name,
						designers.TableColumnProperty.Type,
						designers.TableColumnProperty.Length,
						designers.TableColumnProperty.DefaultValue,
						designers.TableColumnProperty.AllowNulls
					],
					itemProperties: columnProperties,
					objectType: localize('tableDesigner.columnTypeName', "Column")
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
				property: designers.TableColumnProperty.Name,
				title: localize('tableDesigner.nameTitle', "Table name"),
				width: 200
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
			this._data[property] = <InputComponentData>{};
		}
	}
}
