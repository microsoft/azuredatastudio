/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';

export class RefreshWidgetAction extends Action {

	public static ID = 'refreshWidget';
	public static LABEL = nls.localize('refreshWidget', 'Refresh');

	constructor(
		id: string, label: string,
		private refreshFn: () => void
	) {
		super(id, label);
	}

	run(): TPromise<boolean> {
		try {
			this.refreshFn();
			return TPromise.as(true);
		} catch (e) {
			return TPromise.as(false);
		}
	}
}
