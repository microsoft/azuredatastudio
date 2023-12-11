/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import product from 'vs/platform/product/common/product';
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { MenuRegistry, MenuId, Action2 } from 'vs/platform/actions/common/actions';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';

export class ShowGettingStartedAction extends Action2 {
	static ID = 'update.showGettingStarted';
	static LABEL_ORG = 'Show Getting Started';
	static LABEL = nls.localize('showReleaseNotes', "Show Getting Started");

	constructor() {
		super({
			id: ShowGettingStartedAction.ID,
			title: {
				value: ShowGettingStartedAction.LABEL,
				original: ShowGettingStartedAction.LABEL_ORG
			}
		});
	}

	override run(accessor: ServicesAccessor): Promise<any> {
		const openerService = accessor.get(IOpenerService);
		const uri = URI.parse(product.gettingStartedUrl);
		return openerService.open(uri);
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
