/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import * as resources from 'vs/base/common/resources';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { forEach } from 'vs/base/common/collections';
import { IExtensionPointUser, ExtensionMessageCollector, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { MenuId, MenuRegistry, ILocalizedString, IMenuItem, ICommandAction, ISubmenuItem } from 'vs/platform/actions/common/actions';
import { URI } from 'vs/base/common/uri';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { Iterable } from 'vs/base/common/iterator';
import { index } from 'vs/base/common/arrays';

interface IAPIMenu {
	readonly key: string;
	readonly id: MenuId;
	readonly description: string;
	readonly proposed?: boolean; // defaults to false
	readonly supportsSubmenus?: boolean; // defaults to true
}

const apiMenus: IAPIMenu[] = [
	{
		key: 'commandPalette',
		id: MenuId.CommandPalette,
		description: localize('menus.commandPalette', "The Command Palette"),
		supportsSubmenus: false
	},
	{
		key: 'touchBar',
		id: MenuId.TouchBarContext,
		description: localize('menus.touchBar', "The touch bar (macOS only)"),
		supportsSubmenus: false
	},
	{
		key: 'editor/title',
		id: MenuId.EditorTitle,
		description: localize('menus.editorTitle', "The editor title menu")
	},
	{
		key: 'editor/context',
		id: MenuId.EditorContext,
		description: localize('menus.editorContext', "The editor context menu")
	},
	{
		key: 'explorer/context',
		id: MenuId.ExplorerContext,
		description: localize('menus.explorerContext', "The file explorer context menu")
	},
	{
		key: 'editor/title/context',
		id: MenuId.EditorTitleContext,
		description: localize('menus.editorTabContext', "The editor tabs context menu")
	},
	{
		key: 'debug/callstack/context',
		id: MenuId.DebugCallStackContext,
		description: localize('menus.debugCallstackContext', "The debug callstack view context menu")
	},
	{
		key: 'debug/variables/context',
		id: MenuId.DebugVariablesContext,
		description: localize('menus.debugVariablesContext', "The debug variables view context menu")
	},
	{
		key: 'debug/toolBar',
		id: MenuId.DebugToolBar,
		description: localize('menus.debugToolBar', "The debug toolbar menu")
	},
	{
		key: 'menuBar/webNavigation',
		id: MenuId.MenubarWebNavigationMenu,
		description: localize('menus.webNavigation', "The top level navigational menu (web only)"),
		proposed: true,
		supportsSubmenus: false
	},
	{
		key: 'scm/title',
		id: MenuId.SCMTitle,
		description: localize('menus.scmTitle', "The Source Control title menu")
	},
	{
		key: 'scm/sourceControl',
		id: MenuId.SCMSourceControl,
		description: localize('menus.scmSourceControl', "The Source Control menu")
	},
	{
		key: 'scm/resourceState/context',
		id: MenuId.SCMResourceContext,
		description: localize('menus.resourceGroupContext', "The Source Control resource group context menu")
	},
	{
		key: 'scm/resourceFolder/context',
		id: MenuId.SCMResourceFolderContext,
		description: localize('menus.resourceStateContext', "The Source Control resource state context menu")
	},
	{
		key: 'scm/resourceGroup/context',
		id: MenuId.SCMResourceGroupContext,
		description: localize('menus.resourceFolderContext', "The Source Control resource folder context menu")
	},
	{
		key: 'scm/change/title',
		id: MenuId.SCMChangeContext,
		description: localize('menus.changeTitle', "The Source Control inline change menu")
	},
	{
		key: 'statusBar/windowIndicator',
		id: MenuId.StatusBarWindowIndicatorMenu,
		description: localize('menus.statusBarWindowIndicator', "The window indicator menu in the status bar"),
		proposed: true,
		supportsSubmenus: false
	},
	{
		key: 'view/title',
		id: MenuId.ViewTitle,
		description: localize('view.viewTitle', "The contributed view title menu")
	},
	{
		key: 'view/item/context',
		id: MenuId.ViewItemContext,
		description: localize('view.itemContext', "The contributed view item context menu")
	},
	{
		key: 'comments/commentThread/title',
		id: MenuId.CommentThreadTitle,
		description: localize('commentThread.title', "The contributed comment thread title menu")
	},
	{
		key: 'comments/commentThread/context',
		id: MenuId.CommentThreadActions,
		description: localize('commentThread.actions', "The contributed comment thread context menu, rendered as buttons below the comment editor"),
		supportsSubmenus: false
	},
	{
		key: 'comments/comment/title',
		id: MenuId.CommentTitle,
		description: localize('comment.title', "The contributed comment title menu")
	},
	{
		key: 'comments/comment/context',
		id: MenuId.CommentActions,
		description: localize('comment.actions', "The contributed comment context menu, rendered as buttons below the comment editor"),
		supportsSubmenus: false
	},
	{
		key: 'notebook/cell/title',
		id: MenuId.NotebookCellTitle,
		description: localize('notebook.cell.title', "The contributed notebook cell title menu"),
		proposed: true
	},
	{
		key: 'extension/context',
		id: MenuId.ExtensionContext,
		description: localize('menus.extensionContext', "The extension context menu")
	},
	{
		key: 'timeline/title',
		id: MenuId.TimelineTitle,
		description: localize('view.timelineTitle', "The Timeline view title menu")
	},
	{
		key: 'timeline/item/context',
		id: MenuId.TimelineItemContext,
		description: localize('view.timelineContext', "The Timeline view item context menu")
	},
	// {{SQL CARBON EDIT}} start menu entries
	{
		key: 'dashboard/toolbar',
		id: MenuId.DashboardToolbar,
		description: localize('dashboard.toolbar', "The dashboard toolbar action menu")
	},
	{
		key: 'notebook/cell/title',
		id: MenuId.NotebookCellTitle,
		description: localize('notebook.cellTitle', "The notebook cell title menu")
	},
	{
		key: 'notebooks/title',
		id: MenuId.NotebookTitle,
		description: localize('notebook.title', "The notebook title menu")
	},
	{
		key: 'notebook/toolbar',
		id: MenuId.NotebookToolbar,
		description: localize('notebook.toolbar', "The notebook toolbar menu")
	},
	{
		key: 'dataExplorer/action',
		id: MenuId.DataExplorerAction,
		description: localize('dataExplorer.action', "The dataexplorer view container title action menu")
	},
	{
		key: 'dataExplorer/context',
		id: MenuId.DataExplorerContext,
		description: localize('dataExplorer.context', "The dataexplorer item context menu")
	},
	{
		key: 'objectExplorer/item/context',
		id: MenuId.ObjectExplorerItemContext,
		description: localize('objectExplorer.context', "The object explorer item context menu")
	},
	// {{SQL CARBON EDIT}} end menu entries
];

namespace schema {

	// --- menus, submenus contribution point

	export interface IUserFriendlyMenuItem {
		command: string;
		alt?: string;
		when?: string;
		group?: string;
	}

	export interface IUserFriendlySubmenuItem {
		submenu: string;
		when?: string;
		group?: string;
	}

	export interface IUserFriendlySubmenu {
		id: string;
		label: string;
		icon?: IUserFriendlyIcon;
	}

	export function isMenuItem(item: IUserFriendlyMenuItem | IUserFriendlySubmenuItem): item is IUserFriendlyMenuItem {
		return typeof (item as IUserFriendlyMenuItem).command === 'string';
	}

	export function isValidMenuItem(item: IUserFriendlyMenuItem, collector: ExtensionMessageCollector): boolean {
		if (typeof item.command !== 'string') {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'command'));
			return false;
		}
		if (item.alt && typeof item.alt !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'alt'));
			return false;
		}
		if (item.when && typeof item.when !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'when'));
			return false;
		}
		if (item.group && typeof item.group !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'group'));
			return false;
		}

		return true;
	}

	export function isValidSubmenuItem(item: IUserFriendlySubmenuItem, collector: ExtensionMessageCollector): boolean {
		if (typeof item.submenu !== 'string') {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'submenu'));
			return false;
		}
		if (item.when && typeof item.when !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'when'));
			return false;
		}
		if (item.group && typeof item.group !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'group'));
			return false;
		}

		return true;
	}

	export function isValidItems(items: (IUserFriendlyMenuItem | IUserFriendlySubmenuItem)[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(items)) {
			collector.error(localize('requirearray', "submenu items must be an array"));
			return false;
		}

		for (let item of items) {
			if (isMenuItem(item)) {
				if (!isValidMenuItem(item, collector)) {
					return false;
				}
			} else {
				if (!isValidSubmenuItem(item, collector)) {
					return false;
				}
			}
		}

		return true;
	}

	export function isValidSubmenu(submenu: IUserFriendlySubmenu, collector: ExtensionMessageCollector): boolean {
		if (typeof submenu !== 'object') {
			collector.error(localize('require', "submenu items must be an object"));
			return false;
		}

		if (typeof submenu.id !== 'string') {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'id'));
			return false;
		}
		if (typeof submenu.label !== 'string') {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'label'));
			return false;
		}

		return true;
	}

	const menuItem: IJSONSchema = {
		type: 'object',
		required: ['command'],
		properties: {
			command: {
				description: localize('vscode.extension.contributes.menuItem.command', 'Identifier of the command to execute. The command must be declared in the \'commands\'-section'),
				type: 'string'
			},
			alt: {
				description: localize('vscode.extension.contributes.menuItem.alt', 'Identifier of an alternative command to execute. The command must be declared in the \'commands\'-section'),
				type: 'string'
			},
			when: {
				description: localize('vscode.extension.contributes.menuItem.when', 'Condition which must be true to show this item'),
				type: 'string'
			},
			group: {
				description: localize('vscode.extension.contributes.menuItem.group', 'Group into which this item belongs'),
				type: 'string'
			}
		}
	};

	const submenuItem: IJSONSchema = {
		type: 'object',
		required: ['submenu'],
		properties: {
			submenu: {
				description: localize('vscode.extension.contributes.menuItem.submenu', 'Identifier of the submenu to display in this item.'),
				type: 'string'
			},
			when: {
				description: localize('vscode.extension.contributes.menuItem.when', 'Condition which must be true to show this item'),
				type: 'string'
			},
			group: {
				description: localize('vscode.extension.contributes.menuItem.group', 'Group into which this item belongs'),
				type: 'string'
			}
		}
	};

	const submenu: IJSONSchema = {
		type: 'object',
		required: ['id', 'label'],
		properties: {
			id: {
				description: localize('vscode.extension.contributes.submenu.id', 'Identifier of the menu to display as a submenu.'),
				type: 'string'
			},
			label: {
				description: localize('vscode.extension.contributes.submenu.label', 'The label of the menu item which leads to this submenu.'),
				type: 'string'
			},
			icon: {
				description: localize('vscode.extension.contributes.submenu.icon', '(Optional) Icon which is used to represent the submenu in the UI. Either a file path, an object with file paths for dark and light themes, or a theme icon references, like `\\$(zap)`'),
				anyOf: [{
					type: 'string'
				},
				{
					type: 'object',
					properties: {
						light: {
							description: localize('vscode.extension.contributes.submenu.icon.light', 'Icon path when a light theme is used'),
							type: 'string'
						},
						dark: {
							description: localize('vscode.extension.contributes.submenu.icon.dark', 'Icon path when a dark theme is used'),
							type: 'string'
						}
					}
				}]
			}
		}
	};

	export const menusContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.menus', "Contributes menu items to the editor"),
		type: 'object',
		properties: index(apiMenus, menu => menu.key, menu => ({
			description: menu.proposed ? `(${localize('proposed', "Proposed API")}) ${menu.description}` : menu.description,
			type: 'array',
			items: menu.supportsSubmenus === false ? menuItem : { oneOf: [menuItem, submenuItem] }
		})),
		additionalProperties: {
			description: 'Submenu',
			type: 'array',
			items: { oneOf: [menuItem, submenuItem] }
		}
	};

	export const submenusContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.submenus', "(Proposed API) Contributes submenu items to the editor"),
		type: 'array',
		items: submenu
	};

	// --- commands contribution point

	export interface IUserFriendlyCommand {
		command: string;
		title: string | ILocalizedString;
		enablement?: string;
		category?: string | ILocalizedString;
		icon?: IUserFriendlyIcon;
	}

	export type IUserFriendlyIcon = string | { light: string; dark: string; };

	export function isValidCommand(command: IUserFriendlyCommand, collector: ExtensionMessageCollector): boolean {
		if (!command) {
			collector.error(localize('nonempty', "expected non-empty value."));
			return false;
		}
		if (isFalsyOrWhitespace(command.command)) {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'command'));
			return false;
		}
		if (!isValidLocalizedString(command.title, collector, 'title')) {
			return false;
		}
		if (command.enablement && typeof command.enablement !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'precondition'));
			return false;
		}
		if (command.category && !isValidLocalizedString(command.category, collector, 'category')) {
			return false;
		}
		if (!isValidIcon(command.icon, collector)) {
			return false;
		}
		return true;
	}

	function isValidIcon(icon: IUserFriendlyIcon | undefined, collector: ExtensionMessageCollector): boolean {
		if (typeof icon === 'undefined') {
			return true;
		}
		if (typeof icon === 'string') {
			return true;
		} else if (typeof icon.dark === 'string' && typeof icon.light === 'string') {
			return true;
		}
		collector.error(localize('opticon', "property `icon` can be omitted or must be either a string or a literal like `{dark, light}`"));
		return false;
	}

	function isValidLocalizedString(localized: string | ILocalizedString, collector: ExtensionMessageCollector, propertyName: string): boolean {
		if (typeof localized === 'undefined') {
			collector.error(localize('requireStringOrObject', "property `{0}` is mandatory and must be of type `string` or `object`", propertyName));
			return false;
		} else if (typeof localized === 'string' && isFalsyOrWhitespace(localized)) {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", propertyName));
			return false;
		} else if (typeof localized !== 'string' && (isFalsyOrWhitespace(localized.original) || isFalsyOrWhitespace(localized.value))) {
			collector.error(localize('requirestrings', "properties `{0}` and `{1}` are mandatory and must be of type `string`", `${propertyName}.value`, `${propertyName}.original`));
			return false;
		}

		return true;
	}

	const commandType: IJSONSchema = {
		type: 'object',
		required: ['command', 'title'],
		properties: {
			command: {
				description: localize('vscode.extension.contributes.commandType.command', 'Identifier of the command to execute'),
				type: 'string'
			},
			title: {
				description: localize('vscode.extension.contributes.commandType.title', 'Title by which the command is represented in the UI'),
				type: 'string'
			},
			category: {
				description: localize('vscode.extension.contributes.commandType.category', '(Optional) Category string by the command is grouped in the UI'),
				type: 'string'
			},
			enablement: {
				description: localize('vscode.extension.contributes.commandType.precondition', '(Optional) Condition which must be true to enable the command'),
				type: 'string'
			},
			icon: {
				description: localize('vscode.extension.contributes.commandType.icon', '(Optional) Icon which is used to represent the command in the UI. Either a file path, an object with file paths for dark and light themes, or a theme icon references, like `\\$(zap)`'),
				anyOf: [{
					type: 'string'
				},
				{
					type: 'object',
					properties: {
						light: {
							description: localize('vscode.extension.contributes.commandType.icon.light', 'Icon path when a light theme is used'),
							type: 'string'
						},
						dark: {
							description: localize('vscode.extension.contributes.commandType.icon.dark', 'Icon path when a dark theme is used'),
							type: 'string'
						}
					}
				}]
			}
		}
	};

	export const commandsContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.commands', "Contributes commands to the command palette."),
		oneOf: [
			commandType,
			{
				type: 'array',
				items: commandType
			}
		]
	};
}

