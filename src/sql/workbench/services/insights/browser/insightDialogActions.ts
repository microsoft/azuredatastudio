/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsightDialogActionContext } from 'sql/workbench/services/insights/browser/insightsDialogService';

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
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

	public async run(event?: IInsightDialogActionContext): Promise<void> {
		await this._clipboardService.writeText(event.cellData);
	}
}
