/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';

export class RunCellAction extends Action {
	public static ID = 'jobaction.notebookRunCell';
	public static LABEL = 'Run cell';

	constructor(
	) {
		super(RunCellAction.ID, '', 'toolbarIconRun');
		this.tooltip = 'Run cell';
	}

	public run(context: any): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}