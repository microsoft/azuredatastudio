/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { FirewallRuleViewModel } from 'sql/platform/accounts/common/firewallRuleViewModel';

suite('Firewall rule view model tests', () => {
	let viewModel: FirewallRuleViewModel;

	setup(() => {
		viewModel = new FirewallRuleViewModel();
	});

	test('update default values to 250.222.155.198 should calculate the correct default subnet IP range', () => {
		let IPAddress = '250.222.155.198';
		viewModel.updateDefaultValues(IPAddress);
		assert.equal(IPAddress, viewModel.defaultIPAddress);
		assert.equal('250.222.155.0', viewModel.defaultFromSubnetIPRange);
		assert.equal('250.222.155.255', viewModel.defaultToSubnetIPRange);
	});

	test('update default values to 250.222.155.0 should calculate the correct default subnet IP range', () => {
		let IPAddress = '250.222.155.2';
		viewModel.updateDefaultValues(IPAddress);
		assert.equal(IPAddress, viewModel.defaultIPAddress);
		assert.equal('250.222.155.0', viewModel.defaultFromSubnetIPRange);
		assert.equal('250.222.155.255', viewModel.defaultToSubnetIPRange);
	});

	test('subnet IP range should return the correct values', () => {
		let IPAddress = '250.222.155.198';
		viewModel.updateDefaultValues(IPAddress);
		assert.equal('250.222.155.0', viewModel.fromSubnetIPRange);
		assert.equal('250.222.155.255', viewModel.toSubnetIPRange);

		viewModel.fromSubnetIPRange = '250.222.155.100';
		viewModel.toSubnetIPRange = '250.222.155.220';
		assert.equal('250.222.155.100', viewModel.fromSubnetIPRange);
		assert.equal('250.222.155.220', viewModel.toSubnetIPRange);
	});
});
