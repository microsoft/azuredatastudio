/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IIdentityProvider } from 'vs/base/browser/ui/list/list';
import { ObjectTree } from 'vs/base/browser/ui/tree/objectTree';
import { ITreeElement } from 'vs/base/browser/ui/tree/tree';
import { IActionableTestTreeElement, TestExplorerTreeElement, TestItemTreeElement, TestTreeErrorMessage } from 'vs/workbench/contrib/testing/browser/explorerProjections/index';

const testIdentityProvider: IIdentityProvider<TestExplorerTreeElement> = {
	getId(element) {
		return element.treeId + '\0' + (element instanceof TestTreeErrorMessage ? 'error' : element.test.expand);
	}
};

/**
 * Returns whether there are any children for other nodes besides this one
 * in the tree.
 *
 * This is used for omitting test provider nodes if there's only a single
 * test provider in the workspace (the common case)
 */
export const peersHaveChildren = (node: IActionableTestTreeElement, roots: () => Iterable<IActionableTestTreeElement>) => {
	for (const child of node.parent ? node.parent.children : roots()) {
		if (child !== node && child.children.size) {
			return true;
		}
	}

	return false;
};

export const enum NodeRenderDirective {
	/** Omit node and all its children */
	Omit,
	/** Concat children with parent */
	Concat
}

export type NodeRenderFn = (
	n: TestExplorerTreeElement,
	recurse: (items: Iterable<TestExplorerTreeElement>) => Iterable<ITreeElement<TestExplorerTreeElement>>,
) => ITreeElement<TestExplorerTreeElement> | NodeRenderDirective;

const pruneNodesNotInTree = (nodes: Set<TestExplorerTreeElement | null>, tree: ObjectTree<TestExplorerTreeElement, any>) => {
	for (const node of nodes) {
		if (node && !tree.hasElement(node)) {
			nodes.delete(node);
		}
	}
};

/**
 * Helper to gather and bulk-apply tree updates.
 */
export class NodeChangeList<T extends TestItemTreeElement> {
	private changedParents = new Set<T | null>();
	private updatedNodes = new Set<TestExplorerTreeElement>();
	private resortedNodes = new Set<TestExplorerTreeElement | null>();
	private omittedNodes = new WeakSet<TestExplorerTreeElement>();
	private isFirstApply = true;

	public updated(node: TestExplorerTreeElement) {
		this.updatedNodes.add(node);
	}

	public addedOrRemoved(node: TestExplorerTreeElement) {
		this.changedParents.add(this.getNearestNotOmittedParent(node));
	}

	public sortKeyUpdated(node: TestExplorerTreeElement) {
		this.resortedNodes.add(node.parent);
	}

	public applyTo(
		tree: ObjectTree<TestExplorerTreeElement, any>,
		renderNode: NodeRenderFn,
		roots: () => Iterable<T>,
	) {
		pruneNodesNotInTree(this.changedParents, tree);
		pruneNodesNotInTree(this.updatedNodes, tree);
		pruneNodesNotInTree(this.resortedNodes, tree);

		const diffDepth = this.isFirstApply ? Infinity : 0;
		this.isFirstApply = false;

		for (let parent of this.changedParents) {
			while (parent && typeof renderNode(parent, () => []) !== 'object') {
				parent = parent.parent as T | null;
			}

			if (parent === null || tree.hasElement(parent)) {
				tree.setChildren(
					parent,
					this.renderNodeList(renderNode, parent === null ? roots() : parent.children),
					{ diffIdentityProvider: testIdentityProvider, diffDepth },
				);
			}
		}

		for (const node of this.updatedNodes) {
			if (tree.hasElement(node)) {
				tree.rerender(node);
			}
		}

		for (const node of this.resortedNodes) {
			if (node && tree.hasElement(node)) {
				tree.resort(node, false);
			}
		}

		this.changedParents.clear();
		this.updatedNodes.clear();
		this.resortedNodes.clear();
	}

	private getNearestNotOmittedParent(node: TestExplorerTreeElement | null) {
		let parent = node && node.parent;
		while (parent && this.omittedNodes.has(parent)) {
			parent = parent.parent;
		}

		return parent as T;
	}

	private *renderNodeList(renderNode: NodeRenderFn, nodes: Iterable<TestExplorerTreeElement>): Iterable<ITreeElement<TestExplorerTreeElement>> {
		for (const node of nodes) {
			const rendered = renderNode(node, this.renderNodeList.bind(this, renderNode));
			if (rendered === NodeRenderDirective.Omit) {
				this.omittedNodes.add(node);
			} else if (rendered === NodeRenderDirective.Concat) {
				this.omittedNodes.add(node);
				if ('children' in node) {
					for (const nested of this.renderNodeList(renderNode, node.children)) {
						yield nested;
					}
				}
			} else {
				this.omittedNodes.delete(node);
				yield rendered;
			}
		}
	}
}
