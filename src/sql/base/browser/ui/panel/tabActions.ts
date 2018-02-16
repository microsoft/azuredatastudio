/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';

export class CloseTabAction extends Action {
	private static readonly ID = 'closeTab';
	private static readonly LABEL = nls.localize('closeTab', "Close");
	private static readonly ICON = 'close';

	constructor(
		private closeFn: () => void,
		private context: any // this
	) {
		super(CloseTabAction.ID, CloseTabAction.LABEL, CloseTabAction.ICON);
	}

	run(): TPromise<boolean> {
		try {
			this.closeFn.apply(this.context);
			return TPromise.as(true);
		} catch (e) {
			return TPromise.as(false);
		}
	}
}