/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryPlan2 } from 'sql/workbench/contrib/queryplan2/browser/queryPlan';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';


export class PropertiesAction extends Action {
	public static ID = 'qp.propertiesAction';
	public static LABEL = localize('queryPlanPropertiesActionLabel', "Properties");

	constructor() {
		super(PropertiesAction.ID, PropertiesAction.LABEL, Codicon.listUnordered.classNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.propContainer.style.visibility = context.propContainer.style.visibility === 'visible' ? 'hidden' : 'visible';
	}
}
