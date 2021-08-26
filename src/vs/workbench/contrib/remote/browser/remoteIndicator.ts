/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { STATUS_BAR_HOST_NAME_BACKGROUND, STATUS_BAR_HOST_NAME_FOREGROUND } from 'vs/workbench/common/theme';
import { themeColorFromId } from 'vs/platform/theme/common/themeService';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { Disposable, dispose } from 'vs/base/common/lifecycle';
import { MenuId, IMenuService, MenuItemAction, MenuRegistry, registerAction2, Action2, SubmenuItemAction } from 'vs/platform/actions/common/actions';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { StatusbarAlignment, IStatusbarService, IStatusbarEntryAccessor, IStatusbarEntry } from 'vs/workbench/services/statusbar/common/statusbar';
import { ILabelService } from 'vs/platform/label/common/label';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { Schemas } from 'vs/base/common/network';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator } from 'vs/platform/quickinput/common/quickInput';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { PersistentConnectionEventType } from 'vs/platform/remote/common/remoteAgentConnection';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { isWeb } from 'vs/base/common/platform';
import { once } from 'vs/base/common/functional';
import { truncate } from 'vs/base/common/strings';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { getRemoteName, getVirtualWorkspaceLocation, getVirtualWorkspaceScheme } from 'vs/platform/remote/common/remoteHosts';
import { getCodiconAriaLabel } from 'vs/base/common/codicons';
import { ILogService } from 'vs/platform/log/common/log';
import { ReloadWindowAction } from 'vs/workbench/browser/actions/windowActions';
import { IExtensionGalleryService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IExtensionsViewPaneContainer, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID, VIEWLET_ID } from 'vs/workbench/contrib/extensions/common/extensions';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { RemoteNameContext, VirtualWorkspaceContext } from 'vs/workbench/browser/contextkeys';


type ActionGroup = [string, Array<MenuItemAction | SubmenuItemAction>];
export class RemoteStatusIndicator extends Disposable implements IWorkbenchContribution {

	private static readonly REMOTE_ACTIONS_COMMAND_ID = 'workbench.action.remote.showMenu';
	private static readonly CLOSE_REMOTE_COMMAND_ID = 'workbench.action.remote.close';
	private static readonly SHOW_CLOSE_REMOTE_COMMAND_ID = !isWeb; // web does not have a "Close Remote" command
	private static readonly INSTALL_REMOTE_EXTENSIONS_ID = 'workbench.action.remote.extensions';

	private static readonly REMOTE_STATUS_LABEL_MAX_LENGTH = 40;

	private remoteStatusEntry: IStatusbarEntryAccessor | undefined;

	private readonly legacyIndicatorMenu = this._register(this.menuService.createMenu(MenuId.StatusBarWindowIndicatorMenu, this.contextKeyService)); // to be removed once migration completed
	private readonly remoteIndicatorMenu = this._register(this.menuService.createMenu(MenuId.StatusBarRemoteIndicatorMenu, this.contextKeyService));

	private remoteMenuActionsGroups: ActionGroup[] | undefined;

	private readonly remoteAuthority = this.environmentService.remoteAuthority;

	private virtualWorkspaceScheme: string | undefined = undefined;

	private connectionState: 'initializing' | 'connected' | 'reconnecting' | 'disconnected' | undefined = undefined;
	private readonly connectionStateContextKey = new RawContextKey<'' | 'initializing' | 'disconnected' | 'connected'>('remoteConnectionState', '').bindTo(this.contextKeyService);

