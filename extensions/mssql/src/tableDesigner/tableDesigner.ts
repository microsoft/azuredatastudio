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
			if (edit.property === azdata.designers.TableProperties.Name) {
				(<azdata.designers.InputComponentData>data[azdata.designers.TableProperties.Description]).value = `description of table ${edit.value}`;
				(<azdata.designers.InputComponentData>data[azdata.designers.TableProperties.Name]).value = edit.value;
			}
			return Promise.resolve({
				isValid: true,
				data: data
			});
		},
		getTableDesignerInfo: async (table): Promise<azdata.designers.TableDesignerInfo> => {
			const data: azdata.designers.DesignerData = {};
			data[azdata.designers.TableProperties.Name] = <azdata.designers.InputComponentData>{
				value: 'test'
			};

			const column1 = <azdata.designers.TableComponentRowData>{};
			column1[azdata.designers.TableColumnProperties.Name] = <azdata.designers.InputComponentData>{
				value: 'column1'
			};
			column1[azdata.designers.TableColumnProperties.Type] = <azdata.designers.InputComponentData>{
				value: 'type1'
			};
			column1[azdata.designers.TableColumnProperties.Length] = <azdata.designers.InputComponentData>{
				value: 100
			};
			column1[azdata.designers.TableColumnProperties.DefaultValue] = <azdata.designers.InputComponentData>{
				value: ''
			};
			column1[azdata.designers.TableColumnProperties.AllowNull] = <azdata.designers.CheckboxComponentData>{
				value: true
			};
			const columns = <azdata.designers.TableComponentData>{
				rows: [
					column1
				]
			};

			data[azdata.designers.TableProperties.Columns] = columns;
			return {
				view: {},
				data: data,
				columnTypes: ['int']
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
		const data: azdata.designers.DesignerData = {};
		data[azdata.designers.TableProperties.Name] = <azdata.designers.InputComponentData>{
			value: 'test'
		};
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
