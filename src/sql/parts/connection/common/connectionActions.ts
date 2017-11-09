/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';

import nls = require('vs/nls');
import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { IQuickOpenService } from 'vs/platform/quickOpen/common/quickOpen';

/**
 * Locates the active editor and calls runQuery() on the editor if it is a QueryEditor.
 */
export class ClearRecentConnectionsAction extends Action {

	public static ID = 'clearRecentConnectionsAction';
	public static LABEL = nls.localize('ClearRecentlyUsedLabel', 'Clear Recent Connections List');

	constructor(
		id: string,
		label: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IMessageService private _messageService: IMessageService,
		@IQuickOpenService private _quickOpenService: IQuickOpenService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		let self = this;
		return self.promptToClearRecentConnectionsList().then(result => {
			if (result) {
				self._connectionManagementService.clearRecentConnectionsList();
				self._messageService.show(Severity.Info, nls.localize('ClearedRecentConnections', 'Recent connections list cleared'));
			}
		});
	}

	private promptToClearRecentConnectionsList(): TPromise<boolean> {
		const self = this;
		return new TPromise<boolean>((resolve, reject) => {
			let choices: { key, value }[] = [
				{ key: nls.localize('yes', 'Yes'), value: true },
				{ key: nls.localize('no', 'No'), value: false }
			];

			self._quickOpenService.pick(choices.map(x => x.key), { placeHolder: nls.localize('ClearRecentlyUsedLabel', 'Clear Recent Connections List'), ignoreFocusLost: true }).then((choice) => {
				let confirm = choices.find(x => x.key === choice);
				resolve(confirm && confirm.value);
			});
		});
	}
}