const _commandRegistrations = new DisposableStore();

export const commandsExtensionPoint = ExtensionsRegistry.registerExtensionPoint<schema.IUserFriendlyCommand | schema.IUserFriendlyCommand[]>({
	extensionPoint: 'commands',
	jsonSchema: schema.commandsContribution
});

commandsExtensionPoint.setHandler(extensions => {

	function handleCommand(userFriendlyCommand: schema.IUserFriendlyCommand, extension: IExtensionPointUser<any>, bucket: ICommandAction[]) {

		if (!schema.isValidCommand(userFriendlyCommand, extension.collector)) {
			return;
		}

		const { icon, enablement, category, title, command } = userFriendlyCommand;

		let absoluteIcon: { dark: URI; light?: URI; } | ThemeIcon | undefined;
		if (icon) {
			if (typeof icon === 'string') {
				absoluteIcon = ThemeIcon.fromString(icon) || { dark: resources.joinPath(extension.description.extensionLocation, icon) };

			} else {
				absoluteIcon = {
					dark: resources.joinPath(extension.description.extensionLocation, icon.dark),
					light: resources.joinPath(extension.description.extensionLocation, icon.light)
				};
			}
		}

		if (MenuRegistry.getCommand(command)) {
			extension.collector.info(localize('dup', "Command `{0}` appears multiple times in the `commands` section.", userFriendlyCommand.command));
		}
		bucket.push({
			id: command,
			title,
			category,
			precondition: ContextKeyExpr.deserialize(enablement),
			icon: absoluteIcon
		});
	}

	// remove all previous command registrations
	_commandRegistrations.clear();

	const newCommands: ICommandAction[] = [];
	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray(value)) {
			for (const command of value) {
				handleCommand(command, extension, newCommands);
			}
		} else {
			handleCommand(value, extension, newCommands);
		}
	}
	_commandRegistrations.add(MenuRegistry.addCommands(newCommands));
});

