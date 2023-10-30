/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Dropdown, IDropdownOptions } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';

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
		assert.strictEqual(dropdown.value, '');
		dropdown.dispose();
	});

	test('changing value through code fires onValueChange event', () => {
		const dropdown = new Dropdown(container, undefined, options);
		let count: number = 0;
		dropdown.onValueChange((e) => {
			count++;
		});
		dropdown.value = options.values[0];

		assert.strictEqual(count, 1, 'onValueChange event was not fired');
		dropdown.value = options.values[0];
		assert.strictEqual(count, 1, 'onValueChange event should not be fired for setting the same value again');
		dropdown.value = options.values[1];
		assert.strictEqual(count, 2, 'onValueChange event was not fired for setting a new value of the dropdown');
		dropdown.dispose();
	});

	test('changing value through input text fires onValue Change event', () => {
		const dropdown = new Dropdown(container, undefined, options);
		let count = 0;
		dropdown.onValueChange((e) => {
			count++;
		});

		dropdown.fireOnTextChange = true;
		dropdown.setDropdownVisibility(true);
		dropdown.input.value = options.values[0];
		assert.strictEqual(count, 1, 'onValueChange event was not fired for an option from the dropdown list');
		dropdown.input.value = 'foo';
		assert.strictEqual(count, 2, 'onValueChange event was not fired for a value not in dropdown list');
		assert.strictEqual(dropdown.selectList.length, 4, 'list does not have all the values that are matching the input box text');
		assert.strictEqual(dropdown.value, 'foo');
		dropdown.input.value = 'foobar';
		assert.strictEqual(count, 3, 'onValueChange event was not fired for a value not in dropdown list');
		assert.strictEqual(dropdown.selectList.length, 2, 'list does not have all the values that are matching the input box text');
		assert.strictEqual(dropdown.value, 'foobar');

		dropdown.fireOnTextChange = false;
		dropdown.input.value = options.values[0];
		assert.strictEqual(count, 3, 'onValueChange event was fired with input box value change even after setting the fireOnTextChange to false');
		dropdown.dispose();
	});

	test('selecting same dropdown value again after changing text field should update text field', () => {
		const dropdown = new Dropdown(container, undefined, options);
		dropdown.value = options.values[0];
		dropdown.input.value = 'NotARealValue';
		dropdown.value = options.values[0];
		assert.strictEqual(dropdown.input.value, options.values[0]);
		dropdown.dispose();
	});
});
