/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IListService, WorkbenchList } from 'vs/platform/list/browser/listService';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IThemeService, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { ITerminalInstance, ITerminalInstanceService, ITerminalService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { MenuItemAction } from 'vs/platform/actions/common/actions';
import { MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IS_SPLIT_TERMINAL_CONTEXT_KEY, KEYBINDING_CONTEXT_TERMINAL_TABS_SINGULAR_SELECTION, TerminalCommandId } from 'vs/workbench/contrib/terminal/common/terminal';
import { TerminalSettingId } from 'vs/platform/terminal/common/terminal';
import { Codicon } from 'vs/base/common/codicons';
import { Action } from 'vs/base/common/actions';
import { MarkdownString } from 'vs/base/common/htmlContent';
import { TerminalDecorationsProvider } from 'vs/workbench/contrib/terminal/browser/terminalDecorationsProvider';
import { DEFAULT_LABELS_CONTAINER, IResourceLabel, ResourceLabels } from 'vs/workbench/browser/labels';
import { IDecorationsService } from 'vs/workbench/services/decorations/browser/decorations';
import { IHoverAction, IHoverService } from 'vs/workbench/services/hover/browser/hover';
import Severity from 'vs/base/common/severity';
import { Disposable, DisposableStore, dispose, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IListDragAndDrop, IListDragOverReaction, IListRenderer, ListDragOverEffect } from 'vs/base/browser/ui/list/list';
import { DataTransfers, IDragAndDropData } from 'vs/base/browser/dnd';
import { disposableTimeout } from 'vs/base/common/async';
import { ElementsDragAndDropData } from 'vs/base/browser/ui/list/listView';
import { URI } from 'vs/base/common/uri';
import { getColorClass, getIconId, getUriClasses } from 'vs/workbench/contrib/terminal/browser/terminalIcon';
import { Schemas } from 'vs/base/common/network';
import { IEditableData } from 'vs/workbench/common/views';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { InputBox, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { once } from 'vs/base/common/functional';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

const $ = DOM.$;

export const enum TerminalTabsListSizes {
	TabHeight = 22,
	NarrowViewWidth = 46,
	WideViewMinimumWidth = 80,
	DefaultWidth = 120,
	MidpointViewWidth = (TerminalTabsListSizes.NarrowViewWidth + TerminalTabsListSizes.WideViewMinimumWidth) / 2,
	ActionbarMinimumWidth = 105,
	MaximumWidth = 500
}

export class TerminalTabList extends WorkbenchList<ITerminalInstance> {
	private _decorationsProvider: TerminalDecorationsProvider | undefined;
	private _terminalTabsSingleSelectedContextKey: IContextKey<boolean>;
	private _isSplitContextKey: IContextKey<boolean>;

	constructor(
		container: HTMLElement,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ITerminalService private _terminalService: ITerminalService,
		@ITerminalInstanceService _terminalInstanceService: ITerminalInstanceService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IDecorationsService _decorationsService: IDecorationsService,
		@IThemeService private readonly _themeService: IThemeService
	) {
		super('TerminalTabsList', container,
			{
				getHeight: () => TerminalTabsListSizes.TabHeight,
				getTemplateId: () => 'terminal.tabs'
			},
			[instantiationService.createInstance(TerminalTabsRenderer, container, instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER), () => this.getSelectedElements())],
			{
				horizontalScrolling: false,
				supportDynamicHeights: false,
				selectionNavigation: true,
				identityProvider: {
					getId: e => e?.instanceId
				},
				accessibilityProvider: instantiationService.createInstance(TerminalTabsAccessibilityProvider),
				smoothScrolling: configurationService.getValue<boolean>('workbench.list.smoothScrolling'),
				multipleSelectionSupport: true,
				additionalScrollHeight: TerminalTabsListSizes.TabHeight,
				dnd: instantiationService.createInstance(TerminalTabsDragAndDrop)
			},
			contextKeyService,
			listService,
			themeService,
			configurationService,
			keybindingService,
		);
		this._terminalService.onInstancesChanged(() => this.refresh());
		this._terminalService.onGroupsChanged(() => this.refresh());
		this._terminalService.onInstanceTitleChanged(() => this.refresh());
		this._terminalService.onInstanceIconChanged(() => this.refresh());
		this._terminalService.onInstancePrimaryStatusChanged(() => this.refresh());
		this._terminalService.onDidChangeConnectionState(() => this.refresh());
		this._themeService.onDidColorThemeChange(() => this.refresh());
		this._terminalService.onActiveInstanceChanged(e => {
			if (e) {
				const i = this._terminalService.terminalInstances.indexOf(e);
				this.setSelection([i]);
				this.reveal(i);
			}
		});

		this.onMouseDblClick(async () => {
			if (this.getFocus().length === 0) {
				const instance = this._terminalService.createTerminal();
				this._terminalService.setActiveInstance(instance);
				await instance.focusWhenReady();
			}
		});

		// on left click, if focus mode = single click, focus the element
		// unless multi-selection is in progress
		this.onMouseClick(e => {
			const focusMode = configurationService.getValue<'singleClick' | 'doubleClick'>(TerminalSettingId.TabsFocusMode);
			if (e.browserEvent.altKey && e.element) {
				this._terminalService.splitInstance(e.element);
			} else if (focusMode === 'singleClick') {
				if (this.getSelection().length <= 1) {
					e.element?.focus(true);
				}
			}
		});

		// on right click, set the focus to that element
		// unless multi-selection is in progress
		this.onContextMenu(e => {
			if (!e.element) {
				this.setSelection([]);
				return;
			}
			const selection = this.getSelectedElements();
			if (!selection || !selection.find(s => e.element === s)) {
				this.setFocus(e.index !== undefined ? [e.index] : []);
			}
		});

		this._terminalTabsSingleSelectedContextKey = KEYBINDING_CONTEXT_TERMINAL_TABS_SINGULAR_SELECTION.bindTo(contextKeyService);
		this._isSplitContextKey = IS_SPLIT_TERMINAL_CONTEXT_KEY.bindTo(contextKeyService);

		this.onDidChangeSelection(e => this._updateContextKey());
		this.onDidChangeFocus(() => this._updateContextKey());

		this.onDidOpen(async e => {
			const instance = e.element;
			if (!instance) {
				return;
			}
			if (e.editorOptions.pinned) {
				return;
			}
			this._terminalService.setActiveInstance(instance);
			if (!e.editorOptions.preserveFocus) {
				await instance.focusWhenReady();
			}
		});
		if (!this._decorationsProvider) {
			this._decorationsProvider = instantiationService.createInstance(TerminalDecorationsProvider);
			_decorationsService.registerDecorationsProvider(this._decorationsProvider);
		}
		this.refresh();
	}

	refresh(): void {
		this.splice(0, this.length, this._terminalService.terminalInstances);
	}

	private _updateContextKey() {
		this._terminalTabsSingleSelectedContextKey.set(this.getSelectedElements().length === 1);
		const instance = this.getFocusedElements();
		this._isSplitContextKey.set(instance.length > 0 && this._terminalService.instanceIsSplit(instance[0]));
	}
}

class TerminalTabsRenderer implements IListRenderer<ITerminalInstance, ITerminalTabEntryTemplate> {
	templateId = 'terminal.tabs';

	constructor(
		private readonly _container: HTMLElement,
		private readonly _labels: ResourceLabels,
		private readonly _getSelection: () => ITerminalInstance[],
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@IHoverService private readonly _hoverService: IHoverService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IListService private readonly _listService: IListService,
		@IThemeService private readonly _themeService: IThemeService,
		@IContextViewService private readonly _contextViewService: IContextViewService
	) {
	}

	renderTemplate(container: HTMLElement): ITerminalTabEntryTemplate {
		const element = DOM.append(container, $('.terminal-tabs-entry'));
		const context: { hoverActions?: IHoverAction[] } = {};
		const label = this._labels.create(element, {
			supportHighlights: true,
			supportDescriptionHighlights: true,
			supportIcons: true,
			hoverDelegate: {
				delay: this._configurationService.getValue<number>('workbench.hover.delay'),
				showHover: options => {
					return this._hoverService.showHover({
						...options,
						actions: context.hoverActions,
						hideOnHover: true
					});
				}
			}
		});

		const actionsContainer = DOM.append(label.element, $('.actions'));

		const actionBar = new ActionBar(actionsContainer, {
			actionViewItemProvider: action =>
				action instanceof MenuItemAction
					? this._instantiationService.createInstance(MenuEntryActionViewItem, action)
					: undefined
		});

		return {
			element,
			label,
			actionBar,
			context
		};
	}

	shouldHideText(): boolean {
		return this._container ? this._container.clientWidth < TerminalTabsListSizes.MidpointViewWidth : false;
	}

	shouldHideActionBar(): boolean {
		return this._container ? this._container.clientWidth <= TerminalTabsListSizes.ActionbarMinimumWidth : false;
	}

	renderElement(instance: ITerminalInstance, index: number, template: ITerminalTabEntryTemplate): void {
		const hasText = !this.shouldHideText();

		const group = this._terminalService.getGroupForInstance(instance);
		if (!group) {
			throw new Error(`Could not find group for instance "${instance.instanceId}"`);
		}

		template.element.classList.toggle('has-text', hasText);

		let prefix: string = '';
		if (group.terminalInstances.length > 1) {
			const terminalIndex = group.terminalInstances.indexOf(instance);
			if (terminalIndex === 0) {
				prefix = `┌ `;
			} else if (terminalIndex === group!.terminalInstances.length - 1) {
				prefix = `└ `;
			} else {
				prefix = `├ `;
			}
		}

		let title = instance.title;
		const statuses = instance.statusList.statuses;
		template.context.hoverActions = [];
		for (const status of statuses) {
			title += `\n\n---\n\n${status.icon ? `$(${status.icon?.id}) ` : ''}${status.tooltip || status.id}`;
			if (status.hoverActions) {
				template.context.hoverActions.push(...status.hoverActions);
			}
		}
		const iconId = getIconId(instance);
		const hasActionbar = !this.shouldHideActionBar();
		let label: string = '';
		if (!hasText) {
			const primaryStatus = instance.statusList.primary;
			// Don't show ignore severity
			if (primaryStatus && primaryStatus.severity > Severity.Ignore) {
				label = `${prefix}$(${primaryStatus.icon?.id || iconId})`;
			} else {
				label = `${prefix}$(${iconId})`;
			}
		} else {
			this.fillActionBar(instance, template);
			label = prefix;
			// Only add the title if the icon is set, this prevents the title jumping around for
			// example when launching with a ShellLaunchConfig.name and no icon
			if (instance.icon) {
				label += `$(${iconId}) ${instance.title}`;
			}
		}

		if (!hasActionbar) {
			template.actionBar.clear();
		}

		if (!template.elementDispoables) {
			template.elementDispoables = new DisposableStore();
		}

		// Kill terminal on middle click
		template.elementDispoables.add(DOM.addDisposableListener(template.element, DOM.EventType.AUXCLICK, e => {
			e.stopImmediatePropagation();
			if (e.button === 1/*middle*/) {
				this._terminalService.safeDisposeTerminal(instance);
			}
		}));

		const extraClasses: string[] = [];
		const colorClass = getColorClass(instance);
		if (colorClass) {
			extraClasses.push(colorClass);
		}
		const uriClasses = getUriClasses(instance, this._themeService.getColorTheme().type);
		if (uriClasses) {
			extraClasses.push(...uriClasses);
		}

		template.label.setResource({
			resource: instance.resource,
			name: label,
			description: hasText ? instance.shellLaunchConfig.description : undefined
		}, {
			fileDecorations: {
				colors: true,
				badges: hasText
			},
			title: {
				markdown: new MarkdownString(title, { supportThemeIcons: true }),
				markdownNotSupportedFallback: undefined
			},
			extraClasses
		});
		const editableData = this._terminalService.getEditableData(instance);
		template.label.element.classList.toggle('editable-tab', !!editableData);
		if (editableData) {
			this._renderInputBox(template.label.element.querySelector('.monaco-icon-label-container')!, instance, editableData);
			template.actionBar.clear();
		}
	}

	private _renderInputBox(container: HTMLElement, instance: ITerminalInstance, editableData: IEditableData): IDisposable {

		const label = this._labels.create(container);
		const value = instance.title || '';

		const inputBox = new InputBox(container, this._contextViewService, {
			validationOptions: {
				validation: (value) => {
					const message = editableData.validationMessage(value);
					if (!message || message.severity !== Severity.Error) {
						return null;
					}

					return {
						content: message.content,
						formatContent: true,
						type: MessageType.ERROR
					};
				}
			},
			ariaLabel: localize('terminalInputAriaLabel', "Type terminal name. Press Enter to confirm or Escape to cancel.")
		});
		const styler = attachInputBoxStyler(inputBox, this._themeService);
		inputBox.element.style.height = '22px';
		inputBox.value = value;
		inputBox.focus();
		inputBox.select({ start: 0, end: value.length });

		const done = once((success: boolean, finishEditing: boolean) => {
			inputBox.element.style.display = 'none';
			const value = inputBox.value;
			dispose(toDispose);
			inputBox.element.remove();
			if (finishEditing) {
				editableData.onFinish(value, success);
			}
		});

		const showInputBoxNotification = () => {
			if (inputBox.isInputValid()) {
				const message = editableData.validationMessage(inputBox.value);
				if (message) {
					inputBox.showMessage({
						content: message.content,
						formatContent: true,
						type: message.severity === Severity.Info ? MessageType.INFO : message.severity === Severity.Warning ? MessageType.WARNING : MessageType.ERROR
					});
				} else {
					inputBox.hideMessage();
				}
			}
		};
		showInputBoxNotification();

		const toDispose = [
			inputBox,
			DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, (e: IKeyboardEvent) => {
				e.stopPropagation();
				if (e.equals(KeyCode.Enter)) {
					done(inputBox.isInputValid(), true);
				} else if (e.equals(KeyCode.Escape)) {
					done(false, true);
				}
			}),
			DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_UP, (e: IKeyboardEvent) => {
				showInputBoxNotification();
			}),
			DOM.addDisposableListener(inputBox.inputElement, DOM.EventType.BLUR, () => {
				done(inputBox.isInputValid(), true);
			}),
			label,
			styler
		];

		return toDisposable(() => {
			done(false, false);
		});
	}

	disposeElement(instance: ITerminalInstance, index: number, templateData: ITerminalTabEntryTemplate): void {
		templateData.elementDispoables?.dispose();
		templateData.elementDispoables = undefined;
	}

	disposeTemplate(templateData: ITerminalTabEntryTemplate): void {
	}

	fillActionBar(instance: ITerminalInstance, template: ITerminalTabEntryTemplate): void {
		// If the instance is within the selection, split all selected
		const actions = [
			new Action(TerminalCommandId.SplitInstance, localize('terminal.split', "Split"), ThemeIcon.asClassName(Codicon.splitHorizontal), true, async () => {
				this._runForSelectionOrInstance(instance, e => this._terminalService.splitInstance(e));
			}),
			new Action(TerminalCommandId.KillInstance, localize('terminal.kill', "Kill"), ThemeIcon.asClassName(Codicon.trashcan), true, async () => {
				this._runForSelectionOrInstance(instance, e => e.dispose());
			})
		];
		// TODO: Cache these in a way that will use the correct instance
		template.actionBar.clear();
		for (const action of actions) {
			template.actionBar.push(action, { icon: true, label: false, keybinding: this._keybindingService.lookupKeybinding(action.id)?.getLabel() });
		}
	}

	private _runForSelectionOrInstance(instance: ITerminalInstance, callback: (instance: ITerminalInstance) => void) {
		const selection = this._getSelection();
		if (selection.includes(instance)) {
			for (const s of selection) {
				if (s) {
					callback(s);
				}
			}
		} else {
			callback(instance);
		}
		this._terminalService.focusTabs();
		this._listService.lastFocusedList?.focusNext();
	}
}

