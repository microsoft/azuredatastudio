/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerData, DesignerEdit, DesignerEditResult, DesignerComponentInput, DesignerView, DesignerTab, DesignerItemComponent, TableComponent, InputComponent, DropdownComponent } from 'sql/base/browser/ui/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';

export class TableDesignerComponentInput implements DesignerComponentInput {

	private _data: DesignerData;
	private _view: DesignerView;

	constructor(private readonly _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo,
		designerInfo: azdata.designers.TableDesignerInfo) {
		this.initialize(designerInfo);
	}

	async getView(): Promise<DesignerView> {
		return this._view;
	}

	async getData(): Promise<DesignerData> {
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

	private initialize(designerInfo: azdata.designers.TableDesignerInfo): void {
		this._data = designerInfo.data;

		const generalTabComponents: DesignerItemComponent[] = [];
		generalTabComponents.push({
			type: 'input',
			property: designers.TableProperties.Name
		});

		generalTabComponents.push({
			type: 'input',
			property: designers.TableProperties.Schema
		});

		generalTabComponents.push({
			type: 'input',
			property: designers.TableProperties.Description
		});

		if (designerInfo.view.additionalTableProperties) {
			generalTabComponents.push(...designerInfo.view.additionalTableProperties);
		}

		const generalTab = <DesignerTab>{
			title: localize('tableDesigner.generalTab', "General"),
			components: generalTabComponents
		};

		const columnProperties: DesignerItemComponent[] = [];

		columnProperties.push(
			{
				type: 'input',
				property: designers.TableColumnProperties.Name
			}
		);

		columnProperties.push(
			<DropdownComponent>{
				type: 'dropdown',
				property: designers.TableColumnProperties.Type,
				options: designerInfo.columnTypes
			}
		);

		columnProperties.push(
			<InputComponent>{
				type: 'input',
				property: designers.TableColumnProperties.Length,
				inputType: 'number'
			}
		);

		columnProperties.push(
			{
				type: 'input',
				property: designers.TableColumnProperties.DefaultValue
			}
		);

		columnProperties.push(
			{
				type: 'checkbox',
				property: designers.TableColumnProperties.AllowNull
			}
		);

		if (designerInfo.view.addtionalTableColumnProperties) {
			columnProperties.push(...designerInfo.view.addtionalTableColumnProperties);
		}

		const columnsTab = <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				<TableComponent>{
					type: 'table',
					property: designers.TableProperties.Columns,
					columns: [
						designers.TableColumnProperties.Name,
						designers.TableColumnProperties.Type,
						designers.TableColumnProperties.Length,
						designers.TableColumnProperties.DefaultValue,
						designers.TableColumnProperties.AllowNull
					],
					itemProperties: columnProperties
				}
			]
		};

		const tabs = [generalTab, columnsTab];
		if (designerInfo.view.addtionalTabs) {
			tabs.push(...tabs);
		}

		this._view = { tabs: tabs };
	}


}
