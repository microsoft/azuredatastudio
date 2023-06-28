/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { ICommandQuickPick, CommandsHistory } from 'vs/platform/quickinput/browser/commandsQuickAccess';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IMenuService, MenuId, MenuItemAction, SubmenuItemAction, Action2 } from 'vs/platform/actions/common/actions';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { CancellationToken } from 'vs/base/common/cancellation';
import { raceTimeout, timeout } from 'vs/base/common/async';
import { AbstractEditorCommandsQuickAccessProvider } from 'vs/editor/contrib/quickAccess/browser/commandsQuickAccess';
import { IEditor } from 'vs/editor/common/editorCommon';
import { Language } from 'vs/base/common/platform';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { DefaultQuickAccessFilterValue } from 'vs/platform/quickinput/common/quickAccess';
import { IConfigurationChangeEvent, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkbenchQuickAccessConfiguration } from 'vs/workbench/browser/quickaccess';
import { Codicon } from 'vs/base/common/codicons';
import { ThemeIcon } from 'vs/base/common/themables';
import { IQuickInputService, IQuickPickSeparator } from 'vs/platform/quickinput/common/quickInput';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { TriggerAction } from 'vs/platform/quickinput/browser/pickerQuickAccess';
import { IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';
import { stripIcons } from 'vs/base/common/iconLabels';
import { isFirefox } from 'vs/base/browser/browser';
import { IProductService } from 'vs/platform/product/common/productService';
import { ISemanticSimilarityService } from 'vs/workbench/services/semanticSimilarity/common/semanticSimilarityService';
import { IChatService } from 'vs/workbench/contrib/chat/common/chatService';
import { ILogService } from 'vs/platform/log/common/log';
import { IChatWidgetService } from 'vs/workbench/contrib/chat/browser/chat';

export class CommandsQuickAccessProvider extends AbstractEditorCommandsQuickAccessProvider {

	private static SEMANTIC_SIMILARITY_MAX_PICKS = 3;
	private static SEMANTIC_SIMILARITY_THRESHOLD = 0.8;
	private static SEMANTIC_SIMILARITY_DEBOUNCE = 200;

	// If extensions are not yet registered, we wait for a little moment to give them
	// a chance to register so that the complete set of commands shows up as result
	// We do not want to delay functionality beyond that time though to keep the commands
	// functional.
	private readonly extensionRegistrationRace = raceTimeout(this.extensionService.whenInstalledExtensionsRegistered(), 800);

	private useSemanticSimilarity = false;

	protected get activeTextEditorControl(): IEditor | undefined { return this.editorService.activeTextEditorControl; }

	get defaultFilterValue(): DefaultQuickAccessFilterValue | undefined {
		if (this.configuration.preserveInput) {
			return DefaultQuickAccessFilterValue.LAST;
		}

		return undefined;
	}

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IMenuService private readonly menuService: IMenuService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ICommandService commandService: ICommandService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IDialogService dialogService: IDialogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@IPreferencesService private readonly preferencesService: IPreferencesService,
		@IProductService private readonly productService: IProductService,
		@ISemanticSimilarityService private readonly semanticSimilarityService: ISemanticSimilarityService,
		@IChatService private readonly chatService: IChatService
	) {
		super({
			showAlias: !Language.isDefaultVariant(),
			noResultsPick: (filter) => {
				const info = this.chatService.getProviderInfos()[0];
				return info
					? {
						label: localize('askXInChat', "Ask {0}: {1}", info.displayName, filter),
						commandId: AskInInteractiveAction.ID,
						accept: () => commandService.executeCommand(AskInInteractiveAction.ID, filter)
					}
					: {
						label: localize('noCommandResults', "No matching commands"),
						commandId: ''
					};
			},
		}, instantiationService, keybindingService, commandService, telemetryService, dialogService);

		this._register(configurationService.onDidChangeConfiguration((e) => this.updateOptions(e)));
		this.updateOptions();
	}

	private get configuration() {
		const commandPaletteConfig = this.configurationService.getValue<IWorkbenchQuickAccessConfiguration>().workbench.commandPalette;

		return {
			preserveInput: commandPaletteConfig.preserveInput,
			experimental: commandPaletteConfig.experimental
		};
	}

	private updateOptions(e?: IConfigurationChangeEvent): void {
		if (e && !e.affectsConfiguration('workbench.commandPalette.experimental')) {
			return;
		}

		const config = this.configuration;
		const suggestedCommandIds = config.experimental.suggestCommands && this.productService.commandPaletteSuggestedCommandIds?.length
			? new Set(this.productService.commandPaletteSuggestedCommandIds)
			: undefined;
		this.options.suggestedCommandIds = suggestedCommandIds;
		this.useSemanticSimilarity = config.experimental.useSemanticSimilarity;
	}

	protected async getCommandPicks(token: CancellationToken): Promise<Array<ICommandQuickPick>> {

		// wait for extensions registration or 800ms once
		await this.extensionRegistrationRace;

		if (token.isCancellationRequested) {
			return [];
		}

		return [
			...this.getCodeEditorCommandPicks(),
			...this.getGlobalCommandPicks()
		].map(picks => ({
			...picks,
			buttons: [{
				iconClass: ThemeIcon.asClassName(Codicon.gear),
				tooltip: localize('configure keybinding', "Configure Keybinding"),
			}],
			trigger: (): TriggerAction => {
				this.preferencesService.openGlobalKeybindingSettings(false, { query: `@command:${picks.commandId}` });
				return TriggerAction.CLOSE_PICKER;
			},
		}));
	}

	protected hasAdditionalCommandPicks(filter: string, token: CancellationToken): boolean {
		if (!this.useSemanticSimilarity || filter === '' || token.isCancellationRequested || !this.semanticSimilarityService.isEnabled()) {
			return false;
		}

		return true;
	}

	protected async getAdditionalCommandPicks(allPicks: ICommandQuickPick[], picksSoFar: ICommandQuickPick[], filter: string, token: CancellationToken): Promise<Array<ICommandQuickPick | IQuickPickSeparator>> {
		if (!this.hasAdditionalCommandPicks(filter, token)) {
			return [];
		}

		const format = allPicks.map(p => p.commandId);
		let scores: number[];
		try {
			// Wait a bit to see if the user is still typing
			await timeout(CommandsQuickAccessProvider.SEMANTIC_SIMILARITY_DEBOUNCE, token);
			scores = await this.semanticSimilarityService.getSimilarityScore(filter, format, token);
		} catch (e) {
			return [];
		}

		if (token.isCancellationRequested) {
			return [];
		}

		const sortedIndices = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
		const setOfPicksSoFar = new Set(picksSoFar.map(p => p.commandId));
		const additionalPicks: Array<ICommandQuickPick | IQuickPickSeparator> = picksSoFar.length > 0
			? [{
				type: 'separator',
				label: localize('semanticSimilarity', "similar commands")
			}]
			: [];

		let numOfSmartPicks = 0;
		for (const i of sortedIndices) {
			const score = scores[i];
			if (score < CommandsQuickAccessProvider.SEMANTIC_SIMILARITY_THRESHOLD || numOfSmartPicks === CommandsQuickAccessProvider.SEMANTIC_SIMILARITY_MAX_PICKS) {
				break;
			}

			const pick = allPicks[i];
			if (!setOfPicksSoFar.has(pick.commandId)) {
				additionalPicks.push(pick);
				numOfSmartPicks++;
			}
		}

		return additionalPicks;
	}

	private getGlobalCommandPicks(): ICommandQuickPick[] {
		const globalCommandPicks: ICommandQuickPick[] = [];
		const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
		const globalCommandsMenu = this.menuService.createMenu(MenuId.CommandPalette, scopedContextKeyService);
		const globalCommandsMenuActions = globalCommandsMenu.getActions()
			.reduce((r, [, actions]) => [...r, ...actions], <Array<MenuItemAction | SubmenuItemAction | string>>[])
			.filter(action => action instanceof MenuItemAction && action.enabled) as MenuItemAction[];

		for (const action of globalCommandsMenuActions) {

			// Label
			let label = (typeof action.item.title === 'string' ? action.item.title : action.item.title.value) || action.item.id;

			// Category
			const category = typeof action.item.category === 'string' ? action.item.category : action.item.category?.value;
			if (category) {
				label = localize('commandWithCategory', "{0}: {1}", category, label);
			}

			// Alias
			const aliasLabel = typeof action.item.title !== 'string' ? action.item.title.original : undefined;
			const aliasCategory = (category && action.item.category && typeof action.item.category !== 'string') ? action.item.category.original : undefined;
			const commandAlias = (aliasLabel && category) ?
				aliasCategory ? `${aliasCategory}: ${aliasLabel}` : `${category}: ${aliasLabel}` :
				aliasLabel;

			globalCommandPicks.push({
				commandId: action.item.id,
				commandAlias,
				label: stripIcons(label)
			});
		}

		// Cleanup
		globalCommandsMenu.dispose();

		return globalCommandPicks;
	}
}