interface IRegisteredSubmenu {
	readonly id: MenuId;
	readonly label: string;
	readonly icon?: { dark: URI; light?: URI; } | ThemeIcon;
}

const _submenus = new Map<string, IRegisteredSubmenu>();

const submenusExtensionPoint = ExtensionsRegistry.registerExtensionPoint<schema.IUserFriendlySubmenu[]>({
	extensionPoint: 'submenus',
	jsonSchema: schema.submenusContribution
});

submenusExtensionPoint.setHandler(extensions => {

	_submenus.clear();

	for (let extension of extensions) {
		const { value, collector } = extension;

		forEach(value, entry => {
			if (!schema.isValidSubmenu(entry.value, collector)) {
				return;
			}

			if (!entry.value.id) {
				collector.warn(localize('submenuId.invalid.id', "`{0}` is not a valid submenu identifier", entry.value.id));
				return;
			}
			if (!entry.value.label) {
				collector.warn(localize('submenuId.invalid.label', "`{0}` is not a valid submenu label", entry.value.label));
				return;
			}

			if (!extension.description.enableProposedApi) {
				collector.error(localize('submenu.proposedAPI.invalid', "Submenus are proposed API and are only available when running out of dev or with the following command line switch: --enable-proposed-api {0}", extension.description.identifier.value));
				return;
			}

			let absoluteIcon: { dark: URI; light?: URI; } | ThemeIcon | undefined;
			if (entry.value.icon) {
				if (typeof entry.value.icon === 'string') {
					absoluteIcon = ThemeIcon.fromString(entry.value.icon) || { dark: resources.joinPath(extension.description.extensionLocation, entry.value.icon) };
				} else {
					absoluteIcon = {
						dark: resources.joinPath(extension.description.extensionLocation, entry.value.icon.dark),
						light: resources.joinPath(extension.description.extensionLocation, entry.value.icon.light)
					};
				}
			}

			const item: IRegisteredSubmenu = {
				id: new MenuId(`api:${entry.value.id}`),
				label: entry.value.label,
				icon: absoluteIcon
			};

			_submenus.set(entry.value.id, item);
		});
	}
});

