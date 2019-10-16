/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';

import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { InsightActionContext } from 'sql/workbench/browser/actions';
import { openNewQuery } from 'sql/workbench/parts/query/browser/queryActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class RunInsightQueryAction extends Action {
	public static ID = 'runQuery';
	public static LABEL = nls.localize('insights.runQuery', "Run Query");

	constructor(
		id: string, label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(context: InsightActionContext): Promise<boolean> {
		return this.instantiationService.invokeFunction(openNewQuery, context.profile, undefined, RunQueryOnConnectionMode.executeQuery).then(() => true, () => false);
	}
}
