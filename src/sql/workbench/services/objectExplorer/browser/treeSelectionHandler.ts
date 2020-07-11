/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';

// import { IProgressRunner, IProgressService } from 'vs/platform/progress/common/progress';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';

export class TreeSelectionHandler {
	// progressRunner: IProgressRunner;

	private _lastClicked: any[];
	private _clickTimer: any = undefined;
	private _otherTimer: any = undefined;

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

	private isKeyboardEvent(event: any): boolean {
		return event && event.payload && event.payload.origin === 'keyboard';
	}

	/**
	 * Handle select	ion of tree element
	 */
	public onTreeSelect(event: any, tree: ITree, connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService, connectionCompleteCallback: () => void) {
		let sendSelectionEvent = ((event: any, selection: any, isDoubleClick: boolean, userInteraction: boolean) => {
			// userInteraction: defensive - don't touch this something else is handling it.
			if (userInteraction === true && this._lastClicked && this._lastClicked[0] === selection[0]) {
				this._lastClicked = undefined;
			}
			if (!TreeUpdateUtils.isInDragAndDrop) {
				this.handleTreeItemSelected(connectionManagementService, objectExplorerService, isDoubleClick, this.isKeyboardEvent(event), selection, tree, connectionCompleteCallback);
			}
		});

		let selection = tree.getSelection();

		if (!selection || selection.length === 0) {
			return;
		}
		let specificSelection = selection[0];

		if (this.isMouseEvent(event) || this.isKeyboardEvent(event)) {
			if (this._lastClicked !== undefined) {
				clearTimeout(this._clickTimer);
				let lastSpecificClick = this._lastClicked[0];

				if (lastSpecificClick === specificSelection) {
					sendSelectionEvent(event, selection, true, true);
					return;
				} else {
					sendSelectionEvent(event, this._lastClicked, false, true);
				}
			}
			this._lastClicked = selection;

			this._clickTimer = setTimeout(() => {
				sendSelectionEvent(event, selection, false, true);
			}, 400);
		} else {
			clearTimeout(this._otherTimer);
			this._otherTimer = setTimeout(() => {
				sendSelectionEvent(event, selection, false, false);
			}, 400);
		}
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
