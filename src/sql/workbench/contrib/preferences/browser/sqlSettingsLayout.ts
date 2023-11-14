/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { tocData as vstocData, ITOCEntry } from 'vs/workbench/contrib/preferences/browser/settingsLayout';

export const OBJECT_EXPLORER_CONFIG_PREFIX = 'objectExplorer';

// Copy existing table of contents and append
export const tocData: ITOCEntry<string> = Object.assign({}, vstocData);
let sqlTocItems: ITOCEntry<string>[] = [{
	id: 'data',
	label: localize('data', "Data"),
	children: [
		{
			id: 'data/connection',
			label: localize('connection', "Connection"),
			settings: ['connection.*', 'datasource.*']
		},
		{
			id: 'data/objectExplorer',
			label: localize('objectExplorer', "Object Explorer"),
			settings: ['startup.alwaysShowServersView', 'serverTree.*', 'serverGroup.*']
		},
		{
			id: 'data/queryEditor',
			label: localize('queryEditor', "Query Editor"),
			settings: ['queryEditor.*']
		},
		{
			id: 'data/notebook',
			label: localize('notebook', "Notebook"),
			settings: ['notebook.*']
		},
		{
			id: 'data/dashboard',
			label: localize('dashboard', "Dashboard"),
			settings: ['dashboard.*']
		},
		{
			id: 'data/profiler',
			label: localize('profiler', "Profiler"),
			settings: ['profiler.*']
		},
		{
			id: 'data/builtinCharts',
			label: localize('builtinCharts', "Built-in Charts"),
			settings: ['builtinCharts.*']
		},
		{
			id: 'data/tableDesigner',
			label: localize('tableDesigner', "Table Designer"),
			settings: ['tableDesigner.*']
		},
		{
			id: 'data/executionPlan',
			label: localize('executionPlan', "Execution Plan"),
			settings: ['executionPlan.*']
		}
	]
}];
tocData.children!.push(...sqlTocItems);
