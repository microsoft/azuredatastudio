/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { sqlProviderName } from '../constants';

export function registerTableDesignerCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		await azdata.designers.openTableDesigner(sqlProviderName, {
			server: context.connectionProfile.serverName,
			database: context.connectionProfile.databaseName,
			isNewTable: true
		});
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		const server = context.connectionProfile.serverName;
		const database = context.connectionProfile.databaseName;
		const schema = context.nodeInfo.metadata.schema;
		const name = context.nodeInfo.metadata.name;
		await azdata.designers.openTableDesigner(sqlProviderName, {
			server: server,
			database: database,
			isNewTable: false,
			name: name,
			schema: schema,
			id: `${server}|${database}|${schema}|${name}`
		});
	}));

}

azdata.dataprotocol.registerTableDesignerProvider({
	providerId: 'MSSQL',
	processTableEdit: (table, data, edit): Promise<azdata.designers.DesignerEditResult> => {
		const scriptProperty = <azdata.InputBoxProperties>data[azdata.designers.TableProperty.Script];
		switch (edit.type) {
			case azdata.designers.DesignerEditType.Add:
				scriptProperty.value += 'a row added';
				const column = <azdata.designers.DesignerTableComponentDataItem>{};
				column[azdata.designers.TableColumnProperty.Name] = <azdata.InputBoxProperties>{
					value: 'columnname'
				};
				column[azdata.designers.TableColumnProperty.Type] = <azdata.DropDownProperties>{
					value: 'int'
				};
				column[azdata.designers.TableColumnProperty.Length] = <azdata.InputBoxComponent>{
					value: ''
				};
				column[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.InputBoxProperties>{
					value: ''
				};
				column[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.CheckBoxProperties>{
					checked: false
				};
				column[azdata.designers.TableColumnProperty.IsPrimaryKey] = <azdata.CheckBoxProperties>{
					checked: false
				};
				(data[azdata.designers.TableProperty.Columns] as azdata.designers.DesignerTableProperties).data.push(column);
				break;
			case azdata.designers.DesignerEditType.Remove:
				scriptProperty.value += 'a row removed';
				break;
			default:
				scriptProperty.value += 'a property edited';
				if (typeof edit.property === 'string') {
					if (edit.property === azdata.designers.TableProperty.Name) {
						(<azdata.InputBoxProperties>data[azdata.designers.TableProperty.Description]).value = `description of table ${edit.value}`;
					}
				} else {
					if (edit.property.parentProperty === azdata.designers.TableProperty.Columns) {
						if (edit.property.property === azdata.designers.TableColumnProperty.Type) {
							const tableData = data[azdata.designers.TableProperty.Columns] as azdata.designers.DesignerTableProperties;
							const columnData = tableData.data[edit.property.index];
							const lengthProperty = columnData[azdata.designers.TableColumnProperty.Length] as azdata.InputBoxProperties;
							if (edit.value === 'int') {
								lengthProperty.value = '';
								lengthProperty.enabled = false;
							} else {
								lengthProperty.enabled = true;
							}
						}
					}
				}
				break;
		}
		return Promise.resolve({
			isValid: true,
			data: data
		});
	},
	getTableDesignerInfo: async (table): Promise<azdata.designers.TableDesignerInfo> => {
		const data: azdata.designers.DesignerData = {};
		data[azdata.designers.TableProperty.Name] = <azdata.InputBoxProperties>{
			value: 'test'
		};
		data[azdata.designers.TableProperty.Script] = <azdata.InputBoxProperties>{
			value: 'initial script'
		};

		const column1 = <azdata.designers.DesignerTableComponentDataItem>{};
		column1[azdata.designers.TableProperty.Name] = <azdata.InputBoxProperties>{
			value: 'column1'
		};
		column1[azdata.designers.TableColumnProperty.Type] = <azdata.DropDownProperties>{
			value: 'nvarchar'
		};
		column1[azdata.designers.TableColumnProperty.Length] = <azdata.InputBoxProperties>{
			value: '100'
		};
		column1[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.InputBoxProperties>{
			value: ''
		};
		column1[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.CheckBoxProperties>{
			checked: true
		};
		column1[azdata.designers.TableColumnProperty.IsPrimaryKey] = <azdata.CheckBoxProperties>{
			checked: false
		};

		const column2 = <azdata.designers.DesignerTableComponentDataItem>{};
		column2[azdata.designers.TableColumnProperty.Name] = <azdata.InputBoxProperties>{
			value: 'column2'
		};
		column2[azdata.designers.TableColumnProperty.Type] = <azdata.DropDownProperties>{
			value: 'int'
		};
		column2[azdata.designers.TableColumnProperty.Length] = <azdata.InputBoxProperties>{
			value: ''
		};
		column2[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.InputBoxProperties>{
			value: ''
		};
		column2[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.CheckBoxProperties>{
			checked: false
		};
		column2[azdata.designers.TableColumnProperty.IsPrimaryKey] = <azdata.CheckBoxProperties>{
			checked: false
		};

		const column3 = <azdata.designers.DesignerTableComponentDataItem>{};
		column3[azdata.designers.TableColumnProperty.Name] = <azdata.InputBoxProperties>{
			value: 'column3'
		};
		column3[azdata.designers.TableColumnProperty.Type] = <azdata.DropDownProperties>{
			value: 'int'
		};
		column3[azdata.designers.TableColumnProperty.Length] = <azdata.InputBoxComponent>{
			value: ''
		};
		column3[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.InputBoxProperties>{
			value: ''
		};
		column3[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.CheckBoxProperties>{
			checked: false
		};
		column3[azdata.designers.TableColumnProperty.IsPrimaryKey] = <azdata.CheckBoxProperties>{
			checked: false
		};

		const columns = <azdata.designers.DesignerTableProperties>{
			data: [
				column1,
				column2,
				column3
			]
		};

		data[azdata.designers.TableProperty.Columns] = columns;
		return {
			view: {},
			data: data,
			columnTypes: ['int', 'bigint', 'nvarchar'],
			schemas: ['dbo', 'sys', 'sales']
		};
	},
	saveTable: (table, data): Promise<void> => {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 3000);
		});
	}
});
