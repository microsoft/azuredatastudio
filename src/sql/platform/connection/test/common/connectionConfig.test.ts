/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ConnectionConfig } from 'sql/platform/connection/common/connectionConfig';
import { ConnectionGroup } from 'sql/base/common/connectionGroup';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { find } from 'vs/base/common/arrays';
import { Connection } from 'sql/base/common/connection';

const storedGroup1 = { id: 'asdasd', name: 'name' };
const group1 = new ConnectionGroup(storedGroup1.name, storedGroup1.id);

suite('Connection Config', () => {
	let configurationService: TestConfigurationService;
	let logService: NullLogService;
	let capabilitiesService: TestCapabilitiesService;

	setup(() => {
		configurationService = new TestConfigurationService();
		logService = new NullLogService();
		capabilitiesService = new TestCapabilitiesService();
	});

	test('gets connections', () => {

	});

	test('gets groups', () => {
		configurationService.updateValue('datasource.connectionGroups', [storedGroup1]);
		const connectionConfig = new ConnectionConfig(configurationService, capabilitiesService, logService);

		const groups = connectionConfig.groups;
		assert(groups.length === 1);
		const group = groups[0];
		assert(groupMatches(group, group1));
	});
});

function groupMatches(group1: ConnectionGroup, group2: ConnectionGroup, includeChildren: boolean = false): boolean {
	if (includeChildren) {
		if (group1.children.length === group2.children.length) {
			for (const child of group1.children) {
				const child2 = find(group2.children, c => c.id === child.id);
				if (!child2) {
					return false;
				}
				if (child instanceof Connection) {
					if (!child.profile.matches((child2 as Connection).profile)) {
						return false;
					}
					if (child.groupId !== (child2 as Connection).groupId) {
						return false;
					}
				} else {
					if (!groupMatches(child, child2 as ConnectionGroup, includeChildren)) {
						return false;
					}
				}
			}
		}
	}

	return group1.color === group2.color && group1.description === group2.description && group1.name === group2.name && group1.parent === group2.parent;
}
