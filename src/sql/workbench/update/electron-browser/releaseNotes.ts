/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import { Action } from 'vs/base/common/actions';
import product from 'vs/platform/product/common/product';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { AbstractShowReleaseNotesAction } from 'vs/workbench/contrib/update/browser/update';

export class OpenGettingStartedInBrowserAction extends Action {

	constructor(
		@IOpenerService private openerService: IOpenerService
	) {
		super('update.openGettingStartedGuide', nls.localize('gettingStarted', "Get Started"), undefined, true);
	}

	run(): Promise<any> {
		const uri = URI.parse(product.gettingStartedUrl);
		return this.openerService.open(uri);
	}
}

export class ShowCurrentReleaseNotesAction extends AbstractShowReleaseNotesAction {

	static ID = 'update.showGettingStarted';
	static LABEL = nls.localize('showReleaseNotes', "Show Getting Started");

	constructor(
		id = ShowCurrentReleaseNotesAction.ID,
		label = ShowCurrentReleaseNotesAction.LABEL,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(id, label, product.version, instantiationService);
	}
}

MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
	group: '1_welcome',
	command: {
		id: ShowCurrentReleaseNotesAction.ID,
		title: nls.localize({ key: 'miGettingStarted', comment: ['&& denotes a mnemonic'] }, "Getting &&Started")
	},
	order: 1
});
