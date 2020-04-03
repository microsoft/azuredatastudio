/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ICommandService, ICommandEvent } from 'vs/platform/commands/common/commands';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';

export class SqlTelemetryContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IStorageService storageService: IStorageService,
		@ICommandService commandService: ICommandService
	) {
		super();

		this._register(
			commandService.onWillExecuteCommand(
				(e: ICommandEvent) => {
					// Filter out high-frequency events
					if (!['type',
						'deleteLeft', 'deleteRight',
						'deleteWordLeft', 'deleteWordRight', 'deleteWordStartRight', 'deleteWordEndRight',
						'setContext',
						'cut', 'paste', 'undo',
						'tab',
						'selectNextSuggestion'].some(id => id === e.commandId) &&
						// Events from src\vs\editor\contrib\wordOperations\wordOperations.ts
						!e.commandId.startsWith('cursor')) {
						telemetryService.sendActionEvent(TelemetryView.Shell, 'adsCommandExecuted', e.commandId);
					}
				}));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SqlTelemetryContribution, LifecyclePhase.Starting);