interface ITerminalTabEntryTemplate {
	element: HTMLElement;
	label: IResourceLabel;
	actionBar: ActionBar;
	context: {
		hoverActions?: IHoverAction[];
	};
	elementDispoables?: DisposableStore;
}


class TerminalTabsAccessibilityProvider implements IListAccessibilityProvider<ITerminalInstance> {
	constructor(@ITerminalService private readonly _terminalService: ITerminalService) { }

	getWidgetAriaLabel(): string {
		return localize('terminal.tabs', "Terminal tabs");
	}

	getAriaLabel(instance: ITerminalInstance): string {
		let ariaLabel: string = '';
		const tab = this._terminalService.getGroupForInstance(instance);
		if (tab && tab.terminalInstances?.length > 1) {
			const terminalIndex = tab.terminalInstances.indexOf(instance);
			ariaLabel = localize({
				key: 'splitTerminalAriaLabel',
				comment: [
					`The terminal's ID`,
					`The terminal's title`,
					`The terminal's split number`,
					`The terminal group's total split number`
				]
			}, "Terminal {0} {1}, split {2} of {3}", instance.instanceId, instance.title, terminalIndex + 1, tab.terminalInstances.length);
		} else {
			ariaLabel = localize({
				key: 'terminalAriaLabel',
				comment: [
					`The terminal's ID`,
					`The terminal's title`
				]
			}, "Terminal {0} {1}", instance.instanceId, instance.title);
		}
		return ariaLabel;
	}
}

