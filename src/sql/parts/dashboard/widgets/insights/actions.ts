/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';

import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { RunQueryOnConnectionMode, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { InsightActionContext } from 'sql/workbench/common/actions';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class RunInsightQueryAction extends Action {
	public static ID = 'runQuery';
	public static LABEL = nls.localize('insights.runQuery', "Run Query");

	constructor(
		id: string, label: string,
		@IQueryEditorService protected _queryEditorService: IQueryEditorService,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService protected _objectExplorerService: IObjectExplorerService,
		@IEditorService protected _workbenchEditorService: IEditorService
	) {
		super(id, label);
	}

	public run(context: InsightActionContext): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			TaskUtilities.newQuery(
				context.profile,
				this._connectionManagementService,
				this._queryEditorService,
				this._objectExplorerService,
				this._workbenchEditorService,
				context.insight.query as string,
				RunQueryOnConnectionMode.executeQuery
			).then(() => resolve(true), () => resolve(false));
		});
	}
}