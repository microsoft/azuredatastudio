/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsightDialogActionContext } from 'sql/workbench/services/insights/common/insightsDialogService';

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export class CopyInsightDialogSelectionAction extends Action {
	public static ID = 'workbench.action.insights.copySelection';
	public static LABEL = nls.localize('workbench.action.insights.copySelection', "Copy Cell");

	constructor(
		id: string, label: string,
		@IClipboardService private _clipboardService: IClipboardService
	) {
		super(id, label);
	}

	public run(event?: IInsightDialogActionContext): TPromise<any> {
		this._clipboardService.writeText(event.cellData);
		return TPromise.as(void 0);
	}
}
