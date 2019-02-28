/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'sqlops' {
	import * as vscode from 'vscode';

	/**
	 * Namespace for interacting with Object Explorer
	*/
	export namespace objectexplorer {
		/**
		 * Get an Object Explorer node corresponding to the given connection and path. If no path
		 * is given, it returns the top-level node for the given connection. If there is no node at
		 * the given path, it returns undefined.
		 * @param {string} connectionId The id of the connection that the node exists on
		 * @param {string?} nodePath The path of the node to get
		 * @returns {ObjectExplorerNode} The node corresponding to the given connection and path,
		 * or undefined if no such node exists.
		*/
		export function getNode(connectionId: string, nodePath?: string): Thenable<ObjectExplorerNode>;

		/**
		 * Get all active Object Explorer connection nodes
		 * @returns {ObjectExplorerNode[]} The Object Explorer nodes for each saved connection
		*/
		export function getActiveConnectionNodes(): Thenable<ObjectExplorerNode[]>;

		/**
		 * Find Object Explorer nodes that match the given information
		 * @param {string} connectionId The id of the connection that the node exists on
		 * @param {string} type The type of the object to retrieve
		 * @param {string} schema The schema of the object, if applicable
		 * @param {string} name The name of the object
		 * @param {string} database The database the object exists under, if applicable
		 * @param {string[]} parentObjectNames A list of names of parent objects in the tree, ordered from highest to lowest level
		 * (for example when searching for a table's column, provide the name of its parent table for this argument)
		 */
		export function findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<ObjectExplorerNode[]>;

		/**
		 * Get connectionProfile from sessionId
		 * *@param {string} sessionId The id of the session that the node exists on
		 * @returns {IConnectionProfile} The IConnecitonProfile for the session
		 */
		export function getSessionConnectionProfile(sessionId: string): Thenable<IConnectionProfile>;

		/**
		 * Interface for representing and interacting with items in Object Explorer
		*/
		export interface ObjectExplorerNode extends NodeInfo {
			/**
			 * The id of the connection that the node exists under
			 */
			connectionId: string;

			/**
			 * Whether the node is currently expanded in Object Explorer
			 */
			isExpanded(): Thenable<boolean>;

			/**
			 * Set whether the node is expanded or collapsed
			 * @param expandedState The new state of the node. If 'None', the node will not be changed
			 */
			setExpandedState(expandedState: vscode.TreeItemCollapsibleState): Thenable<void>;

			/**
			 * Set whether the node is selected
			 * @param selected Whether the node should be selected
			 * @param clearOtherSelections If true, clear any other selections. If false, leave any existing selections.
			 * Defaults to true when selected is true and false when selected is false.
			 */
			setSelected(selected: boolean, clearOtherSelections?: boolean): Thenable<void>;

			/**
			 * Get all the child nodes. Returns an empty list if there are no children.
			 */
			getChildren(): Thenable<ObjectExplorerNode[]>;

			/**
			 * Get the parent node. Returns undefined if there is none.
			 */
			getParent(): Thenable<ObjectExplorerNode>;

			/**
			 * Refresh the node, expanding it if it has children
			 */
			refresh(): Thenable<void>;
		}
	}
}