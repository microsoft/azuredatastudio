/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IListService, IWorkbenchAsyncDataTreeOptions, WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { FuzzyScore } from 'vs/base/common/filters';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IAsyncDataTreeNode, IAsyncDataTreeUpdateChildrenOptions, IAsyncDataTreeViewState } from 'vs/base/browser/ui/tree/asyncDataTree';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IAsyncDataSource, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

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
		@IKeybindingService keybindingService: IKeybindingService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
	) {
		super(
			user, container, delegate,
			renderers, dataSource, options,
			contextKeyService, listService,
			themeService, configurationService, keybindingService, accessibilityService);

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

	// Overriding the setInput method to dispose the original input when a new input is set
	override async setInput(input: ConnectionProfileGroup, viewState?: IAsyncDataTreeViewState): Promise<void> {
		const originalInput = this.getInput();
		await super.setInput(input, viewState);
		originalInput?.dispose();
	}

	/**
	 * The original implementation of getDataNode compares refrences of the elements to find the node.
	 * This is not working for our case as we are creating new elements everytime we refresh the tree.
	 * This method overrides the original implementation to find the node by comparing the ids of the elements.
	 * If the node is not found in the original implementation, we search for the node in the nodes map by ids.
	 */
	public override getDataNode(element: ConnectionProfileGroup | ServerTreeElement): IAsyncDataTreeNode<ConnectionProfileGroup, ServerTreeElement> {
		try {
			const node = super.getDataNode(element);
			return node;
		} catch (e) {
			let node = this.getDataNodeById(element?.id);
			if (node) {
				return node;
			}
			throw e;
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
				if (!this.isCollapsed(node.element)) {
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

	public override async updateChildren(element?: ServerTreeElement, recursive?: boolean, rerender?: boolean, options?: IAsyncDataTreeUpdateChildrenOptions<ServerTreeElement>): Promise<void> {
		const viewState = this.getExpandedState(element);
		await super.updateChildren(element, recursive, rerender, options);
		await this.expandElements(viewState);
	}

	public async expandElements(elements: ServerTreeElement[]): Promise<void> {
		for (let element of elements) {
			const id = element.id;
			const node = this.getDataNodeById(id);
			if (node) {
				await this.expand(node.element);
			} else {
				// If the node is not found in the nodes map, we search for the node by comparing the relative paths of the elements
				if (element) {
					const elementPath = this.getRelativePath(element);
					for (let n of this.nodes.values()) {
						if (this.getRelativePath(n.element) === elementPath) {
							await this.expand(n.element);
							break;
						}
					}
				}
			}
		}
	}

	/**
	 * Get the relative path of the element in the tree. For connection and group, the path is the id of the element.
	 * For other elements, the path is the node path of the element and the id of the connection they belong to.
	 */
	private getRelativePath(element: ServerTreeElement): string {
		let path = '';
		if (element instanceof TreeNode) {
			path = element.nodePath;
			let parent = element.parent;
			while (parent.parent) {
				parent = parent.parent;
			}
			if (parent.connection) {
				path = parent.connection.id + '/' + path;
			}
		} else if (element instanceof ConnectionProfile || element instanceof ConnectionProfileGroup) {
			path = element.id;
		}
		return path;
	}

	/**
	 * Mark the element as dirty so that it will be refreshed when it is expanded next time
	 * @param element The element to mark as dirty
	 */
	public async makeElementDirty(element: ServerTreeElement) {
		this.getDataNode(element).stale = true;
	}

	public async revealSelectFocusElement(element: ServerTreeElement) {
		await this.reveal(element);
		await this.setSelection([element]);
		this.setFocus([element]);
	}
}

export type ServerTreeElement = ConnectionProfile | ConnectionProfileGroup | TreeNode;
