/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService, IConnectionCompletionOptions } from 'sql/platform/connection/common/connectionManagement';
import { ITree } from 'sql/base/parts/tree/browser/tree';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';

// import { IProgressRunner, IProgressService } from 'vs/platform/progress/common/progress';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';

export interface ObjectExplorerRequestStatus {
	inProgress: boolean;
}

export class TreeSelectionHandler {
	// progressRunner: IProgressRunner;

	private _lastClicked: any[] | undefined;
	private _clickTimer: any = undefined;
	private _otherTimer: any = undefined;
	private _requestStatus: ObjectExplorerRequestStatus | undefined = undefined;

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
	 * Handle selection of tree element
	 */
	public onTreeSelect(event: any, tree: AsyncServerTree | ITree, connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService, capabilitiesService: ICapabilitiesService, connectionCompleteCallback: () => void, doubleClickHandler: (node: ServerTreeElement) => void) {
		let sendSelectionEvent = ((event: any, selection: any, isDoubleClick: boolean, userInteraction: boolean, requestStatus: ObjectExplorerRequestStatus | undefined = undefined) => {
			// userInteraction: defensive - don't touch this something else is handling it.
			if (userInteraction === true && this._lastClicked && this._lastClicked[0] === selection[0]) {
				this._lastClicked = undefined;
			}
			if (!TreeUpdateUtils.isInDragAndDrop) {
				this.handleTreeItemSelected(connectionManagementService, objectExplorerService, capabilitiesService, isDoubleClick, this.isKeyboardEvent(event), selection, tree, connectionCompleteCallback, requestStatus, doubleClickHandler).catch(onUnexpectedError);
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
				// Sets request status object when timer is executed
				this._requestStatus = { inProgress: true };
				sendSelectionEvent(event, selection, false, true);
			}, 400);
		} else {
			clearTimeout(this._otherTimer);
			this._otherTimer = setTimeout(() => {
				sendSelectionEvent(event, selection, false, false, this._requestStatus);
			}, 400);
		}
	}

	/**
	 *
	 * @param connectionManagementService
	 * @param objectExplorerService
	 * @param capabilitiesService
	 * @param isDoubleClick
	 * @param isKeyboard
	 * @param selection
	 * @param tree
	 * @param connectionCompleteCallback A function that gets called after a connection is established due to the selection, if needed
	 * @param requestStatus Used to identify if a new session should be created or not to avoid creating back to back sessions
	 * @param doubleClickHandler
	 */
	private async handleTreeItemSelected(connectionManagementService: IConnectionManagementService,
		objectExplorerService: IObjectExplorerService,
		capabilitiesService: ICapabilitiesService,
		isDoubleClick: boolean,
		isKeyboard: boolean,
		selection: any[],
		tree: AsyncServerTree | ITree,
		connectionCompleteCallback: () => void,
		requestStatus: ObjectExplorerRequestStatus | undefined,
		doubleClickHandler: (node: ServerTreeElement) => void): Promise<void> {
		if (!selection || selection.length === 0) {
			return;
		}
		const selectedNode = selection[0];
		if (selectedNode instanceof ConnectionProfile && !capabilitiesService.getCapabilities(selectedNode.providerName)) {
			// Async tree handles unsupported providers through the connection management service
			if (!(tree instanceof AsyncServerTree)) {
				connectionManagementService.handleUnsupportedProvider(selectedNode.providerName).catch(onUnexpectedError);
			}
			return;
		}

		if (tree instanceof AsyncServerTree) {
			if (selectedNode instanceof ConnectionProfile) {
				this.onTreeActionStateChange(true);
			}
		} else {
			if (selectedNode instanceof TreeNode || selectedNode instanceof ConnectionProfile || selectedNode instanceof ConnectionProfileGroup) {
				if (isDoubleClick) {
					doubleClickHandler(selectedNode);
				} else if (selectedNode instanceof ConnectionProfile) {
					let options: IConnectionCompletionOptions = {
						saveTheConnection: true,
						showConnectionDialogOnError: true,
						showFirewallRuleOnError: true,
						showDashboard: false
					};
					this.onTreeActionStateChange(true);

					try {
						const sessionCreated = await TreeUpdateUtils.connectAndCreateOeSession(selectedNode, options, connectionManagementService, objectExplorerService, tree, requestStatus);
						// Clears request status object that was created when the first timeout callback is executed.
						if (this._requestStatus) {
							this._requestStatus = undefined;
						}
						if (!sessionCreated) {
							this.onTreeActionStateChange(false);
						}
						if (connectionCompleteCallback) {
							connectionCompleteCallback();
						}
					} catch (error) {
						this.onTreeActionStateChange(false);
					}
				}
			}

			if (isKeyboard) {
				tree.toggleExpansion(selectedNode);
			}
		}
	}
}
