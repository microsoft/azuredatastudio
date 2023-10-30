/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/serverTreeActions';
import * as errors from 'vs/base/common/errors';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'sql/platform/theme/common/vsstyler';
import { ISelectionEvent, ITree } from 'sql/base/parts/tree/browser/tree';
import { Disposable } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Event, Emitter } from 'vs/base/common/event';
import { append, $, hide, show } from 'vs/base/browser/dom';

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import * as ConnectionUtils from 'sql/platform/connection/common/utils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeCreationUtils } from 'sql/workbench/services/objectExplorer/browser/treeCreationUtils';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/workbench/services/objectExplorer/browser/treeSelectionHandler';
import { ERROR_NODE_TYPE, IObjectExplorerService, IServerTreeView, ServerTreeViewView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Button } from 'sql/base/browser/ui/button/button';
import { TreeNode, TreeItemCollapsibleState } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ServerTreeActionProvider } from 'sql/workbench/services/objectExplorer/browser/serverTreeActionProvider';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { isHidden } from 'sql/base/browser/dom';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { SERVER_GROUP_CONFIG } from 'sql/workbench/services/serverGroup/common/interfaces';
import { horizontalScrollingKey } from 'vs/platform/list/browser/listService';
import { ITreeContextMenuEvent, ITreeEvent } from 'vs/base/browser/ui/tree/tree';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { coalesce } from 'vs/base/common/arrays';
import { CONNECTIONS_SORT_BY_CONFIG_KEY } from 'sql/platform/connection/common/connectionConfig';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { debounce } from 'vs/base/common/decorators';
import { ActionRunner } from 'vs/base/common/actions';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { USE_ASYNC_SERVER_TREE_CONFIG } from 'sql/workbench/contrib/objectExplorer/common/serverGroup.contribution';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { FilterDialog } from 'sql/workbench/services/objectExplorer/browser/filterDialog/filterDialog';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { defaultButtonStyles } from 'vs/platform/theme/browser/defaultStyles';

export const CONTEXT_SERVER_TREE_VIEW = new RawContextKey<ServerTreeViewView>('serverTreeView.view', ServerTreeViewView.all);
export const CONTEXT_SERVER_TREE_HAS_CONNECTIONS = new RawContextKey<boolean>('serverTreeView.hasConnections', false);

/**
 * ServerTreeview implements the dynamic tree view.
 */
export class ServerTreeView extends Disposable implements IServerTreeView {

