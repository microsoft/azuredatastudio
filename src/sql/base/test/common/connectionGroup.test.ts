/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionGroup } from 'sql/base/common/connectionGroup';
import * as assert from 'assert';
import { Connection } from 'sql/base/common/connection';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';

suite('Connection Group -', () => {
	test('constructs', () => {
		const name = 'groupname';
		const id = 'groupid';
		const parent = 'groupparent';
		const color = 'groupcolor';
		const description = 'groupdescription';
		const group = new ConnectionGroup(name, id, parent, color, description);

		assert.equal(group.name, name);
		assert.equal(group.id, id);
		assert.equal(group.parent, parent);
		assert.equal(group.color, color);
		assert.equal(group.description, description);
		assert.deepEqual(group.children, []);
	});

	test('adding a connection', () => {
		let triggerCount = 0;
		const connectionProfile = ConnectionProfile.from({ serverName: 'server', providerName: 'MSSQL', authenticationType: 'password' });
		const connection = new Connection(connectionProfile);
		const group = new ConnectionGroup('name', 'id');
		group.onChange(e => triggerCount++);
		group.add(connection);
		assert(group.children.length === 1);
		assert(group.children[0] === connection);
		assert(triggerCount === 1);
	});

	test('adding a group', () => {
		const testGroup = new ConnectionGroup('name2', 'id2');
		const group = new ConnectionGroup('name', 'id');
		group.add(testGroup);
		assert(group.children.length === 1);
		assert(group.children[0] === testGroup);
	});

	test('adding multiple children', () => {
		const testGroup = new ConnectionGroup('name2', 'id2');
		const connectionProfile = ConnectionProfile.from({ serverName: 'server', providerName: 'MSSQL', authenticationType: 'password' });
		const connection = new Connection(connectionProfile);
		const group = new ConnectionGroup('name', 'id');
		group.add(testGroup);
		group.add(connection);
		assert(group.children.length === 2);
		assert(group.children.some(c => c === testGroup));
		assert(group.children.some(c => c === connection));
	});

	test('removing a child', () => {
		const testGroup = new ConnectionGroup('name2', 'id2');
		const group = new ConnectionGroup('name', 'id');
		group.add(testGroup);
		assert(group.remove(testGroup));
		assert(group.children.length === 0);
	});

	test('removing a child that isnt present doesnt do anything', () => {
		let triggerCount = 0;
		const testGroup = new ConnectionGroup('name2', 'id2');
		const group = new ConnectionGroup('name', 'id');
		group.onChange(e => triggerCount++);
		assert(!group.remove(testGroup));
		assert(group.children.length === 0);
		assert(triggerCount === 0);
	});
});
