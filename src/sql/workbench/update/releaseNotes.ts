/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import { IMessageService, CloseAction, Severity } from 'vs/platform/message/common/message';
import pkg from 'vs/platform/node/package';
import product from 'vs/platform/node/product';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ReleaseNotesInput } from 'vs/workbench/parts/update/electron-browser/releaseNotesInput';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import URI from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { AbstractShowReleaseNotesAction, loadReleaseNotes } from 'vs/workbench/parts/update/electron-browser/update';

export class OpenGettingStartedInBrowserAction extends Action {

	constructor(
		@IOpenerService private openerService: IOpenerService
	) {
		super('update.openGettingStartedGuide', nls.localize('gettingStarted', "Get Started"), null, true);
	}

	run(): TPromise<any> {
		const uri = URI.parse(product.releaseNotesUrl);
		return this.openerService.open(uri);
	}
}

export class ShowCurrentReleaseNotesAction extends AbstractShowReleaseNotesAction {

	static ID = 'update.showCurrentCarbonReleaseNotes';
	static LABEL = nls.localize('showReleaseNotes', "Show Getting Started");

	constructor(
		id = ShowCurrentReleaseNotesAction.ID,
		label = ShowCurrentReleaseNotesAction.LABEL,
		@IWorkbenchEditorService editorService: IWorkbenchEditorService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(id, label, pkg.version, editorService, instantiationService);
	}
}

export class ProductContribution implements IWorkbenchContribution {

	private static KEY = 'releaseNotes/carbonLastVersion';
	getId() { return 'carbon.product'; }

	constructor(
		@IStorageService storageService: IStorageService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IMessageService messageService: IMessageService,
		@IWorkbenchEditorService editorService: IWorkbenchEditorService
	) {
		const lastVersion = storageService.get(ProductContribution.KEY, StorageScope.GLOBAL, '');

		// was there an update? if so, open release notes
		if (product.releaseNotesUrl && pkg.version !== lastVersion) {
			instantiationService.invokeFunction(loadReleaseNotes, pkg.version).then(
				text => editorService.openEditor(instantiationService.createInstance(ReleaseNotesInput, pkg.version, text), { pinned: true }),
				() => {
					messageService.show(Severity.Info, {
						message: nls.localize('read the release notes', "Welcome to {0} February Public Preview! Would you like to view the Getting Started Guide?", product.nameLong, pkg.version),
						actions: [
							instantiationService.createInstance(OpenGettingStartedInBrowserAction),
							CloseAction
						]
					});
				});
		}

		storageService.store(ProductContribution.KEY, pkg.version, StorageScope.GLOBAL);
	}
}
