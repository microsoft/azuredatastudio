/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TreeItem } from './treeItem';
import { Dataspace } from '../models/dataspace';
import * as mssql from '../../../mssql/src/mssql';

export class TreeModel {
	private _nodes: mssql.ITreeNode[];

	constructor(private mssqlOeBrowser: mssql.MssqlObjectExplorerBrowser, private context: vscode.ExtensionContext) {
		this._nodes = [];
	}

	private async loadHdfsNode(dataspace: Dataspace): Promise<void> {
		let configuration = dataspace.Configuration;
		let connections = configuration.get<azdata.IConnectionProfile[]>('datasource.connections');
		let allConnections = await azdata.connection.getActiveConnections();
		if (connections.length === 0) {
			return;
		}
		let settings = dataspace.Settings;
		let datasets = [];
		if (settings && 'datasets' in settings) {
			datasets = settings['datasets'];
		}

		for (let index = 0; index < datasets.length; index++) {
			let dataset = datasets[index];
			let nodePath = dataset['nodePath'];
			let connection = connections.find(x => nodePath.startsWith(x.options['server']));
			let activeConnection = allConnections.find(c => c.providerName === connection.providerName && c.options['server'] === connection.options['server']);

			let node = await this.getNode(this.getConnectionProfile(activeConnection), nodePath);
			if (!node) {
				continue;
			}
			//const childNode = children[index];
			let nodeInfo = node.getNodeInfo();

			let datasetNode = this.createNode(nodeInfo.label, nodeInfo.nodeType, null, false);
			this._nodes.push(Object.assign(node, { 'nodeInfo': nodeInfo }));
			datasetNode.treeItem = node;
		}
		if (this._nodes.length === 0) {

			this._nodes.push({
				getNodeInfo: () => {
					return {
						nodePath: '',
						nodeStatus: '',
						nodeType: '',
						nodeSubType: '',
						errorMessage: '',
						isLeaf: false,
						metadata: undefined,
						label: '',
						contextValue: 'root'
					};
				},
				getChildren: () => {
					return [];
				}
			});

		}

		return;
	}

	public getConnectionProfile(connection: azdata.connection.Connection): azdata.IConnectionProfile {
		if (connection && connection.options) {
			let connectionProfile: azdata.IConnectionProfile = {
				connectionName: connection.options.connectionName,
				serverName: connection.options.server,
				databaseName: undefined,
				userName: connection.options.user,
				password: connection.options.password,
				authenticationType: connection.options.authenticationType,
				savePassword: connection.options.savePassword,
				groupFullName: undefined,
				groupId: undefined,
				providerName: connection.providerName,
				saveProfile: false,
				id: connection.connectionId,
				options: connection.options
			};
			return connectionProfile;
		} else {
			return undefined;
		}
	}

	/**
	 * addDataspace
	 */
	public async createModel(dataspace: Dataspace): Promise<void> {
		this._nodes = [];
		await this.loadHdfsNode(dataspace);
		return;
	}

	private async getNode(connection: azdata.IConnectionProfile, nodePath: string): Promise<mssql.ITreeNode> {
		let nodeInfo = {
			nodePath: nodePath,
			nodeStatus: '',
			nodeType: '',
			nodeSubType: '',
			errorMessage: '',
			isLeaf: false,
			metadata: undefined,
			label: '',

		};
		if (connection && this.mssqlOeBrowser) {
			let root = await this.mssqlOeBrowser.getNode({
				isConnectionNode: false,
				nodeInfo: nodeInfo,
				connectionProfile: connection
			});

			return root;
		} else {
			return undefined;
		}
	}

	private createNode(title: string, type: string, parent: TreeItem, isFile: boolean = false): TreeItem {
		let treeNode = new TreeItem({
			title: title,
			type: type
		}, parent, null);

		if (parent) {
			parent.children.push(treeNode);
		}

		if (isFile) {
			type = 'file';
			if (title.endsWith('.ipynb')) {
				type = 'notebook';
			}
			if (title.endsWith('.sql')) {
				type = 'sql';
			}
		} else {
			type = '';
		}

		let treeItem = {
			payload: undefined,
			id: this.generateGuid(),
			tooltip: '',
			contextValue: 'file',
			collapsibleState: 1,
			label: title,
			childProvider: undefined,
			type: type,
			iconPath: {
				dark: this.context.asAbsolutePath(`resources/dark/${type}_inverse.svg`),
				light: this.context.asAbsolutePath(`resources/light/${type}.svg`)
			}
		};
		treeNode.treeItem = treeItem;
		return treeNode;
	}

	public get Nodes(): mssql.ITreeNode[] {
		return this._nodes;
	}

	generateGuid(): string {
		let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
		// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
		let oct: string = '';
		let tmp: number;
		/* tslint:disable:no-bitwise */
		for (let a: number = 0; a < 4; a++) {
			tmp = (4294967296 * Math.random()) | 0;
			oct += hexValues[tmp & 0xF] +
				hexValues[tmp >> 4 & 0xF] +
				hexValues[tmp >> 8 & 0xF] +
				hexValues[tmp >> 12 & 0xF] +
				hexValues[tmp >> 16 & 0xF] +
				hexValues[tmp >> 20 & 0xF] +
				hexValues[tmp >> 24 & 0xF] +
				hexValues[tmp >> 28 & 0xF];
		}

		// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
		let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
		return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
		/* tslint:enable:no-bitwise */
	}
}
