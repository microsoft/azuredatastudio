/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/watermark';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { isMacintosh, isWeb, OS } from 'vs/base/common/platform';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { ILifecycleService, LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
// import { OpenFolderAction, OpenFileFolderAction, OpenFileAction } from 'vs/workbench/browser/actions/workspaceActions';
// import { OpenRecentAction } from 'vs/workbench/browser/actions/windowActions';
// import { ShowAllCommandsAction } from 'vs/workbench/contrib/quickaccess/browser/commandsQuickAccess';
import { Parts, IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { FindInFilesActionId } from 'vs/workbench/contrib/search/common/constants';
import * as dom from 'vs/base/browser/dom';
import { KeybindingLabel } from 'vs/base/browser/ui/keybindingLabel/keybindingLabel';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { assertIsDefined } from 'vs/base/common/types';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { NEW_UNTITLED_FILE_COMMAND_ID } from 'vs/workbench/contrib/files/browser/fileConstants';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachKeybindingLabelStyler } from 'vs/platform/theme/common/styler';
import { ContextKeyExpression, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
// import { TerminalContextKeys } from 'vs/workbench/contrib/terminal/common/terminalContextKey';

// {{SQL CARBON EDIT}}
import { NewNotebookAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import * as locConstants from 'sql/base/common/locConstants';


const $ = dom.$;

interface WatermarkEntry {
	text: string;
	id: string;
	mac?: boolean;
	when?: ContextKeyExpression;
}

// {{SQL CARBON EDIT}}
const newSqlFile: WatermarkEntry = { text: locConstants.watermarkNewSqlFile, id: NEW_UNTITLED_FILE_COMMAND_ID };
const newNotebook: WatermarkEntry = { text: locConstants.watermarkNewNotebook, id: NewNotebookAction.ID };

/*
const showCommands: WatermarkEntry = { text: nls.localize('watermark.showCommands', "Show All Commands"), id: ShowAllCommandsAction.ID };
const quickAccess: WatermarkEntry = { text: nls.localize('watermark.quickAccess', "Go to File"), id: 'workbench.action.quickOpen' };
const openFileNonMacOnly: WatermarkEntry = { text: nls.localize('watermark.openFile', "Open File"), id: OpenFileAction.ID, mac: false };
const openFolderNonMacOnly: WatermarkEntry = { text: nls.localize('watermark.openFolder', "Open Folder"), id: OpenFolderAction.ID, mac: false };
const openFileOrFolderMacOnly: WatermarkEntry = { text: nls.localize('watermark.openFileFolder', "Open File or Folder"), id: OpenFileFolderAction.ID, mac: true };
const openRecent: WatermarkEntry = { text: nls.localize('watermark.openRecent', "Open Recent"), id: OpenRecentAction.ID };
const newUntitledFile: WatermarkEntry = { text: nls.localize('watermark.newUntitledFile', "New Untitled File"), id: NEW_UNTITLED_FILE_COMMAND_ID };
const newUntitledFileMacOnly: WatermarkEntry = Object.assign({ mac: true }, newUntitledFile);
const toggleTerminal: WatermarkEntry = { text: nls.localize({ key: 'watermark.toggleTerminal', comment: ['toggle is a verb here'] }, "Toggle Terminal"), id: TerminalCommandId.Toggle, when: TerminalContextKeys.processSupported };
*/
const findInFiles: WatermarkEntry = { text: nls.localize('watermark.findInFiles', "Find in Files"), id: FindInFilesActionId };
//const toggleTerminal: WatermarkEntry = { text: nls.localize({ key: 'watermark.toggleTerminal', comment: ['toggle is a verb here'] }, "Toggle Terminal"), id: TerminalCommandId.Toggle, when: TerminalContextKeys.processSupported };
//const startDebugging: WatermarkEntry = { text: nls.localize('watermark.startDebugging', "Start Debugging"), id: DEBUG_START_COMMAND_ID, when: CONTEXT_DEBUGGERS_AVAILABLE };
//const toggleFullscreen: WatermarkEntry = { text: nls.localize({ key: 'watermark.toggleFullscreen', comment: ['toggle is a verb here'] }, "Toggle Full Screen"), id: 'workbench.action.toggleFullScreen', when: TerminalContextKeys.processSupported.toNegated() };
//const showSettings: WatermarkEntry = { text: nls.localize('watermark.showSettings', "Show Settings"), id: 'workbench.action.openSettings', when: TerminalContextKeys.processSupported.toNegated() };

// {{SQL CARBON EDIT}} - Replace noFolderEntries and folderEntries
const noFolderEntries = [
	newSqlFile,
	newNotebook,
	findInFiles
];

const folderEntries = [
	newSqlFile,
	newNotebook,
	findInFiles
];
// {{SQL CARBON EDIT}} - End

const WORKBENCH_TIPS_ENABLED_KEY = 'workbench.tips.enabled';

export class WatermarkContribution extends Disposable implements IWorkbenchContribution {
	private watermark: HTMLElement | undefined;
	private watermarkDisposable = this._register(new DisposableStore());
	private enabled: boolean;
	private workbenchState: WorkbenchState;

	constructor(
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IThemeService private readonly themeService: IThemeService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super();

		this.workbenchState = contextService.getWorkbenchState();
		this.enabled = this.configurationService.getValue<boolean>(WORKBENCH_TIPS_ENABLED_KEY);

		this.registerListeners();

		if (this.enabled) {
			this.create();
		}
	}

	private registerListeners(): void {
		this.lifecycleService.onDidShutdown(() => this.dispose());

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(WORKBENCH_TIPS_ENABLED_KEY)) {
				const enabled = this.configurationService.getValue<boolean>(WORKBENCH_TIPS_ENABLED_KEY);
				if (enabled !== this.enabled) {
					this.enabled = enabled;
					if (this.enabled) {
						this.create();
					} else {
						this.destroy();
					}
				}
			}
		}));

		this._register(this.contextService.onDidChangeWorkbenchState(e => {
			const previousWorkbenchState = this.workbenchState;
			this.workbenchState = this.contextService.getWorkbenchState();

			if (this.enabled && this.workbenchState !== previousWorkbenchState) {
				this.recreate();
			}
		}));

		const allEntriesWhenClauses = [...noFolderEntries, ...folderEntries].filter(entry => entry.when !== undefined).map(entry => entry.when!);
		const allKeys = new Set<string>();
		allEntriesWhenClauses.forEach(when => when.keys().forEach(key => allKeys.add(key)));
		this._register(this.contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(allKeys)) {
				this.recreate();
			}
		}));
	}

	private create(): void {
		const container = assertIsDefined(this.layoutService.getContainer(Parts.EDITOR_PART));
		container.classList.add('has-watermark');

		this.watermark = $('.watermark');
		const box = dom.append(this.watermark, $('.watermark-box'));
		const folder = this.workbenchState !== WorkbenchState.EMPTY;
		const selected = (folder ? folderEntries : noFolderEntries)
			.filter(entry => !('when' in entry) || this.contextKeyService.contextMatchesRules(entry.when))
			.filter(entry => !('mac' in entry) || entry.mac === (isMacintosh && !isWeb))
			.filter(entry => !!CommandsRegistry.getCommand(entry.id));

		const keybindingLabelStylers = this.watermarkDisposable.add(new DisposableStore());

		const update = () => {
			dom.clearNode(box);
			keybindingLabelStylers.clear();
			selected.map(entry => {
				const dl = dom.append(box, $('dl'));
				const dt = dom.append(dl, $('dt'));
				dt.textContent = entry.text;
				const dd = dom.append(dl, $('dd'));
				const keybinding = new KeybindingLabel(dd, OS, { renderUnboundKeybindings: true });
				keybindingLabelStylers.add(attachKeybindingLabelStyler(keybinding, this.themeService));
				keybinding.set(this.keybindingService.lookupKeybinding(entry.id));
			});
		};

		update();

		dom.prepend(container.firstElementChild as HTMLElement, this.watermark);

		this.watermarkDisposable.add(this.keybindingService.onDidUpdateKeybindings(update));
		this.watermarkDisposable.add(this.editorGroupsService.onDidLayout(dimension => this.handleEditorPartSize(container, dimension)));

		this.handleEditorPartSize(container, this.editorGroupsService.contentDimension);

		/* __GDPR__
		"watermark:open" : { }
		*/
		this.telemetryService.publicLog('watermark:open');
	}

	private handleEditorPartSize(container: HTMLElement, dimension: dom.IDimension): void {
		container.classList.toggle('max-height-478px', dimension.height <= 478);
	}

	private destroy(): void {
		if (this.watermark) {
			this.watermark.remove();

			const container = this.layoutService.getContainer(Parts.EDITOR_PART);
			if (container) {
				container.classList.remove('has-watermark');
			}

			this.watermarkDisposable.clear();
		}
	}

	private recreate(): void {
		this.destroy();
		this.create();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WatermarkContribution, LifecyclePhase.Restored);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		...workbenchConfigurationNodeBase,
		'properties': {
			'workbench.tips.enabled': {
				'type': 'boolean',
				'default': true,
				'description': nls.localize('tips.enabled', "When enabled, will show the watermark tips when no editor is open.")
			},
		}
	});