	public messages?: HTMLElement;
	private _buttonSection?: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;
	private _tree: ITree | AsyncServerTree | undefined;
	private _onSelectionOrFocusChange: Emitter<void>;
	private _actionProvider: ServerTreeActionProvider;
	private _viewKey: IContextKey<ServerTreeViewView>;
	private _hasConnectionsKey: IContextKey<boolean>;
	private _actionRunner: ActionRunner;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IThemeService private _themeService: IThemeService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IHostService private _hostService: IHostService,
		@INotificationService private _notificationService: INotificationService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super();
		this._hasConnectionsKey = CONTEXT_SERVER_TREE_HAS_CONNECTIONS.bindTo(contextKeyService);
		this._viewKey = CONTEXT_SERVER_TREE_VIEW.bindTo(contextKeyService);
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._onSelectionOrFocusChange = new Emitter();
		this._actionProvider = this._instantiationService.createInstance(ServerTreeActionProvider);
		this._actionRunner = new ActionRunner();
		this._register(this._actionRunner);
		this._capabilitiesService.onCapabilitiesRegistered(async () => {
			await this.handleOnCapabilitiesRegistered();
		});
		this.registerCommands();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(USE_ASYNC_SERVER_TREE_CONFIG)) {
				this._notificationService.prompt(
					Severity.Info,
					localize('serverTreeViewChangeNotification', "Server tree has changed. Please reload the window to see the changes."),
					[{
						label: localize('serverTreeViewChangeNotification.reload', "Reload"),
						run: () => {
							this._hostService.reload();
						}
					}, {
						label: localize('serverTreeViewChangeNotification.doNotReload', "Don't Reload"),
						run: () => { }
					}],
					{
						sticky: true
					}
				);
			}
		}));
	}

	@debounce(50)
	private async handleOnCapabilitiesRegistered(): Promise<void> {
		if (this._tree instanceof AsyncServerTree) {
			// Refresh the tree input now that the capabilities are registered so that we can
			// get the full ConnectionProfiles with the server info updated properly
			const treeInput = TreeUpdateUtils.getTreeInput(this._connectionManagementService)!;
			await this._tree.setInput(treeInput);
			this._treeSelectionHandler.onTreeActionStateChange(false);
		} else {
			if (this._connectionManagementService.hasRegisteredServers()) {
				await this.refreshTree();
				this._treeSelectionHandler.onTreeActionStateChange(false);
			}
		}
	}

	public get view(): ServerTreeViewView {
		return this._viewKey.get();
	}

	/**
	 * Event fired when the tree's selection or focus changes
	 */
	public get onSelectionOrFocusChange(): Event<void> {
		return this._onSelectionOrFocusChange.event;
	}

	public get treeActionProvider(): ServerTreeActionProvider {
		return this._actionProvider;
	}

	/**
	 * Returns instance of server tree used by the server Tree View.
	 * If server tree view has not yet rendered, tree instance can be undefined.
	 */
	public get tree(): ITree | AsyncServerTree | undefined {
		return this._tree;
	}

	/**
	 *
	 * Register search related commands
	 */
	public registerCommands(): void {
		CommandsRegistry.registerCommand({
			id: 'registeredServers.searchServer',
			handler: (accessor: ServicesAccessor, ...args: any[]) => {
				this.searchTree(args[0]);
			}
		});
		CommandsRegistry.registerCommand({
			id: 'registeredServers.clearSearchServerResult',
			handler: (accessor: ServicesAccessor, ...args: any[]) => {
				this.refreshTree().catch(errors.onUnexpectedError);
			}
		});
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): Promise<void> {
		// Add div to display no connections found message and hide it by default
		this.messages = append(container, $('.title'));
		const messageText = append(this.messages, $('span'));
		messageText.style.paddingLeft = '10px';
		messageText.innerText = localize('servers.noConnections', "No connections found.");
		this.hideMessages();

		if (!this._connectionManagementService.hasRegisteredServers()) {
			this._buttonSection = append(container, $('.button-section'));
			const connectButton = new Button(this._buttonSection, defaultButtonStyles);
			connectButton.label = localize('serverTree.newConnection', "New Connection");
			this._register(connectButton.onDidClick(() => {
				this._connectionManagementService.showConnectionDialog(undefined, {
					showDashboard: true,
					saveTheConnection: true,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true
				});
			}));
		}

		this.initTree(container);

		return new Promise<void>(async (resolve, reject) => {
			await this.refreshTree();
			const root = <ConnectionProfileGroup>this._tree.getInput();

			const expandGroups = this._configurationService.getValue<{ autoExpand: boolean }>(SERVER_GROUP_CONFIG).autoExpand;
			if (expandGroups) {
				if (this._tree instanceof AsyncServerTree) {
					const subGroups = ConnectionProfileGroup.getSubgroups(root);
					for (let group of subGroups) {
						await this._tree.expand(group);
					}
				} else {
					await this._tree?.expandAll(ConnectionProfileGroup.getSubgroups(root));
				}

			}

			if (root && !root.hasValidConnections) {
				this._treeSelectionHandler.onTreeActionStateChange(true);
				resolve();
			} else {
				resolve();
			}
		});
	}

	private initTree(container: HTMLElement): void {
		const horizontalScrollEnabled: boolean = this._configurationService.getValue(horizontalScrollingKey) || false;
		this._tree = this._register(TreeCreationUtils.createServersTree(container, this._instantiationService, this._configurationService, horizontalScrollEnabled));
		this._register(this._tree.onDidChangeSelection((event: ISelectionEvent | ITreeEvent<ServerTreeElement>) => this.onSelected(event)));
		this._register(this._tree.onDidBlur(() => this._onSelectionOrFocusChange.fire()));
		this._register(this._tree.onDidChangeFocus(() => this._onSelectionOrFocusChange.fire()));
		if (this._tree instanceof AsyncServerTree) {
			this._register(this._tree.onContextMenu(e => this.onTreeNodeContextMenu(e)));
			this._register(this._tree.onMouseDblClick(async e => { await this.onTreeNodeDoubleClick(e.element); }));
			this._register(this._connectionManagementService.onConnectionChanged(() => {
				// No need to refresh AsyncServerTree when a connection is edited or added
				if (!(this._tree instanceof AsyncServerTree)) {
					this.refreshTree().catch(err => errors.onUnexpectedError);
				}
			}));
		}

		// Theme styler
		this._register(attachListStyler(this._tree, this._themeService));

		// Refresh Tree when these events are emitted
		this._register(this._connectionManagementService.onAddConnectionProfile((newProfile: IConnectionProfile) => {
			this.handleAddConnectionProfile(newProfile).catch(errors.onUnexpectedError);
		}));
		this._register(this._connectionManagementService.onDeleteConnectionProfile(() => {
			// No need to refresh AsyncServerTree when a connection is deleted
			if (!(this._tree instanceof AsyncServerTree)) {
				this.refreshTree().catch(errors.onUnexpectedError);
			}
		}));

		this._register(this._connectionManagementService.onDisconnect(async (connectionParams) => {
			if (this.isObjectExplorerConnectionUri(connectionParams.connectionUri)) {
				if (this._tree instanceof AsyncServerTree) {
					await this.disconnectConnection(<ConnectionProfile>connectionParams.connectionProfile);
				} else {
					this.deleteObjectExplorerNodeAndRefreshTree(connectionParams.connectionProfile).catch(errors.onUnexpectedError);
				}
			}
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(CONNECTIONS_SORT_BY_CONFIG_KEY)) {
				this.refreshTree().catch(err => errors.onUnexpectedError);
			}
		}));

		if (this._objectExplorerService && this._objectExplorerService.onUpdateObjectExplorerNodes) {
			this._register(this._objectExplorerService.onUpdateObjectExplorerNodes(args => {
				if (args.errorMessage) {
					this.showError(args.errorMessage);
				} else if (args.connection) {
					if (this._tree instanceof AsyncServerTree) {
						// Rerendering the node to update the badge
						this._tree.rerender(<ConnectionProfile>args.connection);
					}
					this.onObjectExplorerSessionCreated(args.connection).catch(err => errors.onUnexpectedError);
				}
			}));
		}

		// Add connection profile to parent group and update group children. Then reveal and expand the new connection
		this._register(this._connectionManagementService.onConnectionProfileCreated(async (newConnection) => {
			if (this._tree instanceof AsyncServerTree) {
				/**
				 * On a fresh install of ads, the default group in connection tree is not created until the first conneciton is
				 * created. In that case, the tree input is null and this handles that edge case. When we find the tree input undefined,
				 * we get the default group and set it as the tree input so that the new connection can be added to it.
				 */
				if (!this._tree.getInput()) {
					this._tree.setInput(TreeUpdateUtils.getTreeInput(this._connectionManagementService));
				}
				const connectionParentGroup = this._tree.getElementById(newConnection.groupId) as ConnectionProfileGroup;
				if (connectionParentGroup) {
					connectionParentGroup.addOrReplaceConnection(newConnection);
					await this._tree.updateChildren(connectionParentGroup);
					this._tree.revealSelectFocusElement(newConnection);
					await this._tree.expand(newConnection);
				}
			}
		}));

		// Rerender the connection in the tree to update the badge and update the children of the connection.
		this._register(this._connectionManagementService.onConnectionProfileConnected(async (connectedConnection) => {
			if (this._tree instanceof AsyncServerTree) {
				const connectionInTree = this._tree.getElementById(connectedConnection.id);
				if (connectionInTree) {
					this._tree.rerender(connectionInTree);
					this._tree.revealSelectFocusElement(connectionInTree);
					await this._tree.updateChildren(connectionInTree);
					await this._tree.expand(connectionInTree);
				}
			}
		}));

		// Remove the connection from the parent group and update the parent's children.
		this._register(this._connectionManagementService.onConnectionProfileDeleted(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				const parentGroup = <ConnectionProfileGroup>this._tree.getElementById(e.groupId);
				if (parentGroup) {
					parentGroup.removeConnections([e]);
					await this._tree.updateChildren(parentGroup);
					this._tree.revealSelectFocusElement(parentGroup);
				}
			}
		}));


		this._register(this._connectionManagementService.onConnectionProfileEdited(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				const oldProfile = <ConnectionProfile>this._tree.getElementById(e.oldProfileId);
				const oldProfileParent = <ConnectionProfileGroup>this._tree.getElementById(oldProfile.groupId);
				if (oldProfileParent.id !== e.profile.groupId) {
					// If the profile was moved to a different group then remove it from the old group and add it to the new group.
					oldProfileParent.removeConnections([oldProfile]);
					await this._tree.updateChildren(oldProfileParent);
					const newProfileParent = <ConnectionProfileGroup>this._tree.getElementById(e.profile.groupId);
					newProfileParent.addOrReplaceConnection(e.profile);
					await this._tree.updateChildren(newProfileParent);
					this._tree.revealSelectFocusElement(e.profile);
					await this._tree.expand(e.profile);
				} else {
					// If the profile was not moved to a different group then just update the profile in the group.
					oldProfileParent.replaceConnection(e.profile, e.oldProfileId);
					await this._tree.updateChildren(oldProfileParent);
					this._tree.revealSelectFocusElement(e.profile);
					await this._tree.expand(e.profile);
				}
			}
		}));

		this._register(this._connectionManagementService.onConnectionProfileMoved(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				const movedConnection = <ConnectionProfile>e.source;
				const oldParent = <ConnectionProfileGroup>this._tree.getElementById(e.oldGroupId);
				const newParent = <ConnectionProfileGroup>this._tree.getElementById(e.newGroupId);
				if (oldParent) {
					oldParent.removeConnections([movedConnection]);
					await this._tree.updateChildren(oldParent);
				}
				if (newParent) {
					newParent.addOrReplaceConnection(movedConnection);
					this._tree.rerender(newParent);
					await this._tree.makeElementDirty(newParent);
					await this._tree.updateChildren(newParent);
					await this._tree.expand(newParent);
				}
				const newConnection = this._tree.getElementById(movedConnection.id);
				if (newConnection) {
					this._tree.revealSelectFocusElement(newConnection);
				}
			}
		}));

		this._register(this._connectionManagementService.onConnectionProfileGroupDeleted(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				const parent = <ConnectionProfileGroup>this._tree.getElementById(e.parentId);
				parent.children = parent.children.filter(c => c.id !== e.id);
				await this._tree.updateChildren(parent);
				this._tree.revealSelectFocusElement(parent);
			}
		}));

		this._register(this._connectionManagementService.onConnectionProfileGroupCreated(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				/**
				 * On a fresh install of ads, the default group in connection tree is not created until the first conneciton is
				 * created. In that case, the tree input is null and this handles that edge case. When we find the tree input undefined,
				 * we get the default group and set it as the tree input so that the new connection group can be added to it.
				 */
				if (!this._tree.getInput()) {
					this._tree.setInput(TreeUpdateUtils.getTreeInput(this._connectionManagementService));
				}
				let parent = <ConnectionProfileGroup>this._tree.getElementById(e.parentId);
				if (!parent) {
					parent = this._tree.getInput(); // If the parent is not found then add the group to the root.
				}
				parent.addGroups([e]);
				e.parent = parent;
				e.parentId = parent.id;
				await this._tree.updateChildren(parent);
				this._tree.revealSelectFocusElement(e);
			}
		}));

		this._register(this._connectionManagementService.onConnectionProfileGroupEdited(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				const newParent = <ConnectionProfileGroup>this._tree.getElementById(e.parentId);
				if (newParent) {
					newParent.children[newParent.children.findIndex(c => c.id === e.id)] = e;
					await this._tree.updateChildren(newParent);
					this._tree.revealSelectFocusElement(e);
				}
			}
		}));

		this._register(this._connectionManagementService.onConnectionProfileGroupMoved(async (e) => {
			if (this._tree instanceof AsyncServerTree) {
				const movedGroup = <ConnectionProfileGroup>e.source;
				const oldParent = <ConnectionProfileGroup>this._tree.getElementById(e.oldGroupId);
				const newParent = <ConnectionProfileGroup>this._tree.getElementById(e.newGroupId);
				oldParent.children = oldParent.children.filter(c => c.id !== movedGroup.id);
				await this._tree.updateChildren(oldParent);
				newParent.children.push(movedGroup);
				(<ConnectionProfileGroup>movedGroup).parent = newParent;
				(<ConnectionProfileGroup>movedGroup).parentId = newParent.id;
				await this._tree.updateChildren(newParent);
				this._tree.revealSelectFocusElement(movedGroup);
			}
		}));
	}

	public isObjectExplorerConnectionUri(uri: string): boolean {
		let isBackupRestoreUri: boolean = uri.indexOf(ConnectionUtils.ConnectionUriBackupIdAttributeName) >= 0 ||
			uri.indexOf(ConnectionUtils.ConnectionUriRestoreIdAttributeName) >= 0;
		return !!uri && uri.startsWith(ConnectionUtils.uriPrefixes.default) && !isBackupRestoreUri;
	}

	private async handleAddConnectionProfile(newProfile?: IConnectionProfile): Promise<void> {
		if (this._buttonSection) {
			hide(this._buttonSection);
		}

		if (this._tree && !(this._tree instanceof AsyncServerTree)) {
			if (newProfile) {
				const groups = this._connectionManagementService.getConnectionGroups();
				const profile = ConnectionUtils.findProfileInGroup(newProfile, groups);
				if (profile) {
					newProfile = profile;
				}
			}

			const currentSelections = this._tree.getSelection();
			const currentSelectedElement = currentSelections && currentSelections.length >= 1 ? currentSelections[0] : undefined;
			const newProfileIsSelected = currentSelectedElement && newProfile ? currentSelectedElement.id === newProfile.id : false;
			if (newProfile && currentSelectedElement && !newProfileIsSelected) {
				this._tree.clearSelection();
			}
			await this.refreshTree();
			if (newProfile && !newProfileIsSelected) {
				await this._tree.reveal(newProfile);
				this._tree.select(newProfile);
				await this._tree.expand(newProfile);
			}
		}
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}

	private hideMessages(): void {
		if (this.messages) {
			hide(this.messages);
		}
	}

	private showAndFocusMessages(): void {
		if (this.messages) {
			show(this.messages);
			this.messages.focus();
		}
	}

	/**
	 * Gets the ConnectionProfile object in the tree for the specified ID, or undefined if it doesn't exist.
	 * @param connectionId The connection ID to search for
	 */
	private getConnectionInTreeInput(connectionId: string): ConnectionProfile | undefined {
		if (this._tree instanceof AsyncServerTree) {
			const root = this._tree.getInput();
			if (root) {
				const connections = ConnectionProfileGroup.getConnectionsInGroup(root);
				return connections.find(conn => conn.id === connectionId);
			}
			return undefined;
		} else {
			const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
			if (root) {
				const connections = ConnectionProfileGroup.getConnectionsInGroup(root);
				const results = connections.filter(con => {
					if (connectionId === con.id) {
						return true;
					} else {
						return false;
					}
				});
				if (results && results.length > 0) {
					return results[0];
				}
			}
			return undefined;
		}
	}

	private async disconnectConnection(profile: ConnectionProfile, deleteConnFromConnectionService: boolean = false): Promise<void> {
		if (this._tree instanceof AsyncServerTree) {
			if (deleteConnFromConnectionService) {
				await this._connectionManagementService.deleteConnection(profile);
			}
			const connectionProfile = this.getConnectionInTreeInput(profile.id);
			// If the connection is not found in the tree, it means it was already deleted from the tree and we don't need to disconnect it
			if (!connectionProfile) {
				return;
			}
			// For the connection profile, we need to clear the password from the last session if the user doesn't want to save it
			if (!connectionProfile.savePassword) {
				connectionProfile.password = '';
			}
			// Delete the node from the tree
			await this._objectExplorerService.deleteObjectExplorerNode(connectionProfile);
			// Rerendering node to turn the badge red
			this._tree.rerender(connectionProfile);
			connectionProfile.isDisconnecting = true;
			await this._tree.updateChildren(connectionProfile);
			connectionProfile.isDisconnecting = false;
			// Make the connection dirty so that the next expansion will refresh the node
			// Collapse the node
			this._tree.collapse(connectionProfile);
			await this._tree.makeElementDirty(connectionProfile);
			this._tree.revealSelectFocusElement(connectionProfile);
		}
	}

	private async onObjectExplorerSessionCreated(connection: IConnectionProfile): Promise<void> {
		const element = this.getConnectionInTreeInput(connection.id);
		if (element) {
			if (this._tree instanceof AsyncServerTree) {
				this._tree.rerender(element);
				this._tree.revealSelectFocusElement(element);
			} else {
				await this._tree?.refresh(element);
				await this._tree?.expand(element);
				await this._tree?.reveal(element, 0.5);
				this._treeSelectionHandler.onTreeActionStateChange(false);
			}
		}
	}

	public addObjectExplorerNodeAndRefreshTree(connection: IConnectionProfile): void {
		this.hideMessages();
		if (!this._objectExplorerService.getObjectExplorerNode(connection)) {
			this._objectExplorerService.updateObjectExplorerNodes(connection).catch(e => errors.onUnexpectedError(e));
		}
	}

	public async deleteObjectExplorerNodeAndRefreshTree(connection: IConnectionProfile): Promise<void> {
		if (connection) {
			const conn = this.getConnectionInTreeInput(connection.id);
			if (conn) {
				await this._objectExplorerService.deleteObjectExplorerNode(conn);
				if (this._tree instanceof AsyncServerTree) {
					// Collapse the node before refreshing so the refresh doesn't try to fetch
					// the children again (which causes it to try and connect)
					this._tree.collapse(conn);
					this._tree.rerender(conn);
					this._tree.makeElementDirty(conn);
				} else {
					await this._tree?.collapse(conn);
					return this._tree?.refresh(conn);
				}
			}
		}
	}

	public async refreshTree(): Promise<void> {
		this.hideMessages();
		this._viewKey.set(ServerTreeViewView.all);
		this._hasConnectionsKey.set(this._connectionManagementService.hasRegisteredServers());
		return this._tree ? TreeUpdateUtils.registeredServerUpdate(this._tree, this._connectionManagementService) : undefined;
	}

	public async refreshElement(element: ServerTreeElement): Promise<void> {
		if (this._tree instanceof AsyncServerTree) {
			return this._tree.updateChildren(element);
		} else {
			return this._tree?.refresh(element);
		}
	}

	public async filterElementChildren(node: TreeNode): Promise<void> {
		await FilterDialog.getFiltersForProperties(
			node.filterProperties,
			localize('objectExplorer.filterDialogTitle', "Filter Settings"),
			node.nodePath,
			node.filters,
			async (filters) => {
				let errorListener;
				try {
					let expansionError = undefined;
					errorListener = this._objectExplorerService.onUpdateObjectExplorerNodes(e => {
						if (e.errorMessage) {
							expansionError = e.errorMessage;
						}
						errorListener.dispose();
					});
					node.forceRefresh = true;
					node.filters = filters || [];
					if (this._tree instanceof AsyncServerTree) {
						this._tree.rerender(node);
					}
					await this.refreshElement(node);
					await this._tree?.expand(node);
					if (expansionError) {
						throw new Error(expansionError);
					}
				} finally {
					if (errorListener) {
						errorListener.dispose();
					}

					this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.ObjectExplorer, TelemetryKeys.TelemetryAction.ObjectExplorerFilter)
						.withAdditionalProperties({
							filterPropertyNames: JSON.stringify(filters.map(f => f.name)),
							filterCount: filters.length,
							objectType: node.objectType
						}).send();
				}
				return;
			},
			this._instantiationService
		);
	}

	/**
	 * Filter connections based on view (recent/active)
	 */
	private filterConnections(treeInput: ConnectionProfileGroup[] | undefined, view: string): ConnectionProfileGroup[] | undefined {
		if (!treeInput || treeInput.length === 0) {
			return undefined;
		}
		const result = coalesce(treeInput.map(group => {
			// Keep active/recent connections and remove the rest
			if (group.connections) {
				group.connections = group.connections.filter(con => {
					if (view === 'active') {
						return this._connectionManagementService.isConnected(undefined, con);
					} else if (view === 'recent') {
						return this._connectionManagementService.isRecent(con);
					}
					return false;
				});
			}
			group.children = this.filterConnections(group.children, view);
			// Remove subgroups that are undefined
			if (group.children) {
				group.children = group.children.filter(group => {
					return (group) ? true : false;
				});
			}
			// Return a group only if it has a filtered result or subgroup.
			if ((group.connections && group.connections.length > 0) || (group.children && group.children.length > 0)) {
				return group;
			}
			return undefined;
		}));
		return result;
	}

	/**
	 * Set tree elements based on the view (recent/active)
	 */
	public async showFilteredTree(view: ServerTreeViewView): Promise<void> {
		this.hideMessages();
		this._viewKey.set(view);
		const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		let treeInput: ConnectionProfileGroup | undefined = undefined;
		if (root) {
			// Filter results based on view
			const filteredResults = this.filterConnections([root], view);
			if (!filteredResults || !filteredResults[0]) {
				this.showAndFocusMessages();
			} else {
				treeInput = filteredResults[0];
			}

			if (treeInput) {
				if (this._tree instanceof AsyncServerTree) {
					await this._tree.setInput(treeInput);
					await this._tree.updateChildren(treeInput);
					return;
				}
				await this._tree?.setInput(treeInput);
			}
			if (this.messages && isHidden(this.messages)) {
				this._tree?.getFocus();
				if (this._tree instanceof AsyncServerTree) {
					for (const subgroup of ConnectionProfileGroup.getSubgroups(treeInput)) {
						await this._tree.expand(subgroup);
					}
				} else {
					await this._tree?.expandAll(ConnectionProfileGroup.getSubgroups(treeInput!));
				}
			} else {
				if (this._tree instanceof AsyncServerTree) {
					this._tree.setFocus([]);
				} else {
					this._tree?.clearFocus();
				}
			}
		} else {
			//no op
		}
	}

	/**
	* Searches and sets the tree input to the results
	*/
	public searchTree(searchString: string): void {
		if (!searchString) {
			return;
		}
		this.hideMessages();
		// Clear other actions if user searched during other views
		this._viewKey.set(ServerTreeViewView.all);
		// Filter connections based on search
		const filteredResults = this.searchConnections(searchString);
		if (!filteredResults || filteredResults.length === 0) {
			this.showAndFocusMessages();
		}
		// Add all connections to tree root and set tree input
		const treeInput = new ConnectionProfileGroup('searchroot', undefined, 'searchroot', undefined, undefined);
		treeInput.addConnections(filteredResults);
		this._tree?.setInput(treeInput).then(async () => {
			if (this.messages && isHidden(this.messages)) {
				this._tree?.getFocus();
				if (this._tree instanceof AsyncServerTree) {
					await Promise.all(ConnectionProfileGroup.getSubgroups(treeInput).map(subgroup => {
						this._tree?.expand(subgroup);
					}));
				} else {
					await this._tree?.expandAll(ConnectionProfileGroup.getSubgroups(treeInput));
				}
			} else {
				if (this._tree instanceof AsyncServerTree) {
					this._tree.setFocus([]);
				} else {
					this._tree?.clearFocus();
				}
			}
		}, errors.onUnexpectedError);
	}

	/**
	 * Searches through all the connections and returns a list of matching connections
	 */
	private searchConnections(searchString: string): ConnectionProfile[] {
		const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		if (root) {
			const connections = ConnectionProfileGroup.getConnectionsInGroup(root);
			const results = connections.filter(con => {
				if (searchString && (searchString.length > 0)) {
					return this.isMatch(con, searchString);
				} else {
					return false;
				}
			});
			return results;
		}
		return [];
	}

	/**
	 * Returns true if the connection matches the search string.
	 * For now, the search criteria is true if the
	 * server name or database name contains the search string (ignores case).
	 */
	private isMatch(connection: ConnectionProfile, searchString: string): boolean {
		searchString = searchString.trim().toLocaleUpperCase();
		if (this.checkIncludes(searchString, connection.databaseName) || this.checkIncludes(searchString, connection.serverName)) {
			return true;
		}
		return false;
	}

	private checkIncludes(searchString: string, candidate: string): boolean {
		if (candidate && searchString) {
			return candidate.toLocaleUpperCase().indexOf(searchString) > -1;
		}
		return false;
	}

	private onSelected(event: any): void {
		if (this._tree) {
			this._treeSelectionHandler.onTreeSelect(event, this._tree,
				this._connectionManagementService,
				this._objectExplorerService,
				this._capabilitiesService,
				() => this._onSelectionOrFocusChange.fire(),
				(node) => { this.onTreeNodeDoubleClick(node).catch(errors.onUnexpectedError); });
			this._onSelectionOrFocusChange.fire();
		}
	}

	/**
	 * set the layout of the view
	 */
	public layout(height: number): void {
		this._tree?.layout(height);
	}

	/**
	 * Get the list of selected nodes in the tree
	*/
	public getSelection(): any[] {
		return this._tree?.getSelection();
	}

	/**
	 * Get whether the tree view currently has focus
	*/
	public isFocused(): boolean {
		return this._tree?.getHTMLElement() === document.activeElement;
	}

	/**
	 * Set whether the given element is expanded or collapsed
	 */
	public async setExpandedState(element: ServerTreeElement, expandedState?: TreeItemCollapsibleState): Promise<void> {
		if (expandedState === TreeItemCollapsibleState.Collapsed) {
			return this._tree?.collapse(element);
		} else if (expandedState === TreeItemCollapsibleState.Expanded) {
			return this._tree?.expand(element);
		}
	}

	/**
	 * Reveal the given element in the tree
	 */
	public async reveal(element: ServerTreeElement): Promise<void> {
		return this._tree?.reveal(element);
	}

	/**
	 * Select the given element in the tree and clear any other selections
	 */
	public async setSelected(element: ServerTreeElement, selected?: boolean, clearOtherSelections?: boolean): Promise<void> {
		if (clearOtherSelections || (selected && clearOtherSelections !== false)) {
			if (this._tree instanceof AsyncServerTree) {
				this._tree.setSelection([]);
			} else {
				this._tree?.clearSelection();
			}
		}
		if (selected) {
			if (this._tree instanceof AsyncServerTree) {
				this._tree.setSelection(this._tree.getSelection().concat(element));
				this._tree.reveal(element);
			} else {
				this._tree?.select(element);
				return this._tree?.reveal(element);
			}
		} else {
			if (this._tree instanceof AsyncServerTree) {
				this._tree.setSelection(this._tree.getSelection().filter(item => item !== element));
			} else {
				this._tree?.deselect(element);
			}
		}
	}

	/**
	 * Check if the given element in the tree is expanded
	 */
	public isExpanded(element: ServerTreeElement): boolean {
		if (this._tree instanceof AsyncServerTree) {
			return !this._tree.getNode(element).collapsed;
		} else {
			return this._tree?.isExpanded(element);
		}
	}

	/**
	 * Return actions in the context menu
	 */
	private onTreeNodeContextMenu(e: ITreeContextMenuEvent<ServerTreeElement>): void {
		if (e.element) {
			e.browserEvent.preventDefault();
			e.browserEvent.stopPropagation();
			this._tree?.setSelection([e.element]);
			const actionContext = this.getActionContext(e.element);
			this._contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => this._tree ? this._actionProvider.getActions(this._tree, e.element) : [],
				getKeyBinding: (action) => this._keybindingService.lookupKeybinding(action.id),
				onHide: (wasCancelled?: boolean) => {
					if (wasCancelled) {
						this._tree?.domFocus();
					}
				},
				getActionsContext: () => (actionContext)
			});
		}
	}

	private async onTreeNodeDoubleClick(node: ServerTreeElement): Promise<void> {
		const action = this._actionProvider.getDefaultAction(this.tree, node);

		if (action) {
			this._actionRunner.run(action, this.getActionContext(node)).catch(errors.onUnexpectedError);
		} else {
			// If no default action is defined, fallback to the default behavior of opening the dashboard.
			// Open dashboard on double click for server and database nodes
			let connectionProfile: ConnectionProfile | undefined;
			if (node instanceof ConnectionProfile) {
				connectionProfile = node;
				await TreeUpdateUtils.connectAndCreateOeSession(connectionProfile, {
					saveTheConnection: true,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true,
					showDashboard: true
				}, this._connectionManagementService, this._objectExplorerService, this.tree);
			} else if (node instanceof TreeNode) {
				if (TreeUpdateUtils.isAvailableDatabaseNode(node)) {
					connectionProfile = TreeUpdateUtils.getConnectionProfile(node);
					this._connectionManagementService.showDashboard(connectionProfile);
				}
			}
		}

		// In case of error node, we need to show the error message
		if (node instanceof TreeNode) {
			if (node.objectType === ERROR_NODE_TYPE) {
				this.showError(node.label);
			}
		}
	}

	public getActionContext(element: ServerTreeElement): any {
		let actionContext: any;
		if (element instanceof TreeNode) {
			let context = new ObjectExplorerActionsContext();
			context.nodeInfo = element.toNodeInfo();
			// Note: getting DB name before, but intentionally not using treeUpdateUtils.getConnectionProfile as it replaces
			// the connection ID with a new one. This breaks a number of internal tasks
			context.connectionProfile = element.getConnectionProfile()!.toIConnectionProfile();
			context.connectionProfile.databaseName = element.getDatabaseName();
			actionContext = context;
		} else if (element instanceof ConnectionProfile) {
			let context = new ObjectExplorerActionsContext();
			context.connectionProfile = element.toIConnectionProfile();
			context.isConnectionNode = true;
			actionContext = context;
		} else {
			// TODO: because the connection group is used as a context object and isn't serializable,
			// the Group-level context menu is not currently extensible
			actionContext = element;
		}
		return actionContext;
	}

	public collapseAllConnections(): void {
		const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		if (root) {
			const connections = ConnectionProfileGroup.getConnectionsInGroup(root);
			connections.forEach(con => {
				this._tree?.collapse(con, true);
			});
		}
	}
}
