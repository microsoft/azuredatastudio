/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { SyncDescriptor0, createSyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IConstructorSignature2, createDecorator, BrandedService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindings, KeybindingsRegistry, IKeybindingRule } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ContextKeyExpr, IContextKeyService, ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { ICommandService, CommandsRegistry, ICommandHandlerDescription } from 'vs/platform/commands/common/commands';
import { IDisposable, DisposableStore } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { UriDto } from 'vs/base/common/types';

export interface ILocalizedString {
	value: string;
	original: string;
}

export type Icon = { dark?: URI; light?: URI; } | ThemeIcon;

export interface ICommandAction {
	id: string;
	title: string | ILocalizedString;
	category?: string | ILocalizedString;
	tooltip?: string | ILocalizedString;
	icon?: Icon;
	precondition?: ContextKeyExpression;
	toggled?: ContextKeyExpression | { condition: ContextKeyExpression, icon?: Icon, tooltip?: string | ILocalizedString };
}

export type ISerializableCommandAction = UriDto<ICommandAction>;

export interface IMenuItem {
	command: ICommandAction;
	alt?: ICommandAction;
	when?: ContextKeyExpression;
	group?: 'navigation' | string;
	order?: number;
}

export interface ISubmenuItem {
	title: string | ILocalizedString;
	submenu: MenuId;
	when?: ContextKeyExpression;
	group?: 'navigation' | string;
	order?: number;
}

export function isIMenuItem(item: IMenuItem | ISubmenuItem): item is IMenuItem {
	return (item as IMenuItem).command !== undefined;
}

export function isISubmenuItem(item: IMenuItem | ISubmenuItem): item is ISubmenuItem {
	return (item as ISubmenuItem).submenu !== undefined;
}

export class MenuId {

	private static _idPool = 0;

