/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';


import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import * as assert from 'assert';

suite('SQL ConnectionProfileGroup tests', () => {
	let root: ConnectionProfileGroup;
	let Groups1 = 'G1';
	let Groups11 = 'G11';
	let Groups2 = 'G2';
	let group1Node: ConnectionProfileGroup;
	let group11Node: ConnectionProfileGroup;
	let group2Node: ConnectionProfileGroup;
	setup(() => {
		root = new ConnectionProfileGroup(ConnectionProfileGroup.RootGroupName, undefined, ConnectionProfileGroup.RootGroupName, undefined, undefined);

		group1Node = new ConnectionProfileGroup(Groups1, root, Groups1, undefined, undefined);
		group2Node = new ConnectionProfileGroup(Groups2, root, Groups2, undefined, undefined);
		group11Node = new ConnectionProfileGroup(Groups11, root, Groups11, undefined, undefined);
		root.addGroups([group1Node]);
		group1Node.addGroups([group11Node]);
		root.addGroups([group2Node]);
	});

	test('Root name should be returned as empty string', () => {
		assert.equal(root.name, '');
	});

	test('Fullname should return the group full name correctly', () => {
		assert.equal(group1Node.fullName, 'G1');
		assert.equal(group2Node.fullName, 'G2');
		assert.equal(group11Node.fullName, 'G1/G11');
	});

	test('getGroupFullNameParts should return a list With ROOT in it given an empty string', () => {
		let groupFullName: string = '';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should return a list With ROOT in it given null', () => {
		let groupFullName: string = undefined;
		let expected: string[] = [ConnectionProfileGroup.RootGroupName];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should return a list With ROOT in it given /', () => {
		let groupFullName: string = '/';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should add ROOT as first item if not added already and string starts with /', () => {
		let groupFullName: string = '/Groups/Group1';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName, 'Groups', 'Group1'];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should add ROOT as first item if not added already', () => {
		let groupFullName: string = 'Groups/Group1';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName, 'Groups', 'Group1'];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should not add ROOT if already added and string starts with /', () => {
		let groupFullName: string = '/ROOT/Groups/Group1';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName, 'Groups', 'Group1'];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should not add ROOT if already added', () => {
		let groupFullName: string = 'ROOT/Groups/Group1';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName, 'Groups', 'Group1'];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('getGroupFullNameParts should not add ROOT if already added and it is not uppercase', () => {
		let groupFullName: string = 'rOOT/Groups/Group1';
		let expected: string[] = [ConnectionProfileGroup.RootGroupName, 'Groups', 'Group1'];
		let actual = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		assert.deepEqual(actual, expected);
	});

	test('isRoot should return true given empty string', () => {
		let name: string = '';
		let expected: boolean = true;
		let actual = ConnectionProfileGroup.isRoot(name);
		assert.deepEqual(actual, expected);
	});

	test('isRoot should return true given null', () => {
		let name: string = undefined;
		let expected: boolean = true;
		let actual = ConnectionProfileGroup.isRoot(name);
		assert.deepEqual(actual, expected);
	});

	test('isRoot should return true given /', () => {
		let name: string = '/';
		let expected: boolean = true;
		let actual = ConnectionProfileGroup.isRoot(name);
		assert.deepEqual(actual, expected);
	});

	test('isRoot should return true given root', () => {
		let name: string = 'root';
		let expected: boolean = true;
		let actual = ConnectionProfileGroup.isRoot(name);
		assert.deepEqual(actual, expected);
	});

	test('sameGroupName should return true given root', () => {
		let name1: string = '/';
		let name2: string = '';
		let expected: boolean = true;
		let actual = ConnectionProfileGroup.sameGroupName(name1, name2);
		assert.deepEqual(actual, expected);
	});

	test('sameGroupName should return true given same group names', () => {
		let name1: string = '/group1';
		let name2: string = '/Group1';
		let expected: boolean = true;
		let actual = ConnectionProfileGroup.sameGroupName(name1, name2);
		assert.deepEqual(actual, expected);
	});

	test('sameGroupName should return false given two different groups', () => {
		let name1: string = '/';
		let name2: string = '/Group1';
		let expected: boolean = false;
		let actual = ConnectionProfileGroup.sameGroupName(name1, name2);
		assert.deepEqual(actual, expected);
	});
});
