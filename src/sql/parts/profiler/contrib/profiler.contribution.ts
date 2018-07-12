/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import * as nls from 'vs/nls';

import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { ProfilerEditor } from 'sql/parts/profiler/editor/profilerEditor';
import { PROFILER_VIEW_TEMPLATE_SETTINGS, IProfilerViewTemplate } from 'sql/parts/profiler/service/interfaces';

const profilerDescriptor = new EditorDescriptor(
	ProfilerEditor,
	ProfilerEditor.ID,
	'ProfilerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(profilerDescriptor, [new SyncDescriptor(ProfilerInput)]);

const profilerViewTemplateSchema: IJSONSchema = {
		description: nls.localize('profiler.settings.viewTemplates', "Specifies view templates"),
		type: 'array',
		items: <IJSONSchema>{
			type: 'object',
			properties: {
				name: {
					type: 'string'
				}
			}
		},
		default: <Array<IProfilerViewTemplate>>[
			{
				name: 'Standard View',
				columns: [
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'ApplicationName',
						width: '1',
						eventsMapped: ['client_app_name']
					},
					{
						name: 'NTUserName',
						eventsMapped: ['nt_username']
					},
					{
						name: 'LoginName',
						eventsMapped: ['server_principal_name']
					},
					{
						name: 'ClientProcessID',
						eventsMapped: ['client_pid']
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'StartTime',
						eventsMapped: ['timestamp']
					},
					{
						name: 'CPU',
						eventsMapped: ['cpu_time']
					},
					{
						name: 'Reads',
						eventsMapped: ['logical_reads']
					},
					{
						name: 'Writes',
						eventsMapped: ['writes']
					},
					{
						name: 'Duration',
						eventsMapped: ['duration']
					},
					{
						name: 'EndTime',
						eventsMapped: []
					},
					{
						name: 'BinaryData',
						eventsMapped: []
					}
				]
			},
			{
				name: 'TSQL View',
				columns: [
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'StartTime',
						eventsMapped: ['timestamp']
					},
					{
						name: 'BinaryData',
						eventsMapped: []
					}
				]
			},
			{
				name: 'Tuning View',
				columns: [
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'Duration',
						eventsMapped: []
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'DatabaseID',
						eventsMapped: []
					},
					{
						name: 'DatabaseName',
						eventsMapped: []
					},
					{
						name: 'ObjectType',
						eventsMapped: []
					},
					{
						name: 'LoginName',
						eventsMapped: ['server_principal_name']
					}
				]
			},
			{
				name: 'TSQL_SPs View',
				columns: [
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'DatabaseID',
						eventsMapped: []
					},
					{
						name: 'DatabaseName',
						eventsMapped: []
					},
					{
						name: 'ObjectID',
						eventsMapped: []
					},
					{
						name: 'ObjectName',
						eventsMapped: []
					},
					{
						name: 'ServerName',
						eventsMapped: []
					},
					{
						name: 'BinaryData',
						eventsMapped: []
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'StartTime',
						eventsMapped: ['timestamp']
					}
				]
			},
			{
				name: 'TSQL_Locks View',
				columns: [
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'ApplicationName',
						eventsMapped: ['client_app_name']
					},
					{
						name: 'NTUserName',
						eventsMapped: ['nt_username']
					},
					{
						name: 'LoginName',
						eventsMapped: ['server_principal_name']
					},
					{
						name: 'ClientProcessID',
						eventsMapped: ['client_pid']
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'StartTime',
						eventsMapped: ['timestamp']
					},
					{
						name: 'CPU',
						eventsMapped: ['cpu_time']
					},
					{
						name: 'Reads',
						eventsMapped: ['logical_reads']
					},
					{
						name: 'Writes',
						eventsMapped: ['writes']
					},
					{
						name: 'Duration',
						eventsMapped: ['duration']
					},
					{
						name: 'EndTime',
						eventsMapped: []
					},
					{
						name: 'BinaryData',
						eventsMapped: []
					}
				]
			},
			{
				name: 'TSQL_Grouped View',
				columns: [
					{
						name: 'ApplicationName',
						eventsMapped: ['client_app_name']
					},
					{
						name: 'NTUserName',
						eventsMapped: ['nt_username']
					},
					{
						name: 'LoginName',
						eventsMapped: ['server_principal_name']
					},
					{
						name: 'ClientProcessID',
						eventsMapped: ['client_pid']
					},
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'StartTime',
						eventsMapped: ['timestamp']
					},
					{
						name: 'BinaryData',
						eventsMapped: []
					}
				]
			},
			{
				name: 'TSQL_Duration View',
				columns: [
					{
						name: 'EventClass',
						eventsMapped: ['name']
					},
					{
						name: 'Duration',
						eventsMapped: ['duration']
					},
					{
						name: 'TextData',
						eventsMapped: ['options_text', 'batch_text']
					},
					{
						name: 'SPID',
						eventsMapped: ['session_id']
					},
					{
						name: 'BinaryData',
						eventsMapped: []
					}
				]
			}
		]
	};

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
const dashboardConfig: IConfigurationNode = {
	id: 'Profiler',
	type: 'object',
	properties: {
		[PROFILER_VIEW_TEMPLATE_SETTINGS]: profilerViewTemplateSchema
	}
};

configurationRegistry.registerConfiguration(dashboardConfig);
