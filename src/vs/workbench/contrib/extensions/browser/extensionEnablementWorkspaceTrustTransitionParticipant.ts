/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkspaceTrustManagementService, IWorkspaceTrustTransitionParticipant } from 'vs/platform/workspace/common/workspaceTrust';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IWorkbenchExtensionEnablementService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IHostService } from 'vs/workbench/services/host/browser/host';

export class ExtensionEnablementWorkspaceTrustTransitionParticipant extends Disposable implements IWorkbenchContribution {
	constructor(
		@IExtensionService extensionService: IExtensionService,
		@IHostService hostService: IHostService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IWorkbenchExtensionEnablementService extensionEnablementService: IWorkbenchExtensionEnablementService,
		@IWorkspaceTrustManagementService workspaceTrustManagementService: IWorkspaceTrustManagementService,
	) {
		super();

		if (workspaceTrustManagementService.workspaceTrustEnabled) {
			// The extension enablement participant will be registered only after the
			// workspace trust state has been initialized. There is no need to execute
			// the participant as part of the initialization process, as the workspace
			// trust state is initialized before starting the extension host.
			workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
				const workspaceTrustTransitionParticipant = new class implements IWorkspaceTrustTransitionParticipant {
					async participate(trusted: boolean): Promise<void> {
						if (trusted) {
							// Untrusted -> Trusted
							await extensionEnablementService.updateEnablementByWorkspaceTrustRequirement();
						} else {
							// Trusted -> Untrusted
							if (environmentService.remoteAuthority) {
								hostService.reload();
							} else {
								extensionService.stopExtensionHosts();
								await extensionEnablementService.updateEnablementByWorkspaceTrustRequirement();
								extensionService.startExtensionHosts();
							}
						}
					}
				};

				// Execute BEFORE the workspace trust transition completes
				this._register(workspaceTrustManagementService.addWorkspaceTrustTransitionParticipant(workspaceTrustTransitionParticipant));
			});
		}
	}
}
