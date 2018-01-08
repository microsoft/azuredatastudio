/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import * as tree from 'vs/base/parts/tree/browser/tree';
import { TreeNode } from 'sql/parts/registeredServer/common/treeNode';
import { ServerTreeDataSource } from 'sql/parts/registeredServer/viewlet/serverTreeDataSource';

export declare type ServerTreeResource = ConnectionProfile | TreeNode | ConnectionProfileGroup;
export interface FilterValues {
	filterString: string;
	filterType: string;
};

export class ServerTreeFilter implements tree.IFilter {

	private _dataSource: ServerTreeDataSource;
	private _filterString: string;

	public set DataSource(dataSource: ServerTreeDataSource) {
		this._dataSource = dataSource;
	}

	public isVisible(tree: tree.ITree, element: ServerTreeResource): boolean {
		let isVisible: boolean = false;
		if (this._filterString) {
			let filterValues: FilterValues = this.parseFilterString();

			if (element instanceof ConnectionProfile) {
				let connectionDatabaseNodesVisible: boolean = false;
				this._dataSource.nodesVisibleStates[element.id] = {};
				let rootNode = this._dataSource.ObjectExplorerService.getObjectExplorerNode(<ConnectionProfile>element);
				if (rootNode) {
					if (this.isTreeNodeVisible(tree, rootNode, filterValues, element.id)) {
						connectionDatabaseNodesVisible = true;
					}
				}
				if (connectionDatabaseNodesVisible) {
					isVisible = true;
				} else {
					isVisible = this.isConnectionProfileVisible(element, filterValues.filterString);
				}
			} else if (element instanceof TreeNode) {
				let connection = element.getConnectionProfile();
				let isTreeNodeVisible = connection ? this._dataSource.nodesVisibleStates[connection.id][element.nodePath] : false;
				if (isTreeNodeVisible) {
					isVisible = isTreeNodeVisible;
				} else {
					isVisible = this.isTreeNodeVisible(tree, element, filterValues, connection ? connection.id : undefined);
				}
			} else {
				isVisible = true;
			}
		} else {
			isVisible = true;
		}

		return isVisible;
	}

	private parseFilterString(): FilterValues {
		let filterString = this._filterString.trim().toLowerCase();
		let filterType: string;
		if (filterString.includes(':')) {
			let filterArray = filterString.split(':');

			if (filterArray.length > 2) {
				filterString = filterArray.slice(1, filterArray.length - 1).join(':');
			} else {
				filterString = filterArray[1];
			}
			filterType = filterArray[0].toLowerCase();

			switch (filterType) {
				case 'db':
					filterType = 'Database';
					break;
				case 'sp':
					filterType = 'StoredProcedure';
					break;
				case 'fn':
					filterType = 'Function';
					break;
				default:
					filterType = undefined;
					break;
			}
		}

		return {
			filterString: filterString,
			filterType: filterType
		};
	}

	private isTreeNodeVisible(tree: tree.ITree, node: TreeNode, filterValues: FilterValues, connectionId: string): boolean {
		let treeNodeVisible: boolean = false;

		// If the parent name matches the filter then the children should be visible
		if (this.isParentVisible(node, filterValues)) {
			treeNodeVisible = true;
		}

		if (!treeNodeVisible) {
			let children: TreeNode[] = node.children;
			if (!children) {
				let extendedElements = tree.getExpandedElements();
				if (extendedElements) {
					children = <TreeNode[]>extendedElements.find(x => x instanceof TreeNode && <TreeNode>x.parent && (<TreeNode>x).parent.nodePath === node.nodePath);
				}
			}
			treeNodeVisible = this.IsDatabaseObjectNodeVisible(node, filterValues);
			if (!treeNodeVisible && children) {
				Array.from(children).forEach(child => {
					if (this.isTreeNodeVisible(tree, child, filterValues, connectionId)) {
						treeNodeVisible = true;
					}
				});
			}

		}
		if (connectionId) {
			this._dataSource.nodesVisibleStates[connectionId][node.nodePath] = treeNodeVisible;
		}

		return treeNodeVisible;
	}

	private isParentVisible(node: TreeNode, filterValues: FilterValues): boolean {
		if (node) {
			let parent = node.notFolderParent;
			if (parent && !this.isAlwaysVisible(parent) && this.IsDatabaseObjectNodeVisible(parent, filterValues)) {
				return true;
			} else {
				return this.isParentVisible(parent, filterValues);
			}
		} else {
			return false;
		}
	}

	private isAlwaysVisible(node: TreeNode): boolean {
		return node && node.nodeTypeId === 'Folder';
	}

	// apply filter for database object node
	private IsDatabaseObjectNodeVisible(element: TreeNode, filterValues: FilterValues): boolean {
		if (filterValues.filterType && element.nodeTypeId !== filterValues.filterType) {
			return false;
		}

		if (filterValues.filterString && (filterValues.filterString.length > 0)) {
			return this.checkIncludes(filterValues.filterString, element.label);
		} else {
			return true;
		}
	}

	// apply filter for connection profile
	private isConnectionProfileVisible(element: ConnectionProfile, filterString: string): boolean {
		if (filterString && (filterString.length > 0)) {
			return this.isMatch(element, filterString);
		} else {
			return true;
		}
	}

	/**
	 * Returns true if the connection matches the search string.
	 * For now, the search criteria is true if the
	 * server name or database name contains the search string (ignores case).
	 */
	private isMatch(connection: ConnectionProfile, searchString: string): boolean {

		if (this.checkIncludes(searchString, connection.databaseName) || this.checkIncludes(searchString, connection.serverName)) {
			return true;
		}
		return false;
	}

	private checkIncludes(searchString: string, candidate: string): boolean {
		if (candidate && searchString) {

			return candidate.toLowerCase().includes(searchString);
		}
		return false;
	}

	public set filterString(val: string) {
		this._filterString = val;
	}
}