/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ISelectBoxStyles, SelectBox, SelectOptionItemSQL } from 'sql/base/browser/ui/selectBox/selectBox';
import { deepClone, equals } from 'vs/base/common/objects';

const options: SelectOptionItemSQL[] = [
	{ text: 't1', value: 'v1' },
	{ text: 't2', value: 'v2' }
];

suite('Select Box tests', () => {
	test('default value', () => {

		const sb = new SelectBox(options, options[1].value, <ISelectBoxStyles>{}, undefined!, undefined!, undefined!);
		assert(sb.value === options[1].value);
		sb.dispose();
	});

	test('values change', () => {
		const sb = new SelectBox(options, options[1].value, <ISelectBoxStyles>{}, undefined!, undefined!, undefined!);
		const newOptions = deepClone(options);
		{
			const moreOptions: SelectOptionItemSQL[] = [
				{ text: 't3', value: 'v3' },
				{ text: 't4', value: 'v4' }
			];

			newOptions.push(...moreOptions);
		}

		sb.setOptions(newOptions);
		assert(equals(sb.values, newOptions.map(s => s.value)));
		sb.dispose();
	});

	test('the selected option changes', () => {
		const sb = new SelectBox(options, options[1].value, <ISelectBoxStyles>{}, undefined!, undefined!, undefined!);

		sb.onSelect({
			index: 0,
			selected: options[0].value
		});

		assert(sb.value === options[0].value);
		assert(sb.label === options[0].text);
		sb.dispose();
	});

	test('values get auto populated', () => {
		const newOptions = deepClone(options).map(s => { return { text: s.text, value: s.text }; });
		const sb = new SelectBox(newOptions, undefined!, <ISelectBoxStyles>{}, undefined!, undefined!, undefined!);

		assert(equals(sb.values, newOptions.map(s => s.text)));
		sb.dispose();
	});
});
