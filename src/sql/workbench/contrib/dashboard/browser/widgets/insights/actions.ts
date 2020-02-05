/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { InsightActionContext } from 'sql/workbench/browser/actions';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { isString } from 'vs/base/common/types';

export class RunInsightQueryAction extends Action {
	public static ID = 'runQuery';
	public static LABEL = nls.localize('insights.runQuery', "Run Query");

	constructor(
		id: string, label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextResourcePropertiesService private _textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(id, label);
	}

	public run(context: InsightActionContext): Promise<boolean> {
		let queryString: string = undefined;
		let eol: string = this._textResourcePropertiesService.getEOL(undefined);
		if (context.insight && context.insight.query) {
			if (isString(context.insight.query)) {
				queryString = context.insight.query;
			} else {
				queryString = context.insight.query.join(eol);
			}
		} else {
			return Promise.resolve(false);
		}
		return this.instantiationService.invokeFunction(openNewQuery, context.profile, queryString,
			RunQueryOnConnectionMode.executeQuery).then(() => true, () => false);
	}
}