class TerminalTabsDragAndDrop implements IListDragAndDrop<ITerminalInstance> {
	private _autoFocusInstance: ITerminalInstance | undefined;
	private _autoFocusDisposable: IDisposable = Disposable.None;

	constructor(
		@ITerminalService private _terminalService: ITerminalService,
		@ITerminalInstanceService private _terminalInstanceService: ITerminalInstanceService
	) { }

	getDragURI(instance: ITerminalInstance): string | null {
		return URI.from({
			scheme: Schemas.vscodeTerminal,
			path: instance.instanceId.toString()
		}).toString();
	}

	getDragLabel?(elements: ITerminalInstance[], originalEvent: DragEvent): string | undefined {
		return elements.length === 1 ? elements[0].title : undefined;
	}

	onDragStart(data: IDragAndDropData, originalEvent: DragEvent): void {
		if (!originalEvent.dataTransfer) {
			return;
		}
		const dndData: unknown = data.getData();
		if (!Array.isArray(dndData)) {
			return;
		}
		// Attach terminals type to event
		const terminals: ITerminalInstance[] = dndData.filter(e => 'instanceId' in (e as any));
		if (terminals.length > 0) {
			originalEvent.dataTransfer.setData('terminals', JSON.stringify(terminals.map(e => e.instanceId)));
		}
	}

