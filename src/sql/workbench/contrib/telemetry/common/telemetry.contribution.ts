/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ICommandService, ICommandEvent } from 'vs/platform/commands/common/commands';
import { TelemetryAction, TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { Handler } from 'vs/editor/common/editorCommon';

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
					if (![
						'deleteLeft', 'deleteRight', 'lineBreakInsert', 'outdent', 'redo', 'tab', 'undo', 'deleteInsideWord', // From src\vs\editor\browser\coreCommands.ts
						'setContext',
						Handler.CompositionEnd, Handler.CompositionStart, Handler.CompositionType, Handler.Cut, Handler.Paste,
						Handler.ReplacePreviousChar, Handler.Type,
						'selectNextSuggestion', 'selectPrevSuggestion',
						'acceptSelectedSuggestion', 'acceptAlternativeSelectedSuggestion', 'hideSuggestWidget',
						'selectNextSuggestion', 'selectNextPageSuggestion', 'selectLastSuggestion', 'selectPrevSuggestion',
						'selectPrevPageSuggestion', 'selectFirstSuggestion', 'toggleSuggestionDetails', 'toggleExplainMode', 'toggleSuggestionFocus',
						'insertBestCompletion', 'insertNextSuggestion', 'insertPrevSuggestion', 'editor.action.resetSuggestSize',
						'workbench.action.toggleSidebarVisibility', // From src\vs\workbench\browser\actions\layoutActions.ts
						// Panel actions from src\vs\workbench\browser\parts\panel\panelActions.ts
						'workbench.action.togglePanel', 'workbench.action.focusPanel', 'workbench.action.previousPanelView',
						'workbench.action.nextPanelView', 'workbench.action.toggleMaximizedPanel', 'workbench.action.closePanel', 'workbench.action.closeAuxiliaryBar',
						'workbench.action.movePanelToSidePanel', 'workbench.action.movePanelToSecondarySideBar', 'workbench.action.moveSidePanelToPanel', 'workbench.action.moveSecondarySideBarToPanel'
					].some(id => id === e.commandId) &&
						!e.commandId.startsWith('deleteWord') && // Events from src\vs\editor\contrib\wordOperations\wordOperations.ts
						!e.commandId.startsWith('cursor') && // Events from src\vs\editor\contrib\wordOperations\wordOperations.ts
						!e.commandId.startsWith('notification') && // Events from src\vs\workbench\browser\parts\notifications\notificationsCommands.ts
						!e.commandId.startsWith('editor.action') && // All generic editor actions - not details we currently care about
						!e.commandId.startsWith('_')) { // Commands starting with _ are internal commands which generally aren't useful to us currently
						// Note - this event is duplicated in extHostCommands to also ensure logging of all commands contributed by extensions
						telemetryService.sendActionEvent(TelemetryView.Shell, TelemetryAction.adsCommandExecuted, e.commandId);
					}
				}));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SqlTelemetryContribution, LifecyclePhase.Starting);
