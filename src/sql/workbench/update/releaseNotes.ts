/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import pkg from 'vs/platform/node/package';
import product from 'vs/platform/node/product';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { AbstractShowReleaseNotesAction } from 'vs/workbench/parts/update/electron-browser/update';

export class OpenGettingStartedInBrowserAction extends Action {

	constructor(
		@IOpenerService private openerService: IOpenerService
	) {
		super('update.openGettingStartedGuide', nls.localize('gettingStarted', "Get Started"), null, true);
	}

	run(): TPromise<any> {
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
		super(id, label, pkg.version, instantiationService);
	}
}