	static readonly CommandPalette = new MenuId('CommandPalette');
	static readonly DebugBreakpointsContext = new MenuId('DebugBreakpointsContext');
	static readonly DebugCallStackContext = new MenuId('DebugCallStackContext');
	static readonly DebugConsoleContext = new MenuId('DebugConsoleContext');
	static readonly DebugVariablesContext = new MenuId('DebugVariablesContext');
	static readonly DebugWatchContext = new MenuId('DebugWatchContext');
	static readonly DebugToolBar = new MenuId('DebugToolBar');
	static readonly EditorContext = new MenuId('EditorContext');
	static readonly EditorContextPeek = new MenuId('EditorContextPeek');
	static readonly EditorTitle = new MenuId('EditorTitle');
	static readonly EditorTitleContext = new MenuId('EditorTitleContext');
	static readonly EmptyEditorGroupContext = new MenuId('EmptyEditorGroupContext');
	static readonly ExplorerContext = new MenuId('ExplorerContext');
	static readonly ExtensionContext = new MenuId('ExtensionContext');
	static readonly GlobalActivity = new MenuId('GlobalActivity');
	static readonly MenubarAppearanceMenu = new MenuId('MenubarAppearanceMenu');
	static readonly MenubarDebugMenu = new MenuId('MenubarDebugMenu');
	static readonly MenubarEditMenu = new MenuId('MenubarEditMenu');
	static readonly MenubarFileMenu = new MenuId('MenubarFileMenu');
	static readonly MenubarGoMenu = new MenuId('MenubarGoMenu');
	static readonly MenubarHelpMenu = new MenuId('MenubarHelpMenu');
	static readonly MenubarLayoutMenu = new MenuId('MenubarLayoutMenu');
	static readonly MenubarNewBreakpointMenu = new MenuId('MenubarNewBreakpointMenu');
	static readonly MenubarPreferencesMenu = new MenuId('MenubarPreferencesMenu');
	static readonly MenubarRecentMenu = new MenuId('MenubarRecentMenu');
	static readonly MenubarSelectionMenu = new MenuId('MenubarSelectionMenu');
	static readonly MenubarSwitchEditorMenu = new MenuId('MenubarSwitchEditorMenu');
	static readonly MenubarSwitchGroupMenu = new MenuId('MenubarSwitchGroupMenu');
	static readonly MenubarTerminalMenu = new MenuId('MenubarTerminalMenu');
	static readonly MenubarViewMenu = new MenuId('MenubarViewMenu');
	static readonly OpenEditorsContext = new MenuId('OpenEditorsContext');
	static readonly ProblemsPanelContext = new MenuId('ProblemsPanelContext');
	static readonly SCMChangeContext = new MenuId('SCMChangeContext');
	static readonly SCMResourceContext = new MenuId('SCMResourceContext');
	static readonly SCMResourceFolderContext = new MenuId('SCMResourceFolderContext');
	static readonly SCMResourceGroupContext = new MenuId('SCMResourceGroupContext');
	static readonly SCMSourceControl = new MenuId('SCMSourceControl');
	static readonly SCMTitle = new MenuId('SCMTitle');
	static readonly SearchContext = new MenuId('SearchContext');
	static readonly StatusBarWindowIndicatorMenu = new MenuId('StatusBarWindowIndicatorMenu');
	static readonly TouchBarContext = new MenuId('TouchBarContext');
	static readonly TitleBarContext = new MenuId('TitleBarContext');
	static readonly TunnelContext = new MenuId('TunnelContext');
	static readonly TunnelInline = new MenuId('TunnelInline');
	static readonly TunnelTitle = new MenuId('TunnelTitle');
	static readonly ViewItemContext = new MenuId('ViewItemContext');
	static readonly ViewTitle = new MenuId('ViewTitle');
	static readonly ViewTitleContext = new MenuId('ViewTitleContext');
	static readonly CommentThreadTitle = new MenuId('CommentThreadTitle');
	static readonly CommentThreadActions = new MenuId('CommentThreadActions');
	static readonly CommentTitle = new MenuId('CommentTitle');
	static readonly CommentActions = new MenuId('CommentActions');
	static readonly NotebookCellTitle = new MenuId('NotebookCellTitle');
	static readonly BulkEditTitle = new MenuId('BulkEditTitle');
	static readonly BulkEditContext = new MenuId('BulkEditContext');
	static readonly ObjectExplorerItemContext = new MenuId('ObjectExplorerItemContext'); // {{SQL CARBON EDIT}}
	static readonly NotebookToolbar = new MenuId('NotebookToolbar'); // {{SQL CARBON EDIT}}
	static readonly DataExplorerContext = new MenuId('DataExplorerContext'); // {{SQL CARBON EDIT}}
	static readonly DataExplorerAction = new MenuId('DataExplorerAction'); // {{SQL CARBON EDIT}}
	static readonly ExplorerWidgetContext = new MenuId('ExplorerWidgetContext'); // {{SQL CARBON EDIT}}
	static readonly TimelineItemContext = new MenuId('TimelineItemContext');
	static readonly TimelineTitle = new MenuId('TimelineTitle');
	static readonly TimelineTitleContext = new MenuId('TimelineTitleContext');

	readonly id: number;
	readonly _debugName: string;

	constructor(debugName: string) {
		this.id = MenuId._idPool++;
		this._debugName = debugName;
	}
}

export interface IMenuActionOptions {
	arg?: any;
	shouldForwardArgs?: boolean;
}

export interface IMenu extends IDisposable {
	readonly onDidChange: Event<IMenu | undefined>;
	getActions(options?: IMenuActionOptions): [string, Array<MenuItemAction | SubmenuItemAction>][];
}

export const IMenuService = createDecorator<IMenuService>('menuService');

export interface IMenuService {

	_serviceBrand: undefined;

	createMenu(id: MenuId, scopedKeybindingService: IContextKeyService): IMenu;
}

export type ICommandsMap = Map<string, ICommandAction>;

export interface IMenuRegistry {
	addCommand(userCommand: ICommandAction): IDisposable;
	getCommand(id: string): ICommandAction | undefined;
	getCommands(): ICommandsMap;
	appendMenuItem(menu: MenuId, item: IMenuItem | ISubmenuItem): IDisposable;
	getMenuItems(loc: MenuId): Array<IMenuItem | ISubmenuItem>;
	readonly onDidChangeMenu: Event<MenuId>;
}

