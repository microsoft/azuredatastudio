/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { InsightActionContext } from 'sql/workbench/browser/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { isString } from 'vs/base/common/types';
import { openNewQuery } from 'sql/workbench/services/query/browser/query';

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

	public async run(context: InsightActionContext): Promise<boolean> {
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

		try {
			const input = await this.instantiationService.invokeFunction(openNewQuery, context.profile, queryString);
			input.runQuery();
			return true;
		} catch (e) {
			return false;
		}
	}
}