	private loggedInvalidGroupNames: { [group: string]: boolean } = Object.create(null);

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@ILabelService private readonly labelService: ILabelService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IMenuService private menuService: IMenuService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@ICommandService private readonly commandService: ICommandService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@IRemoteAuthorityResolverService private readonly remoteAuthorityResolverService: IRemoteAuthorityResolverService,
		@IHostService private readonly hostService: IHostService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService,
		@IExtensionGalleryService private readonly extensionGalleryService: IExtensionGalleryService
	) {
		super();

		// Set initial connection state
		if (this.remoteAuthority) {
			this.connectionState = 'initializing';
			this.connectionStateContextKey.set(this.connectionState);
		} else {
			this.updateVirtualWorkspaceScheme();
		}

		this.registerActions();
		this.registerListeners();

		this.updateWhenInstalledExtensionsRegistered();
		this.updateRemoteStatusIndicator();
	}

	private registerActions(): void {
		const category = { value: nls.localize('remote.category', "Remote"), original: 'Remote' };

		// Show Remote Menu
		const that = this;
		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteStatusIndicator.REMOTE_ACTIONS_COMMAND_ID,
					category,
					title: { value: nls.localize('remote.showMenu', "Show Remote Menu"), original: 'Show Remote Menu' },
					f1: true,
				});
			}
			run = () => that.showRemoteMenu();
		});

		// Close Remote Connection
		if (RemoteStatusIndicator.SHOW_CLOSE_REMOTE_COMMAND_ID) {
			registerAction2(class extends Action2 {
				constructor() {
					super({
						id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
						category,
						title: { value: nls.localize('remote.close', "Close Remote Connection"), original: 'Close Remote Connection' },
						f1: true,
						precondition: ContextKeyExpr.or(RemoteNameContext, VirtualWorkspaceContext)
					});
				}
				run = () => that.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null });
			});
			if (this.remoteAuthority) {
				MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
					group: '6_close',
					command: {
						id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
						title: nls.localize({ key: 'miCloseRemote', comment: ['&& denotes a mnemonic'] }, "Close Re&&mote Connection")
					},
					order: 3.5
				});
			}
		}

		if (this.extensionGalleryService.isEnabled()) {
			registerAction2(class extends Action2 {
				constructor() {
					super({
						id: RemoteStatusIndicator.INSTALL_REMOTE_EXTENSIONS_ID,
						category,
						title: { value: nls.localize('remote.install', "Install Remote Development Extensions"), original: 'Install Remote Development Extensions' },
						f1: true
					});
				}
				run = (accessor: ServicesAccessor, input: string) => {
					const viewletService = accessor.get(IViewletService);
					return viewletService.openViewlet(VIEWLET_ID, true).then(viewlet => {
						if (viewlet) {
							(viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer).search(`tag:"remote-menu"`);
							viewlet.focus();
						}
					});
				};
			});
		}


	}

	private registerListeners(): void {

		// Menu changes
		const updateRemoteActions = () => {
			this.remoteMenuActionsGroups = undefined;
			this.updateRemoteStatusIndicator();
		};

		this._register(this.legacyIndicatorMenu.onDidChange(updateRemoteActions));
		this._register(this.remoteIndicatorMenu.onDidChange(updateRemoteActions));

		// Update indicator when formatter changes as it may have an impact on the remote label
		this._register(this.labelService.onDidChangeFormatters(() => this.updateRemoteStatusIndicator()));

		// Update based on remote indicator changes if any
		const remoteIndicator = this.environmentService.options?.windowIndicator;
		if (remoteIndicator) {
			this._register(remoteIndicator.onDidChange(() => this.updateRemoteStatusIndicator()));
		}

		// Listen to changes of the connection
		if (this.remoteAuthority) {
			const connection = this.remoteAgentService.getConnection();
			if (connection) {
				this._register(connection.onDidStateChange((e) => {
					switch (e.type) {
						case PersistentConnectionEventType.ConnectionLost:
						case PersistentConnectionEventType.ReconnectionRunning:
						case PersistentConnectionEventType.ReconnectionWait:
							this.setState('reconnecting');
							break;
						case PersistentConnectionEventType.ReconnectionPermanentFailure:
							this.setState('disconnected');
							break;
						case PersistentConnectionEventType.ConnectionGain:
							this.setState('connected');
							break;
					}
				}));
			}
		} else {
			this._register(this.workspaceContextService.onDidChangeWorkbenchState(() => {
				this.updateVirtualWorkspaceScheme();
				this.updateRemoteStatusIndicator();
			}));
		}
	}

	private updateVirtualWorkspaceScheme() {
		this.virtualWorkspaceScheme = getVirtualWorkspaceScheme(this.workspaceContextService.getWorkspace());
	}

	private async updateWhenInstalledExtensionsRegistered(): Promise<void> {
		await this.extensionService.whenInstalledExtensionsRegistered();

		const remoteAuthority = this.remoteAuthority;
		if (remoteAuthority) {

			// Try to resolve the authority to figure out connection state
			(async () => {
				try {
					await this.remoteAuthorityResolverService.resolveAuthority(remoteAuthority);

					this.setState('connected');
				} catch (error) {
					this.setState('disconnected');
				}
			})();
		}

		this.updateRemoteStatusIndicator();
	}

	private setState(newState: 'disconnected' | 'connected' | 'reconnecting'): void {
		if (this.connectionState !== newState) {
			this.connectionState = newState;

			// simplify context key which doesn't support `connecting`
			if (this.connectionState === 'reconnecting') {
				this.connectionStateContextKey.set('disconnected');
			} else {
				this.connectionStateContextKey.set(this.connectionState);
			}

			this.updateRemoteStatusIndicator();
		}
	}

	private validatedGroup(group: string) {
		if (!group.match(/^(remote|virtualfs)_(\d\d)_(([a-z][a-z0-9+\-.]*)_(.*))$/)) {
			if (!this.loggedInvalidGroupNames[group]) {
				this.loggedInvalidGroupNames[group] = true;
				this.logService.warn(`Invalid group name used in "statusBar/remoteIndicator" menu contribution: ${group}. Entries ignored. Expected format: 'remote_$ORDER_$REMOTENAME_$GROUPING or 'virtualfs_$ORDER_$FILESCHEME_$GROUPING.`);
			}
			return false;
		}
		return true;
	}

	private getRemoteMenuActions(doNotUseCache?: boolean): ActionGroup[] {
		if (!this.remoteMenuActionsGroups || doNotUseCache) {
			this.remoteMenuActionsGroups = this.remoteIndicatorMenu.getActions().filter(a => this.validatedGroup(a[0])).concat(this.legacyIndicatorMenu.getActions());
		}
		return this.remoteMenuActionsGroups;
	}

	private updateRemoteStatusIndicator(): void {

		// Remote Indicator: show if provided via options
		const remoteIndicator = this.environmentService.options?.windowIndicator;
		if (remoteIndicator) {
			this.renderRemoteStatusIndicator(truncate(remoteIndicator.label, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH), remoteIndicator.tooltip, remoteIndicator.command);
			return;
		}

		// Remote Authority: show connection state
		if (this.remoteAuthority) {
			const hostLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, this.remoteAuthority) || this.remoteAuthority;
			switch (this.connectionState) {
				case 'initializing':
					this.renderRemoteStatusIndicator(nls.localize('host.open', "Opening Remote..."), nls.localize('host.open', "Opening Remote..."), undefined, true /* progress */);
					break;
				case 'reconnecting':
					this.renderRemoteStatusIndicator(`${nls.localize('host.reconnecting', "Reconnecting to {0}...", truncate(hostLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH))}`, nls.localize('host.tooltipReconnecting', "Reconnecting to {0}...", hostLabel), undefined, true);
					break;
				case 'disconnected':
					this.renderRemoteStatusIndicator(`$(alert) ${nls.localize('disconnectedFrom', "Disconnected from {0}", truncate(hostLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH))}`, nls.localize('host.tooltipDisconnected', "Disconnected from {0}", hostLabel));
					break;
				default:
					this.renderRemoteStatusIndicator(`$(remote) ${truncate(hostLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH)}`, nls.localize('host.tooltip', "Editing on {0}", hostLabel));
			}
			return;
		} else if (this.virtualWorkspaceScheme) {
			// Workspace with label: indicate editing source
			const workspaceLabel = this.getWorkspaceLabel();
			if (workspaceLabel) {
				const toolTip: IMarkdownString = {
					value: nls.localize(
						{ key: 'workspace.tooltip2', comment: ['{0} is a remote location name, e.g. GitHub', '[Some features]({1}) is a link. Only translate `Some features`. Do not change brackets and parentheses or {1}'] },
						"Virtual workspace on {0}\n\n[Some features]({1}) are not available for resources located on a virtual file system.",
						workspaceLabel, `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`
					),
					isTrusted: true
				};
				this.renderRemoteStatusIndicator(`$(remote) ${truncate(workspaceLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH)}`, toolTip);
				return;
			}
		}
		// Remote actions: offer menu
		if (this.getRemoteMenuActions().length > 0) {
			this.renderRemoteStatusIndicator(`$(remote)`, nls.localize('noHost.tooltip', "Open a Remote Window"));
			return;
		}

		// No Remote Extensions: hide status indicator
		dispose(this.remoteStatusEntry);
		this.remoteStatusEntry = undefined;
	}

	private getWorkspaceLabel() {
		const workspace = this.workspaceContextService.getWorkspace();
		const workspaceLocation = getVirtualWorkspaceLocation(workspace);
		if (workspaceLocation) {
			return this.labelService.getHostLabel(workspaceLocation.scheme, workspaceLocation.authority);
		}
		return undefined;
	}

	private renderRemoteStatusIndicator(text: string, tooltip?: string | IMarkdownString, command?: string, showProgress?: boolean): void {
		const name = nls.localize('remoteHost', "Remote Host");
		if (typeof command !== 'string' && this.getRemoteMenuActions().length > 0) {
			command = RemoteStatusIndicator.REMOTE_ACTIONS_COMMAND_ID;
		}

		const ariaLabel = getCodiconAriaLabel(text);
		const properties: IStatusbarEntry = {
			name,
			backgroundColor: themeColorFromId(STATUS_BAR_HOST_NAME_BACKGROUND),
			color: themeColorFromId(STATUS_BAR_HOST_NAME_FOREGROUND),
			ariaLabel,
			text,
			showProgress,
			tooltip,
			command
		};

		if (this.remoteStatusEntry) {
			this.remoteStatusEntry.update(properties);
		} else {
			this.remoteStatusEntry = this.statusbarService.addEntry(properties, 'status.host', StatusbarAlignment.LEFT, Number.MAX_VALUE /* first entry */);
		}
	}

	private showRemoteMenu() {
		const getCategoryLabel = (action: MenuItemAction) => {
			if (action.item.category) {
				return typeof action.item.category === 'string' ? action.item.category : action.item.category.value;
			}
			return undefined;
		};

		const matchCurrentRemote = () => {
			if (this.remoteAuthority) {
				return new RegExp(`^remote_\\d\\d_${getRemoteName(this.remoteAuthority)}_`);
			} else if (this.virtualWorkspaceScheme) {
				return new RegExp(`^virtualfs_\\d\\d_${this.virtualWorkspaceScheme}_`);
			}
			return undefined;
		};

		const computeItems = () => {
			let actionGroups = this.getRemoteMenuActions(true);

			const items: (IQuickPickItem | IQuickPickSeparator)[] = [];

			const currentRemoteMatcher = matchCurrentRemote();
			if (currentRemoteMatcher) {
				// commands for the current remote go first
				actionGroups = actionGroups.sort((g1, g2) => {
					const isCurrentRemote1 = currentRemoteMatcher.test(g1[0]);
					const isCurrentRemote2 = currentRemoteMatcher.test(g2[0]);
					if (isCurrentRemote1 !== isCurrentRemote2) {
						return isCurrentRemote1 ? -1 : 1;
					}
					return g1[0].localeCompare(g2[0]);
				});
			}

			let lastCategoryName: string | undefined = undefined;

			for (let actionGroup of actionGroups) {
				let hasGroupCategory = false;
				for (let action of actionGroup[1]) {
					if (action instanceof MenuItemAction) {
						if (!hasGroupCategory) {
							const category = getCategoryLabel(action);
							if (category !== lastCategoryName) {
								items.push({ type: 'separator', label: category });
								lastCategoryName = category;
							}
							hasGroupCategory = true;
						}
						let label = typeof action.item.title === 'string' ? action.item.title : action.item.title.value;
						items.push({
							type: 'item',
							id: action.item.id,
							label
						});
					}
				}
			}

			items.push({
				type: 'separator'
			});

			let entriesBeforeConfig = items.length;

			if (RemoteStatusIndicator.SHOW_CLOSE_REMOTE_COMMAND_ID) {
				if (this.remoteAuthority) {
					items.push({
						type: 'item',
						id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
						label: nls.localize('closeRemoteConnection.title', 'Close Remote Connection')
					});

					if (this.connectionState === 'disconnected') {
						items.push({
							type: 'item',
							id: ReloadWindowAction.ID,
							label: nls.localize('reloadWindow', 'Reload Window')
						});
					}
				} else if (this.virtualWorkspaceScheme) {
					items.push({
						type: 'item',
						id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
						label: nls.localize('closeVirtualWorkspace.title', 'Close Remote Workspace')
					});
				}
			}

			if (!this.remoteAuthority && !this.virtualWorkspaceScheme && this.extensionGalleryService.isEnabled()) {
				items.push({
					id: RemoteStatusIndicator.INSTALL_REMOTE_EXTENSIONS_ID,
					label: nls.localize('installRemotes', "Install Additional Remote Extensions..."),

					alwaysShow: true
				});
			}

			if (items.length === entriesBeforeConfig) {
				items.pop(); // remove the separator again
			}

			return items;
		};

		const quickPick = this.quickInputService.createQuickPick();
		quickPick.items = computeItems();
		quickPick.sortByLabel = false;
		quickPick.canSelectMany = false;
		once(quickPick.onDidAccept)((_ => {
			const selectedItems = quickPick.selectedItems;
			if (selectedItems.length === 1) {
				this.commandService.executeCommand(selectedItems[0].id!);
			}

			quickPick.hide();
		}));

		// refresh the items when actions change
		const legacyItemUpdater = this.legacyIndicatorMenu.onDidChange(() => quickPick.items = computeItems());
		quickPick.onDidHide(legacyItemUpdater.dispose);

		const itemUpdater = this.remoteIndicatorMenu.onDidChange(() => quickPick.items = computeItems());
		quickPick.onDidHide(itemUpdater.dispose);

		quickPick.show();
	}
}
