/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICommandService, ICommandEvent } from 'vs/platform/commands/common/commands';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';

export class SqlTelemetryContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@ICommandService commandService: ICommandService
	) {
		super();

		this._register(
			commandService.onWillExecuteCommand(
				(e: ICommandEvent) => {
					// Filter out high-frequency events
					if (!['type', 'cursorUp', 'cursorDown', 'cursorRight', 'cursorLeft', 'deleteLeft', 'deleteRight'].find(id => id === e.commandId)) {
						telemetryService.sendActionEvent(TelemetryView.Shell, 'adsCommandExecuted', e.commandId);
					}
				}));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SqlTelemetryContribution, LifecyclePhase.Starting);
