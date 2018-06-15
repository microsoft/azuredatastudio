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
import { PROFILER_SESSION_TEMPLATE_SETTINGS, IProfilerSessionTemplate } from 'sql/parts/profiler/service/interfaces';

const profilerDescriptor = new EditorDescriptor(
	ProfilerEditor,
	ProfilerEditor.ID,
	'ProfilerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(profilerDescriptor, [new SyncDescriptor(ProfilerInput)]);

const profilerSessionTemplateSchema: IJSONSchema = {
	description: nls.localize('profiler.settings.sessionTemplates', "Specifies session templates"),
	type: 'array',
	items: <IJSONSchema>{
		type: 'object',
		properties: {
			name: {
				type: 'string'
			}
		}
	},
	default: <Array<IProfilerSessionTemplate>>[
		{
			name: 'Standard',
			events: [
				{
					name: 'Audit Login',
					optionalColumns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'ClientProcessID', 'SPID', 'StartTime', 'BinaryData']
				},
				{
					name: 'Audit Logout',
					optionalColumns: ['ApplicationName', 'NTUserName', 'LoginName', 'CPU', 'Reads', 'Writes', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime']
				},
				{
					name: 'ExistingConnection',
					optionalColumns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime', 'BinaryData']
				},
				{
					name: 'RPC:Completed',
					optionalColumns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'CPU', 'Reads', 'Writes', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime', 'BinaryData']
				},
				{
					name: 'SQL:BatchCompleted',
					optionalColumns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'CPU', 'Reads', 'Writes', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime', 'BinaryData']
				},
				{
					name: 'SQL:BatchStarting',
					optionalColumns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'ClientProcessID', 'SPID', 'StartTime']
				}
			],
			view: {
				events: [
					{
						name: 'Audit Login',
						columns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'ClientProcessID', 'SPID', 'StartTime']
					},
					{
						name: 'Audit Logout',
						columns: ['ApplicationName', 'NTUserName', 'LoginName', 'CPU', 'Reads', 'Writes', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime']
					},
					{
						name: 'ExistingConnection',
						columns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'ClientProcessID', 'SPID', 'StartTime']
					},
					{
						name: 'RPC:Completed',
						columns: ['ApplicationName', 'NTUserName', 'LoginName', 'CPU', 'Reads', 'Writes', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime', 'BinaryData']
					},
					{
						name: 'SQL:BatchCompleted',
						columns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'CPU', 'Reads', 'Writes', 'Duration', 'ClientProcessID', 'SPID', 'StartTime', 'EndTime', 'BinaryData']
					},
					{
						name: 'SQL:BatchStarting',
						columns: ['TextData', 'ApplicationName', 'NTUserName', 'LoginName', 'ClientProcessID', 'SPID', 'StartTime']
					}
				]
			}
		}
	]
};

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
const dashboardConfig: IConfigurationNode = {
	id: 'Profiler',
	type: 'object',
	properties: {
		[PROFILER_SESSION_TEMPLATE_SETTINGS]: profilerSessionTemplateSchema
	}
};

configurationRegistry.registerConfiguration(dashboardConfig);
