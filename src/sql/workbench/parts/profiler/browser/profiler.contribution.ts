/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import * as nls from 'vs/nls';

import { ProfilerInput } from 'sql/workbench/parts/profiler/browser/profilerInput';
import { ProfilerEditor } from 'sql/workbench/parts/profiler/browser/profilerEditor';
import { PROFILER_VIEW_TEMPLATE_SETTINGS, PROFILER_SESSION_TEMPLATE_SETTINGS, IProfilerViewTemplate, IProfilerSessionTemplate, EngineType, PROFILER_FILTER_SETTINGS } from 'sql/workbench/services/profiler/browser/interfaces';

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
					eventsMapped: ['options_text', 'batch_text', 'statement']
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
					name: 'DatabaseID',
					eventsMapped: ['database_id']
				},
				{
					name: 'DatabaseName',
					eventsMapped: ['database_name']
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
					eventsMapped: ['options_text', 'batch_text', 'statement']
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
					name: 'DatabaseID',
					eventsMapped: ['database_id']
				},
				{
					name: 'DatabaseName',
					eventsMapped: ['database_name']
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
					eventsMapped: ['options_text', 'batch_text', 'statement']
				},
				{
					name: 'Duration',
					eventsMapped: ['duration']
				},
				{
					name: 'SPID',
					eventsMapped: ['session_id']
				},
				{
					name: 'DatabaseID',
					eventsMapped: ['database_id']
				},
				{
					name: 'DatabaseName',
					eventsMapped: ['database_name']
				},
				{
					name: 'ObjectType',
					eventsMapped: ['object_type']
				},
				{
					name: 'LoginName',
					eventsMapped: ['server_principal_name']
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
					eventsMapped: ['options_text', 'batch_text', 'statement']
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
					name: 'DatabaseID',
					eventsMapped: ['database_id']
				},
				{
					name: 'DatabaseName',
					eventsMapped: ['database_name']
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
					eventsMapped: ['options_text', 'batch_text', 'statement']
				},
				{
					name: 'SPID',
					eventsMapped: ['session_id']
				},
				{
					name: 'DatabaseID',
					eventsMapped: ['database_id']
				},
				{
					name: 'DatabaseName',
					eventsMapped: ['database_name']
				}
			]
		}
	]
};

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
			name: 'Standard_OnPrem',
			defaultView: 'Standard View',
			engineTypes: [EngineType.Standalone],
			createStatement:
				`CREATE EVENT SESSION [{sessionName}] ON SERVER
					ADD EVENT sqlserver.attention(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.nt_username,sqlserver.query_hash,sqlserver.server_principal_name,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.existing_connection(SET collect_options_text=(1)
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.nt_username,sqlserver.server_principal_name,sqlserver.session_id)),
					ADD EVENT sqlserver.login(SET collect_options_text=(1)
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.nt_username,sqlserver.server_principal_name,sqlserver.session_id)),
					ADD EVENT sqlserver.logout(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.nt_username,sqlserver.server_principal_name,sqlserver.session_id)),
					ADD EVENT sqlserver.rpc_completed(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.database_name,sqlserver.nt_username,sqlserver.query_hash,sqlserver.server_principal_name,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.sql_batch_completed(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.database_name,sqlserver.nt_username,sqlserver.query_hash,sqlserver.server_principal_name,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.sql_batch_starting(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.database_name,sqlserver.nt_username,sqlserver.query_hash,sqlserver.server_principal_name,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0))))
					ADD TARGET package0.ring_buffer(SET max_events_limit=(1000),max_memory=(51200))
					WITH (MAX_MEMORY=8192 KB,EVENT_RETENTION_MODE=ALLOW_SINGLE_EVENT_LOSS,MAX_DISPATCH_LATENCY=5 SECONDS,MAX_EVENT_SIZE=0 KB,MEMORY_PARTITION_MODE=PER_CPU,TRACK_CAUSALITY=ON,STARTUP_STATE=OFF)`
		},
		{
			name: 'Standard_Azure',
			engineTypes: [EngineType.AzureSQLDB],
			defaultView: 'Standard View',
			createStatement:
				`CREATE EVENT SESSION [{sessionName}] ON DATABASE
					ADD EVENT sqlserver.attention(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.username,sqlserver.query_hash,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.existing_connection(SET collect_options_text=(1)
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.username,sqlserver.session_id)),
					ADD EVENT sqlserver.login(SET collect_options_text=(1)
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.username,sqlserver.session_id)),
					ADD EVENT sqlserver.logout(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.username,sqlserver.session_id)),
					ADD EVENT sqlserver.rpc_completed(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.username,sqlserver.query_hash,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.sql_batch_completed(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.username,sqlserver.query_hash,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.sql_batch_starting(
						ACTION(package0.event_sequence,sqlserver.client_app_name,sqlserver.client_pid,sqlserver.database_id,sqlserver.username,sqlserver.query_hash,sqlserver.session_id)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0))))
					ADD TARGET package0.ring_buffer(SET max_events_limit=(1000),max_memory=(51200))
					WITH (MAX_MEMORY=8192 KB,EVENT_RETENTION_MODE=ALLOW_SINGLE_EVENT_LOSS,MAX_DISPATCH_LATENCY=5 SECONDS,MAX_EVENT_SIZE=0 KB,MEMORY_PARTITION_MODE=PER_CPU,TRACK_CAUSALITY=ON,STARTUP_STATE=OFF)`
		},
		{
			name: 'TSQL_OnPrem',
			engineTypes: [EngineType.Standalone],
			defaultView: 'TSQL View',
			createStatement:
				`CREATE EVENT SESSION [{sessionName}] ON SERVER
					ADD EVENT sqlserver.existing_connection(
						ACTION(package0.event_sequence,sqlserver.session_id,sqlserver.client_hostname)),
					ADD EVENT sqlserver.login(SET collect_options_text=(1)
						ACTION(package0.event_sequence,sqlserver.session_id,sqlserver.client_hostname)),
					ADD EVENT sqlserver.logout(
						ACTION(package0.event_sequence,sqlserver.session_id)),
					ADD EVENT sqlserver.rpc_starting(
						ACTION(package0.event_sequence,sqlserver.session_id,sqlserver.database_id,sqlserver.database_name)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0)))),
					ADD EVENT sqlserver.sql_batch_starting(
						ACTION(package0.event_sequence,sqlserver.session_id,sqlserver.database_id,sqlserver.database_name)
						WHERE ([package0].[equal_boolean]([sqlserver].[is_system],(0))))
					ADD TARGET package0.ring_buffer(SET max_events_limit=(1000),max_memory=(51200))
					WITH (MAX_MEMORY=8192 KB,EVENT_RETENTION_MODE=ALLOW_SINGLE_EVENT_LOSS,MAX_DISPATCH_LATENCY=5 SECONDS,MAX_EVENT_SIZE=0 KB,MEMORY_PARTITION_MODE=PER_CPU,TRACK_CAUSALITY=ON,STARTUP_STATE=OFF)`
		}
	]
};

const profilerFiltersSchema: IJSONSchema = {
	description: nls.localize('profiler.settings.Filters', "Profiler Filters"),
	type: 'array'
};

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
const profilerConfig: IConfigurationNode = {
	id: 'Profiler',
	type: 'object',
	properties: {
		[PROFILER_VIEW_TEMPLATE_SETTINGS]: profilerViewTemplateSchema,
		[PROFILER_SESSION_TEMPLATE_SETTINGS]: profilerSessionTemplateSchema,
		[PROFILER_FILTER_SETTINGS]: profilerFiltersSchema
	}
};

configurationRegistry.registerConfiguration(profilerConfig);
