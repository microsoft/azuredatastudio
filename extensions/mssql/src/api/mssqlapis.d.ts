/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for extensions to expose APIs.

import * as azdata from 'azdata';
import * as vscode from 'vscode';

/**
* The APIs provided by Mssql extension
*
* @export
* @interface MssqlExtensionApi
*/
export interface MssqlExtensionApi {
	/**
	 * Gets the object explorer API that supports querying over the connections supported by this extension
	 *
	 * @returns {IMssqlObjectExplorerBrowser}
	 * @memberof IMssqlExtensionApi
	 */
	getMssqlObjectExplorerBrowser(): MssqlObjectExplorerBrowser;

	/**
	 * Get the Cms Service APIs to communicate with CMS connections supported by this extension
	 *
	 * @returns {Promise<CmsService>}
	 * @memberof IMssqlExtensionApi
	 */
	getCmsServiceProvider(): Promise<CmsService>;
}

/**
 * A browser supporting actions over the object explorer connections provided by this extension.
 * Currently this is the
 *
 * @export
 * @interface MssqlObjectExplorerBrowser
 */
export interface MssqlObjectExplorerBrowser {
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

/**
 *
 * Interface containing all CMS related operations
 */
export interface CmsService {
	/**
	 * Connects to or creates a Central management Server
	 *
	 * @param {string} name
	 * @param {string} description
	 * @param {azdata.ConnectionInfo} connectiondetails
	 * @param {string} ownerUri
	 * @returns {Thenable<azdata.ListRegisteredServersResult>}
	 */
	createCmsServer(name: string, description:string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Thenable<ListRegisteredServersResult>;

	/**
	 * gets all Registered Servers inside a CMS on a particular level
	 *
	 * @param {string} ownerUri
	 * @param {string} relativePath
	 * @returns {Thenable<azdata.ListRegisteredServersResult>}
	 */
	getRegisteredServers(ownerUri: string, relativePath: string): Thenable<ListRegisteredServersResult>;

	/**
	 * Adds a Registered Server inside a CMS on a particular level
	 *
	 * @param {string} ownerUri
	 * @param {string} relativePath
	 * @param {string} registeredServerName
	 * @param {string} registeredServerDescription
	 * @param {azdata.ConnectionInfo} connectiondetails
	 * @returns {Thenable<boolean>>}
	 */
	addRegisteredServer (ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription:string, connectionDetails:azdata.ConnectionInfo): Thenable<boolean>;

	/**
	 * Removes a Registered Server inside a CMS on a particular level
	 *
	 * @param {string} ownerUri
	 * @param {string} relativePath
	 * @param {string} registeredServerName
	 * @returns {Thenable<boolean>}
	 */
	removeRegisteredServer (ownerUri: string, relativePath: string, registeredServerName: string): Thenable<boolean>;

	/**
	 * Adds a Server Group inside a CMS on a particular level
	 *
	 * @param {string} ownerUri
	 * @param {string} relativePath
	 * @param {string} groupName
	 * @param {string} groupDescription
	 * @param {azdata.ConnectionInfo} connectiondetails
	 */
	addServerGroup (ownerUri: string, relativePath: string, groupName: string, groupDescription:string): Thenable<boolean>;

	/**
	 * Removes a Server Group inside a CMS on a particular level
	 *
	 * @param {string} ownerUri
	 * @param {string} relativePath
	 * @param {string} groupName
	 * @param {string} groupDescription
	 */
	removeServerGroup (ownerUri: string, relativePath: string, groupName: string): Thenable<boolean>;
}

/**
 * CMS Result interfaces as passed back to Extensions
 */
export interface RegisteredServerResult {
	name: string;
	serverName: string;
	description: string;
	connectionDetails: azdata.ConnectionInfo;
	relativePath: string;
}

export interface RegisteredServerGroup {
	name: string;
	description: string;
	relativePath: string;
}

export interface ListRegisteredServersResult {
	registeredServersList: Array<RegisteredServerResult>;
	registeredServerGroups: Array<RegisteredServerGroup>;
}

