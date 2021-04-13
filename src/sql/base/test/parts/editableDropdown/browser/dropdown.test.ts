/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Dropdown, IDropdownOptions } from 'sql/base/parts/editableDropdown/browser/dropdown';

const options: IDropdownOptions = {
	values: [
		'foo1',
		'foo2',
		'foobar3',
		'foobar4'
	]
};

suite('Editable dropdown tests', () => {
	let container: HTMLElement;
	setup(() => {
		container = document.createElement('div');
		container.style.position = 'absolute';
		container.style.width = `${200}px`;
		container.style.height = `${200}px`;
	});

	test('default value for editable dropdown is empty', () => {
		const dropdown = new Dropdown(container, undefined, options);
		assert(dropdown.value === '');
	});

	test('changing value through code fires onValue Change event', () => {
		const dropdown = new Dropdown(container, undefined, options);
		let count = 0;
		dropdown.onValueChange((e) => {
			count++;
		});
		dropdown.value = options.values[0];

		assert(count === 1, 'onValueChange event was not fired');
		dropdown.value = options.values[0];
		assert(count === 1, 'onValueChange event should not be fired for setting the same value again');
		dropdown.value = options.values[1];
		assert(count === 2, 'onValueChange event was not fired for setting a new value of the dropdown');
	});
});
