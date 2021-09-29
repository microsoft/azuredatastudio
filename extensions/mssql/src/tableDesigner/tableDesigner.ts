/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';

export function registerTableDesignerCommands(appContext: AppContext) {

	//todo: remove, testing only
	azdata.dataprotocol.registerTableDesignerProvider({
		providerId: 'MSSQL',
		processTableEdit: (table, data, edit): Promise<azdata.designers.DesignerEditResult> => {
			if (typeof edit.property === 'string') {
				if (edit.property === azdata.designers.TableProperty.Name) {
					(<azdata.designers.InputComponentData>data[azdata.designers.TableProperty.Description]).value = `description of table ${edit.value}`;
				}
			} else {
				if (edit.property.parentProperty === azdata.designers.TableProperty.Columns) {
					if (edit.property.property === azdata.designers.TableColumnProperty.Type && edit.value === 'int') {
						const tableData = data[azdata.designers.TableProperty.Columns] as azdata.designers.TableComponentData;
						const columnData = tableData.rows[edit.property.index];
						const lengthProperty = columnData[azdata.designers.TableColumnProperty.Length] as azdata.designers.InputComponentData;
						const typeProperty = columnData[azdata.designers.TableColumnProperty.Type] as azdata.designers.DropdownComponentData;
						const allowNullsProperty = columnData[azdata.designers.TableColumnProperty.AllowNulls] as azdata.designers.CheckboxComponentData;
						lengthProperty.value = '';
						lengthProperty.enabled = false;
						typeProperty.enabled = false;
						allowNullsProperty.enabled = false;
					}
				}
			}
			return Promise.resolve({
				isValid: true,
				data: data
			});
		},
		getTableDesignerInfo: async (table): Promise<azdata.designers.TableDesignerInfo> => {
			const data: azdata.designers.DesignerData = {};
			data[azdata.designers.TableProperty.Name] = <azdata.designers.InputComponentData>{
				value: 'test'
			};

			const column1 = <azdata.designers.TableComponentRowData>{};
			column1[azdata.designers.TableProperty.Name] = <azdata.designers.InputComponentData>{
				value: 'column1'
			};
			column1[azdata.designers.TableColumnProperty.Type] = <azdata.designers.DropdownComponentData>{
				value: 'nvarchar'
			};
			column1[azdata.designers.TableColumnProperty.Length] = <azdata.designers.InputComponentData>{
				value: '100'
			};
			column1[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.designers.InputComponentData>{
				value: ''
			};
			column1[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.designers.CheckboxComponentData>{
				value: true
			};

			const column2 = <azdata.designers.TableComponentRowData>{};
			column2[azdata.designers.TableColumnProperty.Name] = <azdata.designers.InputComponentData>{
				value: 'column2'
			};
			column2[azdata.designers.TableColumnProperty.Type] = <azdata.designers.DropdownComponentData>{
				value: 'int'
			};
			column2[azdata.designers.TableColumnProperty.Length] = <azdata.designers.InputComponentData>{
				value: ''
			};
			column2[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.designers.InputComponentData>{
				value: ''
			};
			column2[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.designers.CheckboxComponentData>{
				value: false
			};

			const column3 = <azdata.designers.TableComponentRowData>{};
			column3[azdata.designers.TableColumnProperty.Name] = <azdata.designers.InputComponentData>{
				value: 'column3'
			};
			column3[azdata.designers.TableColumnProperty.Type] = <azdata.designers.DropdownComponentData>{
				value: 'int'
			};
			column3[azdata.designers.TableColumnProperty.Length] = <azdata.designers.InputComponentData>{
				value: ''
			};
			column3[azdata.designers.TableColumnProperty.DefaultValue] = <azdata.designers.InputComponentData>{
				value: ''
			};
			column3[azdata.designers.TableColumnProperty.AllowNulls] = <azdata.designers.CheckboxComponentData>{
				value: false
			};

			const columns = <azdata.designers.TableComponentData>{
				rows: [
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
		}
	});

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		await azdata.designers.openTableDesigner('MSSQL', {
			server: context.connectionProfile.serverName,
			database: context.connectionProfile.databaseName,
			isNewTable: true
		});
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		const nameParts = context.nodeInfo.label.split('.');
		await azdata.designers.openTableDesigner('MSSQL', {
			server: context.connectionProfile.serverName,
			database: context.connectionProfile.databaseName,
			isNewTable: false,
			name: nameParts[1],
			schema: nameParts[0]
		});
	}));

}