export const MenuRegistry: IMenuRegistry = new class implements IMenuRegistry {

	private readonly _commands = new Map<string, ICommandAction>();
	private readonly _menuItems = new Map<MenuId, Array<IMenuItem | ISubmenuItem>>();
	private readonly _onDidChangeMenu = new Emitter<MenuId>();

	readonly onDidChangeMenu: Event<MenuId> = this._onDidChangeMenu.event;

	addCommand(command: ICommandAction): IDisposable {
		this._commands.set(command.id, command);
		this._onDidChangeMenu.fire(MenuId.CommandPalette);
		return {
			dispose: () => {
				if (this._commands.delete(command.id)) {
					this._onDidChangeMenu.fire(MenuId.CommandPalette);
				}
			}
		};
	}

	getCommand(id: string): ICommandAction | undefined {
		return this._commands.get(id);
	}

	getCommands(): ICommandsMap {
		const map = new Map<string, ICommandAction>();
		this._commands.forEach((value, key) => map.set(key, value));
		return map;
	}

	appendMenuItem(id: MenuId, item: IMenuItem | ISubmenuItem): IDisposable {
		let array = this._menuItems.get(id);
		if (!array) {
			array = [item];
			this._menuItems.set(id, array);
		} else {
			array.push(item);
		}
		this._onDidChangeMenu.fire(id);
		return {
			dispose: () => {
				const idx = array!.indexOf(item);
				if (idx >= 0) {
					array!.splice(idx, 1);
					this._onDidChangeMenu.fire(id);
				}
			}
		};
	}

	getMenuItems(id: MenuId): Array<IMenuItem | ISubmenuItem> {
		const result = (this._menuItems.get(id) || []).slice(0);

		if (id === MenuId.CommandPalette) {
			// CommandPalette is special because it shows
			// all commands by default
			this._appendImplicitItems(result);
		}
		return result;
	}

	private _appendImplicitItems(result: Array<IMenuItem | ISubmenuItem>) {
		const set = new Set<string>();

		const temp = result.filter(item => { return isIMenuItem(item); }) as IMenuItem[];

		for (const { command, alt } of temp) {
			set.add(command.id);
			if (alt) {
				set.add(alt.id);
			}
		}
		this._commands.forEach((command, id) => {
			if (!set.has(id)) {
				result.push({ command });
			}
		});
	}
};

export class ExecuteCommandAction extends Action {

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly _commandService: ICommandService) {

		super(id, label);
	}

	run(...args: any[]): Promise<any> {
		return this._commandService.executeCommand(this.id, ...args);
	}
}

export class SubmenuItemAction extends Action {

	readonly item: ISubmenuItem;
	constructor(item: ISubmenuItem) {
		typeof item.title === 'string' ? super('', item.title, 'submenu') : super('', item.title.value, 'submenu');
		this.item = item;
	}
}

export class MenuItemAction extends ExecuteCommandAction {

	readonly item: ICommandAction;
	readonly alt: MenuItemAction | undefined;

	private _options: IMenuActionOptions;

	constructor(
		item: ICommandAction,
		alt: ICommandAction | undefined,
		options: IMenuActionOptions,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService commandService: ICommandService
	) {
		typeof item.title === 'string' ? super(item.id, item.title, commandService) : super(item.id, item.title.value, commandService);

		this._cssClass = undefined;
		this._enabled = !item.precondition || contextKeyService.contextMatchesRules(item.precondition);
		this._tooltip = item.tooltip ? typeof item.tooltip === 'string' ? item.tooltip : item.tooltip.value : undefined;

		if (item.toggled) {
			const toggled = ((item.toggled as { condition: ContextKeyExpression }).condition ? item.toggled : { condition: item.toggled }) as {
				condition: ContextKeyExpression, icon?: Icon, tooltip?: string | ILocalizedString
			};
			this._checked = contextKeyService.contextMatchesRules(toggled.condition);
			if (this._checked && toggled.tooltip) {
				this._tooltip = typeof toggled.tooltip === 'string' ? toggled.tooltip : toggled.tooltip.value;
			}
		}

		this._options = options || {};

		this.item = item;
		this.alt = alt ? new MenuItemAction(alt, undefined, this._options, contextKeyService, commandService) : undefined;
	}

	dispose(): void {
		if (this.alt) {
			this.alt.dispose();
		}
		super.dispose();
	}

