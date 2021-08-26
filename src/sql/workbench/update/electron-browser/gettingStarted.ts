/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import { Action } from 'vs/base/common/actions';
import product from 'vs/platform/product/common/product';
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';

export class ShowGettingStartedAction extends Action {
	static ID = 'update.showGettingStarted';
	static LABEL = nls.localize('showReleaseNotes', "Show Getting Started");

	constructor(
		id = ShowGettingStartedAction.ID,
		label = ShowGettingStartedAction.LABEL,
		@IOpenerService private openerService: IOpenerService
	) {
		super(id, label, undefined, true);
	}

	override run(): Promise<any> {
		const uri = URI.parse(product.gettingStartedUrl);
		return this.openerService.open(uri);
	}
}

MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
	group: '1_welcome',
	command: {
		id: ShowGettingStartedAction.ID,
		title: nls.localize({ key: 'miGettingStarted', comment: ['&& denotes a mnemonic'] }, "Getting &&Started")
	},
	order: 1
});
