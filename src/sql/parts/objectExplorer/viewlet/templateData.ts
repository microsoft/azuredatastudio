/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';

export interface IConnectionTemplateData {
	root: HTMLElement;
	label: HTMLSpanElement;
	icon: HTMLElement;
	connectionProfile: ConnectionProfile;
}

export interface IConnectionProfileGroupTemplateData {
	root: HTMLElement;
	name: HTMLSpanElement;
	inputBox: InputBox;
}

export interface IObjectExplorerTemplateData {
	root: HTMLElement;
	label: HTMLSpanElement;
	icon: HTMLElement;
	treeNode: TreeNode;
}