	onDragOver(data: IDragAndDropData, targetInstance: ITerminalInstance | undefined, targetIndex: number | undefined, originalEvent: DragEvent): boolean | IListDragOverReaction {
		let result = true;

		const didChangeAutoFocusInstance = this._autoFocusInstance !== targetInstance;
		if (didChangeAutoFocusInstance) {
			this._autoFocusDisposable.dispose();
			this._autoFocusInstance = targetInstance;
		}

		if (!targetInstance) {
			return result;
		}

		if (didChangeAutoFocusInstance) {
			this._autoFocusDisposable = disposableTimeout(() => {
				this._terminalService.setActiveInstance(targetInstance);
				this._autoFocusInstance = undefined;
			}, 500);
		}

		return {
			feedback: targetIndex ? [targetIndex] : undefined,
			accept: true,
			effect: ListDragOverEffect.Move
		};
	}

	drop(data: IDragAndDropData, targetInstance: ITerminalInstance | undefined, targetIndex: number | undefined, originalEvent: DragEvent): void {
		this._autoFocusDisposable.dispose();
		this._autoFocusInstance = undefined;

		if (!(data instanceof ElementsDragAndDropData)) {
			this._handleExternalDrop(targetInstance, originalEvent);
			return;
		}

		const draggedElement = data.getData();
		if (!draggedElement || !Array.isArray(draggedElement)) {
			return;
		}
		let focused = false;

		let sourceInstances: ITerminalInstance[] = [];
		for (const e of draggedElement) {
			if ('instanceId' in e) {
				sourceInstances.push(e as ITerminalInstance);
			}
		}

		if (!targetInstance) {
			for (const instance of sourceInstances) {
				this._terminalService.unsplitInstance(instance);
			}
			return;
		}

		for (const instance of sourceInstances) {
			this._terminalService.moveGroup(instance, targetInstance);
			if (!focused) {
				this._terminalService.setActiveInstance(instance);
				focused = true;
			}
		}
	}

	private async _handleExternalDrop(instance: ITerminalInstance | undefined, e: DragEvent) {
		if (!instance || !e.dataTransfer) {
			return;
		}

		// Check if files were dragged from the tree explorer
		let path: string | undefined;
		const resources = e.dataTransfer.getData(DataTransfers.RESOURCES);
		if (resources) {
			path = URI.parse(JSON.parse(resources)[0]).fsPath;
		} else if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].path /* Electron only */) {
			// Check if the file was dragged from the filesystem
			path = URI.file(e.dataTransfer.files[0].path).fsPath;
		}

		if (!path) {
			return;
		}

		this._terminalService.setActiveInstance(instance);

		const preparedPath = await this._terminalInstanceService.preparePathForTerminalAsync(path, instance.shellLaunchConfig.executable, instance.title, instance.shellType, instance.isRemote);
		instance.sendText(preparedPath, false);
		instance.focus();
	}
}
