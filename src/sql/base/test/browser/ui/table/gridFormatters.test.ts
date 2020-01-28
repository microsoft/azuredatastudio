/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as SharedServices from 'sql/base/browser/ui/table/formatters';

const testText = '<div>test text</div>';

suite('Grid shared services tests', () => {
	test('textFormatter should encode HTML when formatting a DBCellValue object', () => {
		// If I format a DBCellValue object that contains HTML
		let cellValue = {
			displayValue: testText,
			isNull: false
		};
		let formattedHtml = SharedServices.textFormatter(undefined, undefined, cellValue, undefined, undefined);

		// Then the result is HTML for a span element containing the cell value's display value as plain text
		verifyFormattedHtml(formattedHtml, testText);
	});

	test('textFormatter should encode HTML when formatting a string', () => {
		// If I format a string that contains HTML
		let formattedHtml = SharedServices.textFormatter(undefined, undefined, testText, undefined, undefined);

		// Then the result is HTML for a span element containing the given text as plain text
		verifyFormattedHtml(formattedHtml, testText);
	});
});

function verifyFormattedHtml(formattedHtml: string, expectedText: string): void {
	// Create an element containing the span returned by the format call
	let element = document.createElement('div');
	element.innerHTML = formattedHtml;
	let spanElement = element.children[0];

	// Verify that the span element's text, not its innerHTML, matches the expected text
	assert.equal(spanElement.textContent, testText);
	assert.notEqual(spanElement.innerHTML, testText);
}