const _apiMenusByKey = new Map(Iterable.map(Iterable.from(apiMenus), menu => ([menu.key, menu])));
const _menuRegistrations = new DisposableStore();

const menusExtensionPoint = ExtensionsRegistry.registerExtensionPoint<{ [loc: string]: (schema.IUserFriendlyMenuItem | schema.IUserFriendlySubmenuItem)[] }>({
	extensionPoint: 'menus',
	jsonSchema: schema.menusContribution,
	deps: [submenusExtensionPoint]
});

menusExtensionPoint.setHandler(extensions => {

	// remove all previous menu registrations
	_menuRegistrations.clear();

	const items: { id: MenuId, item: IMenuItem | ISubmenuItem }[] = [];

	for (let extension of extensions) {
		const { value, collector } = extension;

		forEach(value, entry => {
			if (!schema.isValidItems(entry.value, collector)) {
				return;
			}

			let menu = _apiMenusByKey.get(entry.key);
			let isSubmenu = false;

			if (!menu) {
				const submenu = _submenus.get(entry.key);

				if (submenu) {
					menu = {
						key: entry.key,
						id: submenu.id,
						description: ''
					};
					isSubmenu = true;
				}
			}

			if (!menu) {
				collector.warn(localize('menuId.invalid', "`{0}` is not a valid menu identifier", entry.key));
				return;
			}

			if (menu.proposed && !extension.description.enableProposedApi) {
				collector.error(localize('proposedAPI.invalid', "{0} is a proposed menu identifier and is only available when running out of dev or with the following command line switch: --enable-proposed-api {1}", entry.key, extension.description.identifier.value));
				return;
			}

			if (isSubmenu && !extension.description.enableProposedApi) {
				collector.error(localize('proposedAPI.invalid.submenu', "{0} is a submenu identifier and is only available when running out of dev or with the following command line switch: --enable-proposed-api {1}", entry.key, extension.description.identifier.value));
				return;
			}

			for (const menuItem of entry.value) {
				let item: IMenuItem | ISubmenuItem;

				if (schema.isMenuItem(menuItem)) {
					const command = MenuRegistry.getCommand(menuItem.command);
					const alt = menuItem.alt && MenuRegistry.getCommand(menuItem.alt) || undefined;

					if (!command) {
						collector.error(localize('missing.command', "Menu item references a command `{0}` which is not defined in the 'commands' section.", menuItem.command));
						continue;
					}
					if (menuItem.alt && !alt) {
						collector.warn(localize('missing.altCommand', "Menu item references an alt-command `{0}` which is not defined in the 'commands' section.", menuItem.alt));
					}
					if (menuItem.command === menuItem.alt) {
						collector.info(localize('dupe.command', "Menu item references the same command as default and alt-command"));
					}

					item = { command, alt, group: undefined, order: undefined, when: undefined };
				} else {
					if (!extension.description.enableProposedApi) {
						collector.error(localize('proposedAPI.invalid.submenureference', "Menu item references a submenu which is only available when running out of dev or with the following command line switch: --enable-proposed-api {0}", extension.description.identifier.value));
						continue;
					}

					if (menu.supportsSubmenus === false) {
						collector.error(localize('proposedAPI.unsupported.submenureference', "Menu item references a submenu for a menu which doesn't have submenu support."));
						continue;
					}

					const submenu = _submenus.get(menuItem.submenu);

					if (!submenu) {
						collector.error(localize('missing.submenu', "Menu item references a submenu `{0}` which is not defined in the 'submenus' section.", menuItem.submenu));
						continue;
					}

					item = { submenu: submenu.id, icon: submenu.icon, title: submenu.label, group: undefined, order: undefined, when: undefined };
				}

				if (menuItem.group) {
					const idx = menuItem.group.lastIndexOf('@');
					if (idx > 0) {
						item.group = menuItem.group.substr(0, idx);
						item.order = Number(menuItem.group.substr(idx + 1)) || undefined;
					} else {
						item.group = menuItem.group;
					}
				}

				item.when = ContextKeyExpr.deserialize(menuItem.when);
				items.push({ id: menu.id, item });
			}
		});
	}

	_menuRegistrations.add(MenuRegistry.appendMenuItems(items));
});
