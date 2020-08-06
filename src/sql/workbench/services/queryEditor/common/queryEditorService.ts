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

export interface INewSqlEditorOptions {
	initalContent?: string;
	/**
	 * Defaults based on user configuration
	 */
	dirty?: boolean;
	description?: string;
	/**
	 * defaults to true
	 */
	open?: boolean;
	/**
	 * use an existing resource, if this matches a resource already open that resource will be opened instead
	 */
	resource?: URI
}

export interface IQueryEditorService {

	_serviceBrand: undefined;

	// Creates new untitled document for SQL queries and opens it in a new editor tab
	newSqlEditor(options?: INewSqlEditorOptions): Promise<IConnectableInput>;

	// Creates new edit data session
	newEditDataEditor(schemaName: string, tableName: string, queryString: string): Promise<IConnectableInput>;
}
