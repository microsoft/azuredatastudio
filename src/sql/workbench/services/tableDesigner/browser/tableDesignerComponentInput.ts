/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerData, DesignerEdit, DesignerEditResult, DesignerComponentInput, DesignerView, DesignerTab, UIComponentInfo, TableComponentInfo, InputComponentInfo, DropdownComponentInfo, InputComponentData } from 'sql/base/browser/ui/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';

export class TableDesignerComponentInput implements DesignerComponentInput {

	private _data: DesignerData;
	private _view: DesignerView;

	constructor(private readonly _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo) {
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

		const advancedTabComponents: UIComponentInfo[] = [];

		advancedTabComponents.push({
			type: 'input',
			title: localize('tableDesigner.schemaTitle', "Schema"),
			property: designers.TableProperties.Schema
		});

		advancedTabComponents.push({
			type: 'input',
			title: localize('tableDesigner.descriptionTitle', "Description"),
			property: designers.TableProperties.Description
		});

		if (designerInfo.view.additionalTableProperties) {
			advancedTabComponents.push(...designerInfo.view.additionalTableProperties);
		}

		const advancedTab = <DesignerTab>{
			title: localize('tableDesigner.advancedTab', "Advanced"),
			components: advancedTabComponents
		};

		const columnProperties: UIComponentInfo[] = [];

		columnProperties.push(
			{
				type: 'input',
				title: localize('tableDesigner.columnNameTitle', "Name"),
				property: designers.TableColumnProperties.Name,
				width: 150
			}
		);

		columnProperties.push(
			<DropdownComponentInfo>{
				type: 'dropdown',
				title: localize('tableDesigner.columnTypeTitle', "Type"),
				property: designers.TableColumnProperties.Type,
				width: 75,
				options: designerInfo.columnTypes
			}
		);

		columnProperties.push(
			<InputComponentInfo>{
				type: 'input',
				title: localize('tableDesigner.columnLengthTitle', "Length"),
				property: designers.TableColumnProperties.Length,
				width: 75
			}
		);

		columnProperties.push(
			{
				type: 'input',
				title: localize('tableDesigner.columnDefaultValueTitle', "Default Value"),
				property: designers.TableColumnProperties.DefaultValue,
				width: 150
			}
		);

		columnProperties.push(
			{
				type: 'checkbox',
				title: localize('tableDesigner.columnAllowNullTitle', "Allow Nulls"),
				property: designers.TableColumnProperties.AllowNulls
			}
		);

		if (designerInfo.view.addtionalTableColumnProperties) {
			columnProperties.push(...designerInfo.view.addtionalTableColumnProperties);
		}

		const columnsTab = <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				<TableComponentInfo>{
					type: 'table',
					property: designers.TableProperties.Columns,
					columns: [
						designers.TableColumnProperties.Name,
						designers.TableColumnProperties.Type,
						designers.TableColumnProperties.Length,
						designers.TableColumnProperties.DefaultValue,
						designers.TableColumnProperties.AllowNulls
					],
					itemProperties: columnProperties
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
				property: designers.TableColumnProperties.Name,
				title: localize('tableDesigner.nameTitle', "Table name"),
				width: 200
			}],
			tabs: tabs
		};
	}

	private setDefaultData(): void {
		const properties = Object.keys(this._data);
		this.setDefaultInputData(properties, designers.TableProperties.Name);
		this.setDefaultInputData(properties, designers.TableProperties.Schema);
		this.setDefaultInputData(properties, designers.TableProperties.Description);
	}

	private setDefaultInputData(allProperties: string[], property: string): void {
		if (allProperties.indexOf(property) === -1) {
			this._data[property] = <InputComponentData>{};
		}
	}
}
