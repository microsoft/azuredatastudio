/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/serverTreeActions';
import * as errors from 'vs/base/common/errors';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { Disposable } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Event, Emitter } from 'vs/base/common/event';
import { append, $, hide, show } from 'vs/base/browser/dom';

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import * as ConnectionUtils from 'sql/platform/connection/common/utils';
import { ActiveConnectionsFilterAction } from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeCreationUtils } from 'sql/workbench/services/objectExplorer/browser/treeCreationUtils';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/workbench/services/objectExplorer/browser/treeSelectionHandler';
import { IObjectExplorerService, IServerTreeView } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Button } from 'sql/base/browser/ui/button/button';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { TreeNode, TreeItemCollapsibleState } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { SERVER_GROUP_AUTOEXPAND_CONFIG } from 'sql/workbench/contrib/objectExplorer/common/serverGroup.contribution';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ServerTreeActionProvider } from 'sql/workbench/services/objectExplorer/browser/serverTreeActionProvider';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { isHidden } from 'sql/base/browser/dom';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { startsWith } from 'vs/base/common/strings';
import { SERVER_GROUP_CONFIG } from 'sql/workbench/services/serverGroup/common/interfaces';
import { horizontalScrollingKey } from 'vs/platform/list/browser/listService';

/**
 * ServerTreeview implements the dynamic tree view.
 */
export class ServerTreeView extends Disposable implements IServerTreeView {

