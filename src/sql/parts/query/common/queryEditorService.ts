/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectableInput } from 'sql/parts/connection/common/connectionManagement';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { QueryEditorService } from 'sql/parts/query/services/queryEditorService';

export interface IQueryEditorOptions extends IEditorOptions {

	// Tells IQueryEditorService.queryEditorCheck to not open this input in the QueryEditor.
	// Used when the user changes the Language Mode to not-SQL for files with .sql extensions.
	denyQueryEditor?: boolean;
}

export const IQueryEditorService = createDecorator<QueryEditorService>('QueryEditorService');

export interface IQueryEditorService {

	_serviceBrand: any;

	// Creates new untitled document for SQL queries and opens it in a new editor tab
	newSqlEditor(sqlContent?: string, connectionProviderName?: string): Promise<IConnectableInput>;

	// Creates a new query plan document
	newQueryPlanEditor(xmlShowPlan: string): Promise<any>;

	// Creates new edit data session
	newEditDataEditor(schemaName: string, tableName: string): Promise<IConnectableInput>;

	// Clears any QueryEditor data for the given URI held by this service
	onQueryInputClosed(uri: string): void;
}