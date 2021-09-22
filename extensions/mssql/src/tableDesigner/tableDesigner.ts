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
			(<azdata.designers.InputComponentData>data[azdata.designers.TableProperties.Name]).value = Date.now().toLocaleString();
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
			return {
				view: {},
				data: data,
				columnTypes: ['int']
			};
		}
	});

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		await azdata.designers.openTableDesigner('MSSQL', {
			server: 'sqltools2017-3',
			database: 'database',
			isNewTable: true
		});
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		const data: azdata.designers.DesignerData = {};
		data[azdata.designers.TableProperties.Name] = <azdata.designers.InputComponentData>{
			value: 'test'
		};
		await azdata.designers.openTableDesigner('MSSQL', {
			server: 'sqltools2017-3',
			database: 'database',
			isNewTable: true
		});
	}));

}
