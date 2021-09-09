/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryEditorService, INewSqlEditorOptions } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectableInput } from 'sql/platform/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledQueryEditorInput } from 'sql/base/query/browser/untitledQueryEditorInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledQueryEditorInput } from 'sql/base/query/common/untitledQueryEditorInput';

export class TestQueryEditorService implements IQueryEditorService {
	_serviceBrand: undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService) {
	}

	newSqlEditor(options?: INewSqlEditorOptions): Promise<IUntitledQueryEditorInput> {
		const base = this.editorService.createEditorInput({ forceUntitled: true }) as UntitledTextEditorInput;
		return Promise.resolve(this.instantiationService.createInstance(UntitledQueryEditorInput, '', base, new QueryResultsInput(base.resource.toString(true))));
	}

	newEditDataEditor(schemaName: string, tableName: string, queryString: string): Promise<IConnectableInput> {
		throw new Error('Method not implemented.');
	}
}
