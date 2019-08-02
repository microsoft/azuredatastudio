/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';

// import { IProgressRunner, IProgressService } from 'vs/platform/progress/common/progress';
import { TreeNode } from 'sql/workbench/parts/objectExplorer/common/treeNode';
import { TreeUpdateUtils } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';

export class TreeSelectionHandler {
	// progressRunner: IProgressRunner;

	private _clicks: Map<any, number> = new Map();
	private _doubleClickTimeoutTimer: Map<any, NodeJS.Timer> = new Map();

	// constructor(@IProgressService private _progressService: IProgressService) {

	// }

	public onTreeActionStateChange(started: boolean): void {
		// if (this.progressRunner) {
		// 	this.progressRunner.done();
		// }

		// if (started) {
		// 	this.progressRunner = this._progressService.show(true);
		// } else {
		// 	this.progressRunner = null;
		// }
	}

	private isMouseEvent(event: any): boolean {
		return event && event.payload && event.payload.origin === 'mouse';
	}

	/**
	 * Handle selection of tree element
	 */
	public onTreeSelect(event: any, tree: ITree, connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService, connectionCompleteCallback: () => void) {
		let selection = tree.getSelection();

		if (!selection || selection.length === 0) {
			return;
		}
		let specificSelection = selection[0];

		if (this.isMouseEvent(event)) {
			let val = this._clicks.get(specificSelection);
			if (!val) {
				val = 0;
			}
			val++;
			this._clicks.set(selection, val);
		}

		// clear pending click timeouts to avoid sending multiple events on double-click
		let selectionTimer = this._doubleClickTimeoutTimer.get(specificSelection);
		if (selectionTimer) {
			clearTimeout(selectionTimer);
		}

		let isKeyboard = event && event.payload && event.payload.origin === 'keyboard';

		this._doubleClickTimeoutTimer.set(selection, setTimeout(() => {
			// don't send tree update events while dragging
			if (!TreeUpdateUtils.isInDragAndDrop) {
				let isDoubleClick = this._clicks.get(specificSelection) > 1;
				this.handleTreeItemSelected(connectionManagementService, objectExplorerService, isDoubleClick, isKeyboard, selection, tree, connectionCompleteCallback);
			}
			this._clicks.delete(specificSelection);

			process.nextTick(() => {
				this._doubleClickTimeoutTimer.delete(specificSelection);
			});
		}, 300));
	}

	/**
	 *
	 * @param connectionCompleteCallback A function that gets called after a connection is established due to the selection, if needed
	 */
	private handleTreeItemSelected(connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService, isDoubleClick: boolean, isKeyboard: boolean, selection: any[], tree: ITree, connectionCompleteCallback: () => void): void {
		let connectionProfile: ConnectionProfile = undefined;
		let options: IConnectionCompletionOptions = {
			params: undefined,
			saveTheConnection: true,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true,
			showDashboard: isDoubleClick // only show the dashboard if the action is double click
		};
		if (selection && selection.length > 0 && (selection[0] instanceof ConnectionProfile)) {
			connectionProfile = <ConnectionProfile>selection[0];

			if (connectionProfile) {
				this.onTreeActionStateChange(true);

				TreeUpdateUtils.connectAndCreateOeSession(connectionProfile, options, connectionManagementService, objectExplorerService, tree).then(sessionCreated => {
					if (!sessionCreated) {
						this.onTreeActionStateChange(false);
					}
					if (connectionCompleteCallback) {
						connectionCompleteCallback();
					}
				}, error => {
					this.onTreeActionStateChange(false);
				});
			}
		} else if (isDoubleClick && selection && selection.length > 0 && (selection[0] instanceof TreeNode)) {
			let treeNode = selection[0];
			if (TreeUpdateUtils.isAvailableDatabaseNode(treeNode)) {
				connectionProfile = TreeUpdateUtils.getConnectionProfile(treeNode);
				if (connectionProfile) {
					connectionManagementService.showDashboard(connectionProfile);
				}
			}
		}

		if (isKeyboard) {
			tree.toggleExpansion(selection[0]);
		}
	}
}