	run(...args: any[]): Promise<any> {
		let runArgs: any[] = [];

		if (this._options.arg) {
			runArgs = [...runArgs, this._options.arg];
		}

		if (this._options.shouldForwardArgs) {
			runArgs = [...runArgs, ...args];
		}

		return super.run(...runArgs);
	}
}

export class SyncActionDescriptor {

	private readonly _descriptor: SyncDescriptor0<Action>;

	private readonly _id: string;
	private readonly _label?: string;
	private readonly _keybindings: IKeybindings | undefined;
	private readonly _keybindingContext: ContextKeyExpression | undefined;
	private readonly _keybindingWeight: number | undefined;

	public static create<Services extends BrandedService[]>(ctor: { new(id: string, label: string, ...services: Services): Action },
		id: string, label: string | undefined, keybindings?: IKeybindings, keybindingContext?: ContextKeyExpression, keybindingWeight?: number
	): SyncActionDescriptor {
		return new SyncActionDescriptor(ctor as IConstructorSignature2<string, string | undefined, Action>, id, label, keybindings, keybindingContext, keybindingWeight);
	}

	private constructor(ctor: IConstructorSignature2<string, string | undefined, Action>,
		id: string, label: string | undefined, keybindings?: IKeybindings, keybindingContext?: ContextKeyExpression, keybindingWeight?: number
	) {
		this._id = id;
		this._label = label;
		this._keybindings = keybindings;
		this._keybindingContext = keybindingContext;
		this._keybindingWeight = keybindingWeight;
		this._descriptor = createSyncDescriptor(ctor, this._id, this._label);
	}

	public get syncDescriptor(): SyncDescriptor0<Action> {
		return this._descriptor;
	}

	public get id(): string {
		return this._id;
	}

	public get label(): string | undefined {
		return this._label;
	}

	public get keybindings(): IKeybindings | undefined {
		return this._keybindings;
	}

	public get keybindingContext(): ContextKeyExpression | undefined {
		return this._keybindingContext;
	}

	public get keybindingWeight(): number | undefined {
		return this._keybindingWeight;
	}
}

//#region --- IAction2

type OneOrN<T> = T | T[];

export interface IAction2Options extends ICommandAction {

	/**
	 * Shorthand to add this command to the command palette
	 */
	f1?: boolean;

	/**
	 * One or many menu items.
	 */
	menu?: OneOrN<{ id: MenuId } & Omit<IMenuItem, 'command'>>;

	/**
	 * One keybinding.
	 */
	keybinding?: OneOrN<Omit<IKeybindingRule, 'id'>>;

	/**
	 * Metadata about this command, used for API commands or when
	 * showing keybindings that have no other UX.
	 */
	description?: ICommandHandlerDescription;
}

export abstract class Action2 {
	constructor(readonly desc: Readonly<IAction2Options>) { }
	abstract run(accessor: ServicesAccessor, ...args: any[]): any;
}

export function registerAction2(ctor: { new(): Action2 }): IDisposable {
	const disposables = new DisposableStore();
	const action = new ctor();

	const { f1, menu, keybinding, description, ...command } = action.desc;

	// command
	disposables.add(CommandsRegistry.registerCommand({
		id: command.id,
		handler: (accessor, ...args) => action.run(accessor, ...args),
		description: description,
	}));

	// menu
	if (Array.isArray(menu)) {
		for (let item of menu) {
			disposables.add(MenuRegistry.appendMenuItem(item.id, { command: { ...command }, ...item }));
		}
	} else if (menu) {
		disposables.add(MenuRegistry.appendMenuItem(menu.id, { command: { ...command }, ...menu }));
	}
	if (f1) {
		disposables.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: command }));
	}

	// keybinding
	if (Array.isArray(keybinding)) {
		for (let item of keybinding) {
			KeybindingsRegistry.registerKeybindingRule({
				...item,
				id: command.id,
				when: command.precondition ? ContextKeyExpr.and(command.precondition, item.when) : item.when
			});
		}
	} else if (keybinding) {
		KeybindingsRegistry.registerKeybindingRule({
			...keybinding,
			id: command.id,
			when: command.precondition ? ContextKeyExpr.and(command.precondition, keybinding.when) : keybinding.when
		});
	}

	return disposables;
}
//#endregion
