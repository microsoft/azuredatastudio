/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IListService, IWorkbenchAsyncDataTreeOptions, WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { FuzzyScore } from 'vs/base/common/filters';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IAsyncDataTreeNode, IAsyncDataTreeUpdateChildrenOptions } from 'vs/base/browser/ui/tree/asyncDataTree';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IAsyncDataSource, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class AsyncServerTree extends WorkbenchAsyncDataTree<ConnectionProfileGroup, ServerTreeElement, FuzzyScore> {

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<ServerTreeElement>,
		renderers: ITreeRenderer<ServerTreeElement, FuzzyScore, any>[],
		dataSource: IAsyncDataSource<ConnectionProfileGroup, ServerTreeElement>,
		options: IWorkbenchAsyncDataTreeOptions<ServerTreeElement, FuzzyScore>,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(
			user, container, delegate,
			renderers, dataSource, options,
			instantiationService, contextKeyService, listService,
			configurationService);

		// Adding support for expand/collapse on enter/space
		this.onKeyDown(e => {
			const standardKeyboardEvent = new StandardKeyboardEvent(e);
			if (standardKeyboardEvent.keyCode === KeyCode.Enter || standardKeyboardEvent.keyCode === KeyCode.Space) {
				const selectedElement = this.getSelection()[0];
				if (selectedElement) {
					if (this.isCollapsed(selectedElement)) {
						this.expand(selectedElement);
					} else {
						this.collapse(selectedElement);
					}
				}
			}
		})
	}

	/**
	 * The original implementation of getDataNode compares refrences of the elements to find the node.
	 * This is not working for our case as we are creating new elements everytime we refresh the tree.
	 * This method overrides the original implementation to find the node by comparing the ids of the elements.
	 * If the node is not found in the original implementation, we search for the node in the nodes map by ids.
	 */
	protected override getDataNode(element: ServerTreeElement, throwError: boolean = true): IAsyncDataTreeNode<ConnectionProfileGroup, ServerTreeElement> | undefined {
		try {
			const node = super.getDataNode(element);
			return node;
		} catch (e) {
			let node = this.getDataNodeById(element?.id);
			if (node) {
				return node;
			}
			if (throwError) {
				throw e;
			}
			return undefined;
		}
	}

	/**
	 * Gets the element by id in the tree
	 */
	public getElementById(id: string): ServerTreeElement | undefined {
		if (this.getInput().id === id) {
			return this.getInput();
		}
		return this.getDataNodeById(id)?.element;
	}

	/**
	 * Get the list of expanded elements in the tree
	 */
	public getExpandedState(element: ServerTreeElement): ServerTreeElement[] {
		const node = this.getDataNode(element);
		const stack = [node];
		const expanded: ServerTreeElement[] = [];
		while (stack.length > 0) {
			const node = stack.pop();
			if (node) {
				// The root of the tree is a special case connection group that is always expanded. It is not rendered
				// and this.isCollapsed returns an error when called on it. So we need to check for it explicitly.
				if (node === this.root || !this.isCollapsed(node.element)) {
					expanded.push(node.element);
					if (node.children) {
						node.children.forEach(child => stack.push(child));
					}
				}
			}
		}
		return expanded;
	}

	private getDataNodeById(id: string): IAsyncDataTreeNode<ConnectionProfileGroup, ServerTreeElement> | undefined {
		let node = undefined;
		this.nodes.forEach((v, k) => {
			if (id === v?.id) {
				node = v;
			}
		});
		return node;
	}

	public override async updateChildren(element?: ServerTreeElement, recursive: boolean = false, rerender: boolean = false, options: IAsyncDataTreeUpdateChildrenOptions<ServerTreeElement> = {
		diffDepth: 0
	}): Promise<void> {
		await super.updateChildren(element, recursive, rerender, options);
	}

	/**
	 * Mark the element as dirty so that it will be refreshed when it is expanded next time
	 * @param element The element to mark as dirty
	 */
	public async makeElementDirty(element: ServerTreeElement) {
		this.getDataNode(element).stale = true;
	}

	public revealSelectFocusElement(element: ServerTreeElement) {
		const dataNode = this.getDataNode(element);
		// The root of the tree is a special case as it is not rendered
		// so we instead reveal select and focus on the first child of the root.
		if (dataNode === this.root) {
			element = dataNode.children[0].element;
		}
		this.reveal(element);
		this.setSelection([element]);
		this.setFocus([element]);
	}
}

export type ServerTreeElement = ConnectionProfile | ConnectionProfileGroup | TreeNode;


export class ConnectionError extends Error {
	constructor(message: string, public connection: ConnectionProfile) {
		super(message);
	}
}
