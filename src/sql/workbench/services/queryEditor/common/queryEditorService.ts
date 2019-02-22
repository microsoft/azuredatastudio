/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectableInput } from 'sql/platform/connection/common/connectionManagement';
import { IEditorOptions } from 'vs/platform/editor/common/editor';

import { URI } from 'vs/base/common/uri';

export interface IQueryEditorOptions extends IEditorOptions {

	// Tells IQueryEditorService.queryEditorCheck to not open this input in the QueryEditor.
	// Used when the user changes the Language Mode to not-SQL for files with .sql extensions.
	denyQueryEditor?: boolean;
}

export const IQueryEditorService = createDecorator<IQueryEditorService>('QueryEditorService');

export interface IQueryEditorService {

	_serviceBrand: any;

	// Creates new untitled document for SQL queries and opens it in a new editor tab
	newSqlEditor(sqlContent?: string, connectionProviderName?: string, isDirty?: boolean): Promise<IConnectableInput>;

	// Creates a new query plan document
	newQueryPlanEditor(xmlShowPlan: string): Promise<any>;

	// Creates new edit data session
	newEditDataEditor(schemaName: string, tableName: string, queryString: string): Promise<IConnectableInput>;

	/**
	 * Handles updating of SQL files on a save as event. These need special consideration
	 * due to query results and other information being tied to the URI of the file
	 * @param {URI} oldResource URI of the file before the save as was completed
	 * @param {URI} newResource URI of the file after the save as operation was completed
	 * @memberof IQueryEditorService
	 */
	onSaveAsCompleted(oldResource: URI, newResource: URI): void;
}