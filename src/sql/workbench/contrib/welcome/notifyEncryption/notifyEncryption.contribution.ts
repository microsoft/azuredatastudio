/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { NotifyEncryptionDialog } from 'sql/workbench/contrib/welcome/notifyEncryption/notifyEncryptionDialog'
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class NotifyEncryption extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();
		const dialog = this._instantiationService.createInstance(NotifyEncryptionDialog);
		dialog.render();
		dialog.open();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotifyEncryption, LifecyclePhase.Starting);
