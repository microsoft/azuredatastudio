/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

/**
 * The API provided by this extension
 *
 * @export
 * @interface IExtensionApi
 */
export interface IExtensionApi {
	/**
	 * Gets the object explorer API that supports querying over the connections supported by this extension
	 *
	 * @returns {IObjectExplorerBrowser}
	 * @memberof IExtensionApi
	 */
	getObjectExplorerBrowser(): IObjectExplorerBrowser;
}

/**
 * A browser supporting actions over the object explorer connections provided by this extension.
 * Currently this is the
 *
 * @export
 * @interface IObjectExplorerBrowser
 */
export interface IObjectExplorerBrowser {
	/**
	 * Gets the matching node given a context object, e.g. one from a right-click on a node in Object Explorer
	 *
	 * @param {azdata.ObjectExplorerContext} objectExplorerContext
	 * @returns {Promise<T>}
	 */
	getNode<T extends ITreeNode>(objectExplorerContext: azdata.ObjectExplorerContext): Promise<T>;
}

/**
 * A tree node in the object explorer tree
 *
 * @export
 * @interface ITreeNode
 */
export interface ITreeNode {
	getNodeInfo(): azdata.NodeInfo;
	getChildren(refreshChildren: boolean): ITreeNode[] | Promise<ITreeNode[]>;
}

/**
 * A HDFS file node. This is a leaf node in the object explorer tree, and its contents
 * can be queried
 *
 * @export
 * @interface IFileNode
 * @extends {ITreeNode}
 */
export interface IFileNode extends ITreeNode {
	getFileContentsAsString(maxBytes?: number): Promise<string>;
}
