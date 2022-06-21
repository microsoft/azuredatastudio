/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlExtHostContext, SqlMainContext, ExtHostQueryEditorShape, MainThreadQueryEditorShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import * as azdata from 'azdata';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ILogService } from 'vs/platform/log/common/log';
import { URI } from 'vs/base/common/uri';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { Range } from 'vs/editor/common/core/range';
import { IExtHostQueryEvent } from 'sql/workbench/api/common/sqlExtHostTypes';

@extHostNamedCustomer(SqlMainContext.MainThreadQueryEditor)
export class MainThreadQueryEditor extends Disposable implements MainThreadQueryEditorShape {

	private _proxy: ExtHostQueryEditorShape;
	private _queryEventListenerDisposables = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IEditorService private _editorService: IEditorService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@ILogService private _logService: ILogService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IModelService private _modelService: IModelService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostQueryEditor);
		}
	}

	public $connect(fileUri: string, connectionId: string): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			let editors = this._editorService.visibleEditorPanes.filter(resource => {
				return !!resource && resource.input.resource.toString() === fileUri;
			});
			let editor = editors && editors.length > 0 ? editors[0] : undefined;
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: editor ? editor.input as any : undefined },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true,
			};
			if (connectionId) {
				let connection = this._connectionManagementService.getActiveConnections().filter(c => c.id === connectionId);
				if (connection && connection.length > 0) {
					this._connectionManagementService.connect(connection[0], fileUri, options).then(() => {
						resolve();
					}).catch(error => {
						reject(error);
					});
				} else {
					resolve();
				}
			} else {
				resolve();
			}
		});
	}

	private static connectionProfileToIConnectionProfile(connection: azdata.connection.ConnectionProfile): IConnectionProfile {
		let profile: ConnectionProfile = new ConnectionProfile(undefined, undefined);
		profile.options = connection.options;
		profile.providerName = connection.options['providerName'];
		return profile.toIConnectionProfile();
	}

	public $connectWithProfile(fileUri: string, connection: azdata.connection.ConnectionProfile): Thenable<void> {
		return new Promise<void>(async (resolve, reject) => {
			let editors = this._editorService.visibleEditorPanes.filter(resource => {
				return !!resource && resource.input.resource.toString() === fileUri;
			});
			let editor = editors && editors.length > 0 ? editors[0] : undefined;

			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none, input: editor ? editor.input as any : undefined },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: false,
				showFirewallRuleOnError: false,
			};

			let profile: IConnectionProfile = MainThreadQueryEditor.connectionProfileToIConnectionProfile(connection);
			let connectionResult = await this._connectionManagementService.connect(profile, fileUri, options);
			if (connectionResult && connectionResult.connected) {
				this._logService.info(`editor ${fileUri} connected`);
			}
		});
	}

	public $runQuery(fileUri: string, runCurrentQuery: boolean = true): void {
		let filteredEditors = this._editorService.visibleEditorPanes.filter(editor => editor.input.resource.toString() === fileUri);
		if (filteredEditors && filteredEditors.length > 0) {
			let editor = filteredEditors[0];
			if (editor instanceof QueryEditor) {
				let queryEditor: QueryEditor = editor;
				if (runCurrentQuery) {
					queryEditor.runCurrentQuery().catch((e) => this._logService.error(e));
				} else {
					queryEditor.runQuery().catch((e) => this._logService.error(e));
				}
			}
		}
	}

	public $registerQueryInfoListener(handle: number): void {
		const disposable = this._queryModelService.onQueryEvent(event => {
			let connectionProfile = this._connectionManagementService.getConnectionProfile(event.uri);
			const uri: URI = URI.parse(event.uri);
			const model = this._modelService.getModel(uri);
			// Get the query text from the model - we do it here so we can send the query text for all events
			// to the extension host from one place
			let queryText: string | undefined = undefined;
			if (model) {
				// VS Range is 1 based so offset values by 1. The endLine we get back from SqlToolsService is incremented
				// by 1 from the original input range sent in as well so take that into account and don't modify
				queryText = event.queryInfo.range.length > 0 ?
					model.getValueInRange(new Range(
						event.queryInfo.range[0].startLineNumber,
						event.queryInfo.range[0].startColumn,
						event.queryInfo.range[0].endLineNumber,
						event.queryInfo.range[0].endColumn)) :
					// If no specific selection get the entire text
					model.getValue();
			}
			// Convert into an IExtHostQueryEvent with the properties it expects
			const extHostEvent: IExtHostQueryEvent = {
				type: event.type,
				uri: event.uri,
				params: event.params,
				queryInfo: {
					messages: event.queryInfo.messages,
					queryText
				}
			};
			this._proxy.$onQueryEvent(connectionProfile?.providerName, handle, event.uri, extHostEvent);
		});
		this._queryEventListenerDisposables.set(handle, disposable);
	}

	public $unregisterQueryInfoListener(handle: number): void {
		const disposable = this._queryEventListenerDisposables.get(handle);
		if (disposable) {
			disposable.dispose();
			this._queryEventListenerDisposables.delete(handle);
		}
	}

	public $createQueryTab(fileUri: string, title: string, componentId: string): void {
		let editors = this._editorService.visibleEditorPanes.filter(resource => {
			return !!resource && resource.input.resource.toString() === fileUri;
		});

		let editor = editors && editors.length > 0 ? editors[0] : undefined;
		if (editor) {
			let queryEditor = editor as QueryEditor;
			if (queryEditor) {
				queryEditor.registerQueryModelViewTab(title, componentId);
			}
		}
	}

	public $setQueryExecutionOptions(fileUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		return this._queryManagementService.setQueryExecutionOptions(fileUri, options);
	}

	public async $createQueryDocument(options?: { content?: string }, providerId?: string): Promise<URI> {
		const queryInput = await this._queryEditorService.newSqlEditor({ initalContent: options.content }, providerId);
		return queryInput.resource;
	}
}