//#region Actions

export class ShowAllCommandsAction extends Action2 {

	static readonly ID = 'workbench.action.showCommands';

	constructor() {
		super({
			id: ShowAllCommandsAction.ID,
			title: { value: localize('showTriggerActions', "Show All Commands"), original: 'Show All Commands' },
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined,
				primary: !isFirefox ? (KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP) : undefined,
				secondary: [KeyCode.F1]
			},
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IQuickInputService).quickAccess.show(CommandsQuickAccessProvider.PREFIX);
	}
}

export class ClearCommandHistoryAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.clearCommandHistory',
			title: { value: localize('clearCommandHistory', "Clear Command History"), original: 'Clear Command History' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const dialogService = accessor.get(IDialogService);

		const commandHistoryLength = CommandsHistory.getConfiguredCommandHistoryLength(configurationService);
		if (commandHistoryLength > 0) {

			// Ask for confirmation
			const { confirmed } = await dialogService.confirm({
				type: 'warning',
				message: localize('confirmClearMessage', "Do you want to clear the history of recently used commands?"),
				detail: localize('confirmClearDetail', "This action is irreversible!"),
				primaryButton: localize({ key: 'clearButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Clear")
			});

			if (!confirmed) {
				return;
			}

			CommandsHistory.clearHistory(configurationService, storageService);
		}
	}
}

// TODO: Should this live here? It seems fairly generic and could live in the interactive code.
export class AskInInteractiveAction extends Action2 {

	static readonly ID = 'workbench.action.askCommandInChat';

	constructor() {
		super({
			id: AskInInteractiveAction.ID,
			title: { value: localize('askInChat', "Ask In Chat"), original: 'Ask In Chat' },
			f1: false
		});
	}

	async run(accessor: ServicesAccessor, filter?: string): Promise<void> {
		const chatService = accessor.get(IChatService);
		const chatWidgetService = accessor.get(IChatWidgetService);
		const logService = accessor.get(ILogService);

		if (!filter) {
			throw new Error('No filter provided.');
		}

		let providerId: string;
		const providerInfos = chatService.getProviderInfos();
		switch (providerInfos.length) {
			case 0:
				throw new Error('No chat provider found.');
			case 1:
				providerId = providerInfos[0].id;
				break;
			default:
				logService.warn('Multiple chat providers found. Using the first one.');
				providerId = providerInfos[0].id;
				break;
		}

		const widget = await chatWidgetService.revealViewForProvider(providerId);
		if (widget?.viewModel) {
			// TODO: Maybe this could provide metadata saying it came from the command palette?
			chatService.sendRequestToProvider(widget.viewModel.sessionId, { message: filter });
		}
	}
}

//#endregion
