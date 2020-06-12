/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { developers } from 'sql/workbench/contrib/onboarding/common/developers';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IOnboardingService } from 'sql/workbench/contrib/onboarding/common/interfaces';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';

import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Action } from 'vs/base/common/actions';

class ShowDevelopersActions extends Action {
	static readonly ID = 'onboarding.showDevelopers';
	static readonly LABEL = 'Show Developers';

	constructor(
		id: string,
		label: string,
		@INotificationService private notificationService: INotificationService
	) {
		super(id, label);
	}

	async run(): Promise<void> {
		this.notificationService.info(developers.join('\n'));
	}
}

export class OnboardingService implements IOnboardingService {
	_serviceBrand: undefined;

	constructor(
		@IEnvironmentService private environmentService: IEnvironmentService,
	) {
		if (this.environmentService.isBuilt === true) {
			return;
		}

		this.registerWorkbenchContribution();
	}

	private registerWorkbenchContribution() {
		const registry = Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions);
		const onboardingCategory = 'Onboarding';
		registry.registerWorkbenchAction(SyncActionDescriptor.from(ShowDevelopersActions), 'Onboarding: Show Developers', onboardingCategory);
	}
}



