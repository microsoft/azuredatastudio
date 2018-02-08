/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/serverTreeActions';
import * as errors from 'vs/base/common/errors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as builder from 'vs/base/browser/builder';
import Severity from 'vs/base/common/severity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';

import { ConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import * as ConnectionUtils from 'sql/parts/connection/common/utils';
import { ActiveConnectionsFilterAction } from 'sql/parts/registeredServer/viewlet/connectionTreeAction';
import { IConnectionManagementService, IErrorMessageService } from 'sql/parts/connection/common/connectionManagement';
import { TreeCreationUtils } from 'sql/parts/registeredServer/viewlet/treeCreationUtils';
import { TreeUpdateUtils } from 'sql/parts/registeredServer/viewlet/treeUpdateUtils';
import { TreeSelectionHandler } from 'sql/parts/registeredServer/viewlet/treeSelectionHandler';
import { IObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { Button } from 'sql/base/browser/ui/button/button';
import { attachButtonStyler } from 'sql/common/theme/styler';
import Event, { Emitter } from 'vs/base/common/event';

const $ = builder.$;

/**
 * ServerTreeview implements the dynamic tree view.
 */
export class ServerTreeView {

	public messages: builder.Builder;
	private _buttonSection: builder.Builder;
	private _treeSelectionHandler: TreeSelectionHandler;
	private _activeConnectionsFilterAction: ActiveConnectionsFilterAction;
	private _tree: ITree;
	private _toDispose: IDisposable[] = [];
	private _onSelectionOrFocusChange: Emitter<void>;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IThemeService private _themeService: IThemeService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
	) {
		this._activeConnectionsFilterAction = this._instantiationService.createInstance(
			ActiveConnectionsFilterAction,
			ActiveConnectionsFilterAction.ID,
			ActiveConnectionsFilterAction.LABEL,
			this);
		this._treeSelectionHandler = this._instantiationService.createInstance(TreeSelectionHandler);
		this._onSelectionOrFocusChange = new Emitter();
		if (this._capabilitiesService) {
			this._capabilitiesService.onCapabilitiesReady().then(() => {
				if (this._connectionManagementService.hasRegisteredServers()) {
					this.refreshTree();
					this._treeSelectionHandler.onTreeActionStateChange(false);
				}
			});
		}
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

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): Thenable<void> {
		// Add div to display no connections found message and hide it by default
		this.messages = $('div.title').appendTo(container);
		$('span').style('padding-left', '10px').text('No connections found.').appendTo(this.messages);
		this.messages.hide();

		if (!this._connectionManagementService.hasRegisteredServers()) {
			this._activeConnectionsFilterAction.enabled = false;
			this._buttonSection = $('div.button-section').appendTo(container);
			var connectButton = new Button(this._buttonSection);
			connectButton.label = localize('addConnection', 'Add Connection');
			this._toDispose.push(attachButtonStyler(connectButton, this._themeService));
			this._toDispose.push(connectButton.onDidClick(() => {
				this._connectionManagementService.showConnectionDialog();
			}));
		}

		this._tree = TreeCreationUtils.createRegisteredServersTree(container, this._instantiationService);
		//this._tree.setInput(undefined);
		this._toDispose.push(this._tree.onDidChangeSelection((event) => this.onSelected(event)));
		this._toDispose.push(this._tree.onDidBlur(() => this._onSelectionOrFocusChange.fire()));
		this._toDispose.push(this._tree.onDidChangeFocus(() => this._onSelectionOrFocusChange.fire()));

		// Theme styler
		this._toDispose.push(attachListStyler(this._tree, this._themeService));

		const self = this;
		// Refresh Tree when these events are emitted
		this._toDispose.push(this._connectionManagementService.onAddConnectionProfile((newProfile: IConnectionProfile) => {
			self.handleAddConnectionProfile(newProfile);
		})
		);
		this._toDispose.push(this._connectionManagementService.onDeleteConnectionProfile(() => {
			self.refreshTree();
		})
		);
		this._toDispose.push(this._connectionManagementService.onDisconnect((connectionParams) => {
			if (self.isObjectExplorerConnectionUri(connectionParams.connectionUri)) {
				self.deleteObjectExplorerNodeAndRefreshTree(connectionParams.connectionProfile);
			}
		}));

		if (this._objectExplorerService && this._objectExplorerService.onUpdateObjectExplorerNodes) {
			this._toDispose.push(this._objectExplorerService.onUpdateObjectExplorerNodes(args => {
				if (args.errorMessage) {
					this.showError(args.errorMessage);
				}
				if (args.connection) {
					self.onObjectExplorerSessionCreated(args.connection);
				}
			}));
		}
		return new Promise<void>((resolve, reject) => {
			self.refreshTree();
			let root = <ConnectionProfileGroup>this._tree.getInput();
			if (root && !root.hasValidConnections) {
				this._treeSelectionHandler.onTreeActionStateChange(true);
				resolve();
			} else {
				resolve();
			}
		});
	}

	private isObjectExplorerConnectionUri(uri: string): boolean {
		let isBackupRestoreUri: boolean = uri.indexOf(ConnectionUtils.ConnectionUriBackupIdAttributeName) >= 0 ||
			uri.indexOf(ConnectionUtils.ConnectionUriRestoreIdAttributeName) >= 0;
		return uri && uri.startsWith(ConnectionUtils.uriPrefixes.default) && !isBackupRestoreUri;
	}

	private handleAddConnectionProfile(newProfile: IConnectionProfile) {
		if (newProfile) {
			let groups = this._connectionManagementService.getConnectionGroups();
			let profile = ConnectionUtils.findProfileInGroup(newProfile, groups);
			if (profile) {
				newProfile = profile;
			}
		}

		if (this._buttonSection) {
			this._buttonSection.getHTMLElement().style.display = 'none';
			this._activeConnectionsFilterAction.enabled = true;
		}
		let currentSelections = this._tree.getSelection();
		let currentSelectedElement = currentSelections && currentSelections.length >= 1 ? currentSelections[0] : undefined;
		let newProfileIsSelected = currentSelectedElement && newProfile ? currentSelectedElement.id === newProfile.id : false;
		if (newProfile && currentSelectedElement && !newProfileIsSelected) {
			this._tree.clearSelection();
		}
		this.refreshTree();
		if (newProfile && !newProfileIsSelected) {
			this._tree.reveal(newProfile);
			this._tree.select(newProfile);
		}
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}

	private getConnectionInTreeInput(connectionId: string): ConnectionProfile {
		let root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		let connections = ConnectionProfileGroup.getConnectionsInGroup(root);
		let results = connections.filter(con => {
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
		var conn = this.getConnectionInTreeInput(connection.id);
		if (conn) {
			this._tree.refresh(conn).then(() => {
				return this._tree.expand(conn).then(() => {
					return this._tree.reveal(conn, 0.5).then(() => {
						this._treeSelectionHandler.onTreeActionStateChange(false);
					});
				});
			}).done(null, errors.onUnexpectedError);
		}
	}

	public addObjectExplorerNodeAndRefreshTree(connection: IConnectionProfile): void {
		this.messages.hide();
		if (!this._objectExplorerService.getObjectExplorerNode(connection)) {
			this._objectExplorerService.updateObjectExplorerNodes(connection).then(() => {
				// The oe request is sent. an event will be raised when the session is created
			}, error => {
			});
		}
	}

	public deleteObjectExplorerNodeAndRefreshTree(connection: IConnectionProfile): void {
		if (connection) {
			var conn = this.getConnectionInTreeInput(connection.id);
			if (conn) {
				this._objectExplorerService.deleteObjectExplorerNode(conn);
				this._tree.collapse(conn);
				this._tree.refresh(conn);
			}
		}
	}

	public refreshTree(): void {
		this.messages.hide();
		this.clearOtherActions();
		TreeUpdateUtils.registeredServerUpdate(this._tree, this._connectionManagementService);
	}

	/**
	 * Filter connections based on view (recent/active)
	 */
	private filterConnections(treeInput: ConnectionProfileGroup[], view: string): ConnectionProfileGroup[] {
		if (!treeInput || treeInput.length === 0) {
			return undefined;
		}
		let result = treeInput.map(group => {
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

		const self = this;
		this.messages.hide();
		// Clear other action views if user switched between two views
		this.clearOtherActions(view);
		let root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		let treeInput: ConnectionProfileGroup = null;
		if (root) {
			// Filter results based on view
			let filteredResults = this.filterConnections([root], view);
			if (!filteredResults || !filteredResults[0]) {
				this.messages.show();
				this.messages.domFocus();
			} else {
				treeInput = filteredResults[0];
			}
			this._tree.setInput(treeInput).done(() => {
				if (this.messages.isHidden()) {
					self._tree.getFocus();
					self._tree.expandAll(ConnectionProfileGroup.getSubgroups(treeInput));
				} else {
					self._tree.clearFocus();
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
		const self = this;
		this.messages.hide();
		// Clear other actions if user searched during other views
		this.clearOtherActions();
		// Filter connections based on search
		let filteredResults = this.searchConnections(searchString);
		if (!filteredResults || filteredResults.length === 0) {
			this.messages.show();
			this.messages.domFocus();
		}
		// Add all connections to tree root and set tree input
		let treeInput = new ConnectionProfileGroup('searchroot', undefined, 'searchroot', undefined, undefined);
		treeInput.addConnections(filteredResults);
		this._tree.setInput(treeInput).done(() => {
			if (this.messages.isHidden()) {
				self._tree.getFocus();
				self._tree.expandAll(ConnectionProfileGroup.getSubgroups(treeInput));
			} else {
				self._tree.clearFocus();
			}
		}, errors.onUnexpectedError);
	}

	/**
	 * Searches through all the connections and returns a list of matching connections
	 */
	private searchConnections(searchString: string): ConnectionProfile[] {

		let root = TreeUpdateUtils.getTreeInput(this._connectionManagementService);
		let connections = ConnectionProfileGroup.getConnectionsInGroup(root);
		let results = connections.filter(con => {
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
			return candidate.toLocaleUpperCase().includes(searchString);
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
	 * dispose the server tree view
	 */
	public dispose(): void {
		this._tree.dispose();
		this._toDispose = dispose(this._toDispose);
	}
}