	public messages: HTMLElement;
	private _buttonSection: HTMLElement;
	private _treeSelectionHandler: TreeSelectionHandler;
	private _activeConnectionsFilterAction: ActiveConnectionsFilterAction;
	private _tree: ITree;
	private _onSelectionOrFocusChange: Emitter<void>;
	private _actionProvider: ServerTreeActionProvider;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IThemeService private _themeService: IThemeService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ICapabilitiesService capabilitiesService: ICapabilitiesService
	) {
		super();
		this._activeConnectionsFilterAction = this._instantiationService.createInstance(
			ActiveConnectionsFilterAction,
			ActiveConnectionsFilterAction.ID,
			ActiveConnectionsFilterAction.LABEL,
			this);
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._onSelectionOrFocusChange = new Emitter();
		this._actionProvider = this._instantiationService.createInstance(ServerTreeActionProvider);
		capabilitiesService.onCapabilitiesRegistered(async () => {
			if (this._connectionManagementService.hasRegisteredServers()) {
				await this.refreshTree();
				this._treeSelectionHandler.onTreeActionStateChange(false);
			}
		});
		this.registerCommands();
	}

	/**
	 * Get active connections filter action
	 */
	public get activeConnectionsFilterAction(): ActiveConnectionsFilterAction {
		return this._activeConnectionsFilterAction;
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

	public get tree(): ITree {
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
		hide(this.messages);

		if (!this._connectionManagementService.hasRegisteredServers()) {
			this._activeConnectionsFilterAction.enabled = false;
			this._buttonSection = append(container, $('.button-section'));
			const connectButton = new Button(this._buttonSection);
			connectButton.label = localize('serverTree.addConnection', "Add Connection");
			this._register(attachButtonStyler(connectButton, this._themeService));
			this._register(connectButton.onDidClick(() => {
				this._connectionManagementService.showConnectionDialog();
			}));
		}

		const horizontalScrollEnabled: boolean = this._configurationService.getValue(horizontalScrollingKey) || false;
		this._tree = this._register(TreeCreationUtils.createRegisteredServersTree(container, this._instantiationService, horizontalScrollEnabled));
		//this._tree.setInput(undefined);
		this._register(this._tree.onDidChangeSelection((event) => this.onSelected(event)));
		this._register(this._tree.onDidBlur(() => this._onSelectionOrFocusChange.fire()));
		this._register(this._tree.onDidChangeFocus(() => this._onSelectionOrFocusChange.fire()));

		// Theme styler
		this._register(attachListStyler(this._tree, this._themeService));

		// Refresh Tree when these events are emitted
		this._register(this._connectionManagementService.onAddConnectionProfile((newProfile: IConnectionProfile) => {
			this.handleAddConnectionProfile(newProfile).catch(errors.onUnexpectedError);
		}));
		this._register(this._connectionManagementService.onDeleteConnectionProfile(() => {
			this.refreshTree().catch(errors.onUnexpectedError);
		}));
		this._register(this._connectionManagementService.onDisconnect((connectionParams) => {
			if (this.isObjectExplorerConnectionUri(connectionParams.connectionUri)) {
				this.deleteObjectExplorerNodeAndRefreshTree(connectionParams.connectionProfile).catch(errors.onUnexpectedError);
			}
		}));

		if (this._objectExplorerService && this._objectExplorerService.onUpdateObjectExplorerNodes) {
			this._register(this._objectExplorerService.onUpdateObjectExplorerNodes(args => {
				if (args.errorMessage) {
					this.showError(args.errorMessage);
				}
				if (args.connection) {
					this.onObjectExplorerSessionCreated(args.connection);
				}
			}));
		}

		return new Promise<void>(async (resolve, reject) => {
			await this.refreshTree();
			const root = <ConnectionProfileGroup>this._tree.getInput();

			const expandGroups: boolean = this._configurationService.getValue(SERVER_GROUP_CONFIG)[SERVER_GROUP_AUTOEXPAND_CONFIG];
			if (expandGroups) {
				await this._tree.expandAll(ConnectionProfileGroup.getSubgroups(root));
			}

			if (root && !root.hasValidConnections) {
				this._treeSelectionHandler.onTreeActionStateChange(true);
				resolve();
			} else {
				resolve();
			}
		});
	}

	public isObjectExplorerConnectionUri(uri: string): boolean {
		let isBackupRestoreUri: boolean = uri.indexOf(ConnectionUtils.ConnectionUriBackupIdAttributeName) >= 0 ||
			uri.indexOf(ConnectionUtils.ConnectionUriRestoreIdAttributeName) >= 0;
		return uri && startsWith(uri, ConnectionUtils.uriPrefixes.default) && !isBackupRestoreUri;
	}

	private async handleAddConnectionProfile(newProfile: IConnectionProfile): Promise<void> {
		if (newProfile) {
			const groups = this._connectionManagementService.getConnectionGroups();
			const profile = ConnectionUtils.findProfileInGroup(newProfile, groups);
			if (profile) {
				newProfile = profile;
			}
		}

		if (this._buttonSection) {
			hide(this._buttonSection);
			this._activeConnectionsFilterAction.enabled = true;
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
		}
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}

	private getConnectionInTreeInput(connectionId: string): ConnectionProfile {
		const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
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
		return null;
	}

	private onObjectExplorerSessionCreated(connection: IConnectionProfile) {
		const conn = this.getConnectionInTreeInput(connection.id);
		if (conn) {
			this._tree.refresh(conn).then(() => {
				return this._tree.expand(conn).then(() => {
					return this._tree.reveal(conn, 0.5).then(() => {
						this._treeSelectionHandler.onTreeActionStateChange(false);
					});
				});
			}).then(null, errors.onUnexpectedError);
		}
	}

	public addObjectExplorerNodeAndRefreshTree(connection: IConnectionProfile): void {
		hide(this.messages);
		if (!this._objectExplorerService.getObjectExplorerNode(connection)) {
			this._objectExplorerService.updateObjectExplorerNodes(connection).then(() => {
				// The oe request is sent. an event will be raised when the session is created
			}, error => {
			});
		}
	}

	public deleteObjectExplorerNodeAndRefreshTree(connection: IConnectionProfile): Promise<void> {
		if (connection) {
			const conn = this.getConnectionInTreeInput(connection.id);
			if (conn) {
				return this._objectExplorerService.deleteObjectExplorerNode(conn).then(async () => {
					await this._tree.collapse(conn);
					return this._tree.refresh(conn);
				});
			}
		}
		return Promise.resolve();
	}

	public refreshTree(): Promise<void> {
		hide(this.messages);
		this.clearOtherActions();
		return TreeUpdateUtils.registeredServerUpdate(this._tree, this._connectionManagementService);
	}

	public refreshElement(element: any): Promise<void> {
		return this._tree.refresh(element);
	}

	/**
	 * Filter connections based on view (recent/active)
	 */
	private filterConnections(treeInput: ConnectionProfileGroup[], view: string): ConnectionProfileGroup[] {
		if (!treeInput || treeInput.length === 0) {
			return undefined;
		}
		const result = treeInput.map(group => {
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
		});
		return result;
	}

	/**
	 * Set tree elements based on the view (recent/active)
	 */
	public showFilteredTree(view: string): void {
		hide(this.messages);
		// Clear other action views if user switched between two views
		this.clearOtherActions(view);
		const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		let treeInput: ConnectionProfileGroup = null;
		if (root) {
			// Filter results based on view
			const filteredResults = this.filterConnections([root], view);
			if (!filteredResults || !filteredResults[0]) {
				show(this.messages);
				this.messages.focus();
			} else {
				treeInput = filteredResults[0];
			}
			this._tree.setInput(treeInput).then(async () => {
				if (isHidden(this.messages)) {
					this._tree.getFocus();
					await this._tree.expandAll(ConnectionProfileGroup.getSubgroups(treeInput));
				} else {
					this._tree.clearFocus();
				}
			}, errors.onUnexpectedError);
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
		hide(this.messages);
		// Clear other actions if user searched during other views
		this.clearOtherActions();
		// Filter connections based on search
		const filteredResults = this.searchConnections(searchString);
		if (!filteredResults || filteredResults.length === 0) {
			show(this.messages);
			this.messages.focus();
		}
		// Add all connections to tree root and set tree input
		const treeInput = new ConnectionProfileGroup('searchroot', undefined, 'searchroot', undefined, undefined);
		treeInput.addConnections(filteredResults);
		this._tree.setInput(treeInput).then(async () => {
			if (isHidden(this.messages)) {
				this._tree.getFocus();
				await this._tree.expandAll(ConnectionProfileGroup.getSubgroups(treeInput));
			} else {
				this._tree.clearFocus();
			}
		}, errors.onUnexpectedError);
	}

	/**
	 * Searches through all the connections and returns a list of matching connections
	 */
	private searchConnections(searchString: string): ConnectionProfile[] {

		const root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
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

	/**
	 * Clears the toggle icons for active and recent
	 */
	private clearOtherActions(view?: string) {
		if (!view) {
			this._activeConnectionsFilterAction.isSet = false;
		}
		if (view === 'recent') {
			this._activeConnectionsFilterAction.isSet = false;
		}
	}

	private onSelected(event: any): void {
		this._treeSelectionHandler.onTreeSelect(event, this._tree, this._connectionManagementService, this._objectExplorerService, () => this._onSelectionOrFocusChange.fire());
		this._onSelectionOrFocusChange.fire();
	}

	/**
	 * set the layout of the view
	 */
	public layout(height: number): void {
		this._tree.layout(height);
	}

	/**
	 * set the visibility of the view
	 */
	public setVisible(visible: boolean): void {
		if (visible) {
			this._tree.onVisible();
		} else {
			this._tree.onHidden();
		}
	}

	/**
	 * Get the list of selected nodes in the tree
	*/
	public getSelection(): any[] {
		return this._tree.getSelection();
	}

	/**
	 * Get whether the tree view currently has focus
	*/
	public isFocused(): boolean {
		return this._tree.isDOMFocused();
	}

	/**
	 * Set whether the given element is expanded or collapsed
	 */
	public setExpandedState(element: TreeNode | ConnectionProfile, expandedState: TreeItemCollapsibleState): Promise<void> {
		if (expandedState === TreeItemCollapsibleState.Collapsed) {
			return this._tree.collapse(element);
		} else if (expandedState === TreeItemCollapsibleState.Expanded) {
			return this._tree.expand(element);
		}
		return Promise.resolve();
	}

	/**
	 * Reveal the given element in the tree
	 */
	public reveal(element: TreeNode | ConnectionProfile): Promise<void> {
		return this._tree.reveal(element);
	}

	/**
	 * Select the given element in the tree and clear any other selections
	 */
	public setSelected(element: TreeNode | ConnectionProfile, selected: boolean, clearOtherSelections: boolean): Promise<void> {
		if (clearOtherSelections || (selected && clearOtherSelections !== false)) {
			this._tree.clearSelection();
		}
		if (selected) {
			this._tree.select(element);
			return this._tree.reveal(element);
		} else {
			this._tree.deselect(element);
			return Promise.resolve();
		}
	}

	/**
	 * Check if the given element in the tree is expanded
	 */
	public isExpanded(element: TreeNode | ConnectionProfile): boolean {
		return this._tree.isExpanded(element);
	}
}
