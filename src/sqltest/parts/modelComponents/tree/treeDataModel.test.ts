/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sqlops from 'sqlops';
import { TreeNode } from 'sql/parts/modelComponents/tree/treeDataModel';

'use strict';


suite('TreeDataModel Tests', () => {
	setup(() => {
	});

	function getTestData(): sqlops.TreeComponentDataModel {
		return {
			label: '1',
			children: [
				{
					label: '11',
					id: '11',
					children: [
						{
							label: '111',
							id: '111',
							checked: false
						},
						{
							label: '112',
							id: '112',
							children: [
								{
									label: '1121',
									id: '1121',
									checked: true
								},
								{
									label: '1122',
									id: '1122',
									checked: false
								}
							]
						}
					]
				},
				{
					label: '12',
					id: '12',
					checked: true
				}
			],
			id: '1'
		};
	}

	test('Tree created from input data should have equal tree structure and data', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);
		assert.notEqual(treeNode, undefined, );
		assert.equal(treeNodeIsValid(treeNode, root), true);
	});

	test('Tree created from input data should have correct value set for isAlwaysLeaf', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);
		let node = treeNode.findNode('1121');
		assert.equal(node.label, '1121');
		assert.notEqual(node, undefined);
		assert.equal(node.isAlwaysLeaf, true);

		node = treeNode.findNode('112');
		assert.equal(node.label, '112');
		assert.notEqual(node, undefined);
		assert.equal(node.isAlwaysLeaf, false);

		assert.equal(node.root.parent, undefined);

	});


	test('Tree created from input data should have correct value set for parent', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);

		let parentNode = treeNode.findNode('112');
		assert.equal(parentNode.label, '112');
		assert.notEqual(parentNode, undefined);

		let node = treeNode.findNode('1121');
		assert.equal(node.label, '1121');
		assert.notEqual(node, undefined);
		assert.equal(node.parent, parentNode);

	});

	test('Tree created from input data should have correct value set for root', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);

		let rootNode = treeNode.findNode('1');
		assert.equal(rootNode.label, '1');
		assert.notEqual(rootNode, undefined);
		assert.equal(rootNode.root, rootNode);

		let node = treeNode.findNode('1121');
		assert.equal(node.label, '1121');
		assert.notEqual(node, undefined);
		assert.equal(node.root, rootNode);

	});

	test('Tree created from input data should have correct value set for path', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);

		let rootNode = treeNode.findNode('1');
		assert.equal(rootNode.label, '1');
		assert.notEqual(rootNode, undefined);
		assert.equal(rootNode.nodePath, '1');

		let node = treeNode.findNode('1121');
		assert.equal(node.label, '1121');
		assert.notEqual(node, undefined);
		assert.equal(node.nodePath, '1-11-112-1121');

	});

	test('Changing node checked to true should make all children checked', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);

		let node = treeNode.findNode('11');
		assert.equal(node.label, '11');
		assert.notEqual(node, undefined);
		assert.notEqual(node.children, undefined);
		assert.equal(node.children.length, 2);

		assert.notEqual(node.children.every(c => c.checked === true), true);
		node.changeNodeCheckedState(true);
		assert.equal(node.children.every(c => c.checked === true), true);
	});

	test('Changing node checked to true should change the state of the parent', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);

		let node = treeNode.findNode('1122');
		assert.equal(node.label, '1122');
		let parent = node.parent;
		assert.equal(parent.label, '112');
		assert.notEqual(node.checked, true);
		assert.notEqual(parent.checked, true);
		assert.equal(parent.children.length, 2);
		node.changeNodeCheckedState(true);
		assert.equal(parent.checked, true);
	});

	test('Node hasChildren should return the correct value', () => {
		let root = getTestData();
		let treeNode = TreeNode.createTree(root);

		let node = treeNode.findNode('11');
		assert.equal(node.label, '11');
		assert.notEqual(node, undefined);
		assert.notEqual(node.children, undefined);
		assert.equal(node.children.length, 2);
		assert.equal(node.hasChildren, true);

		node = treeNode.findNode('1122');
		assert.equal(node.label, '1122');
		assert.notEqual(node, undefined);
		assert.equal(node.children, undefined);
		assert.equal(node.hasChildren, false);
	});

	function treeNodeIsValid(node1: TreeNode, node2: sqlops.TreeComponentDataModel): boolean {
		if (node1 === undefined && node2 === undefined) {
			return true;
		} else if (node1 && node2 && ((node1.children && node2.children && node1.children.length === node2.children.length)
			|| ((!node1.children) && (!node2.children)))) {
			let nodeContentsAreEqual: boolean;
			nodeContentsAreEqual =
				((!node2.id) || node1.id === node2.id) &&
				node1.label === node2.label;
			if (nodeContentsAreEqual && node1.children && node2.children) {
				for (let index = 0; index < node1.children.length; index++) {
					const child1 = node1.children[index];
					const child2 = node2.children[index];
					let childrenAreEqual = treeNodeIsValid(child1, child2);
					if (!childrenAreEqual) {
						nodeContentsAreEqual = false;
						break;
					}
				}
			}
			return nodeContentsAreEqual;
		} else {
			return false;
		}
	}
});