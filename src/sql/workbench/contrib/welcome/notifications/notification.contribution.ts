/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { NotifyEncryptionDialog } from 'sql/workbench/contrib/welcome/notifications/notifyEncryptionDialog'
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { NotifyTenantInfoDialog } from 'sql/workbench/contrib/welcome/notifications/notifyTenantInfoDialog';

export class Notification extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();

		const tenantDialog = this._instantiationService.createInstance(NotifyTenantInfoDialog);
		tenantDialog.render();
		tenantDialog.open();

		const encryptionDialog = this._instantiationService.createInstance(NotifyEncryptionDialog);
		encryptionDialog.render();
		encryptionDialog.open();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(Notification, LifecyclePhase.Starting);
