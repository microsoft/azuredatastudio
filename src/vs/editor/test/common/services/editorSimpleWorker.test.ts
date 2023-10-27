/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Position } from 'vs/editor/common/core/position';
import { Range, IRange } from 'vs/editor/common/core/range';
import { TextEdit } from 'vs/editor/common/languages';
import { EditorSimpleWorker, ICommonModel } from 'vs/editor/common/services/editorSimpleWorker';
import { IEditorWorkerHost } from 'vs/editor/common/services/editorWorkerHost';

suite('EditorSimpleWorker', () => {

	class WorkerWithModels extends EditorSimpleWorker {

		getModel(uri: string) {
			return this._getModel(uri);
		}

		addModel(lines: string[], eol: string = '\n') {
			const uri = 'test:file#' + Date.now();
			this.acceptNewModel({
				url: uri,
				versionId: 1,
				lines: lines,
				EOL: eol
			});
			return this._getModel(uri);
		}
	}

	let worker: WorkerWithModels;
	let model: ICommonModel;

	setup(() => {
		worker = new WorkerWithModels(<IEditorWorkerHost>null!, null);
		model = worker.addModel([
			'This is line one', //16
			'and this is line number two', //27
			'it is followed by #3', //20
			'and finished with the fourth.', //29
		]);
	});

	function assertPositionAt(offset: number, line: number, column: number) {
		const position = model.positionAt(offset);
		assert.strictEqual(position.lineNumber, line);
		assert.strictEqual(position.column, column);
	}

	function assertOffsetAt(lineNumber: number, column: number, offset: number) {
		const actual = model.offsetAt({ lineNumber, column });
		assert.strictEqual(actual, offset);
	}

	test('ICommonModel#offsetAt', () => {
		assertOffsetAt(1, 1, 0);
		assertOffsetAt(1, 2, 1);
		assertOffsetAt(1, 17, 16);
		assertOffsetAt(2, 1, 17);
		assertOffsetAt(2, 4, 20);
		assertOffsetAt(3, 1, 45);
		assertOffsetAt(5, 30, 95);
		assertOffsetAt(5, 31, 95);
		assertOffsetAt(5, Number.MAX_VALUE, 95);
		assertOffsetAt(6, 30, 95);
		assertOffsetAt(Number.MAX_VALUE, 30, 95);
		assertOffsetAt(Number.MAX_VALUE, Number.MAX_VALUE, 95);
	});

	test('ICommonModel#positionAt', () => {
		assertPositionAt(0, 1, 1);
		assertPositionAt(Number.MIN_VALUE, 1, 1);
		assertPositionAt(1, 1, 2);
		assertPositionAt(16, 1, 17);
		assertPositionAt(17, 2, 1);
		assertPositionAt(20, 2, 4);
		assertPositionAt(45, 3, 1);
		assertPositionAt(95, 4, 30);
		assertPositionAt(96, 4, 30);
		assertPositionAt(99, 4, 30);
		assertPositionAt(Number.MAX_VALUE, 4, 30);
	});

	test('ICommonModel#validatePosition, issue #15882', function () {
		const model = worker.addModel(['{"id": "0001","type": "donut","name": "Cake","image":{"url": "images/0001.jpg","width": 200,"height": 200},"thumbnail":{"url": "images/thumbnails/0001.jpg","width": 32,"height": 32}}']);
		assert.strictEqual(model.offsetAt({ lineNumber: 1, column: 2 }), 1);
	});

	test('MoreMinimal', () => {

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: 'This is line One', range: new Range(1, 1, 1, 17) }], false).then(edits => {
			assert.strictEqual(edits.length, 1);
			const [first] = edits;
			assert.strictEqual(first.text, 'O');
			assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 14, endLineNumber: 1, endColumn: 15 });
		});
	});

	test('MoreMinimal, issue #15385 newline changes only', function () {

		const model = worker.addModel([
			'{',
			'\t"a":1',
			'}'
		], '\n');

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: '{\r\n\t"a":1\r\n}', range: new Range(1, 1, 3, 2) }], false).then(edits => {
			assert.strictEqual(edits.length, 0);
		});
	});

	test('MoreMinimal, issue #15385 newline changes and other', function () {

		const model = worker.addModel([
			'{',
			'\t"a":1',
			'}'
		], '\n');

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: '{\r\n\t"b":1\r\n}', range: new Range(1, 1, 3, 2) }], false).then(edits => {
			assert.strictEqual(edits.length, 1);
			const [first] = edits;
			assert.strictEqual(first.text, 'b');
			assert.deepStrictEqual(first.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 4 });
		});
	});

	test('MoreMinimal, issue #15385 newline changes and other 2/2', function () {

		const model = worker.addModel([
			'package main',	// 1
			'func foo() {',	// 2
			'}'				// 3
		]);

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: '\n', range: new Range(3, 2, 4, 1000) }], false).then(edits => {
			assert.strictEqual(edits.length, 1);
			const [first] = edits;
			assert.strictEqual(first.text, '\n');
			assert.deepStrictEqual(first.range, { startLineNumber: 3, startColumn: 2, endLineNumber: 3, endColumn: 2 });
		});
	});

	async function testEdits(lines: string[], edits: TextEdit[]): Promise<unknown> {
		const model = worker.addModel(lines);

		const smallerEdits = await worker.computeHumanReadableDiff(
			model.uri.toString(),
			edits,
			{ ignoreTrimWhitespace: false, maxComputationTimeMs: 0, computeMoves: false }
		);

		const t1 = applyEdits(model.getValue(), edits);
		const t2 = applyEdits(model.getValue(), smallerEdits);
		assert.deepStrictEqual(t1, t2);

		return smallerEdits.map(e => ({ range: Range.lift(e.range).toString(), text: e.text }));
	}


	test('computeHumanReadableDiff 1', async () => {
		assert.deepStrictEqual(
			await testEdits(
				[
					'function test() {}'
				],
				[{
					text: "\n/** Some Comment */\n",
					range: new Range(1, 1, 1, 1)
				}]),
			([{ range: "[1,1 -> 1,1]", text: "\n/** Some Comment */\n" }])
		);
	});

	test('computeHumanReadableDiff 2', async () => {
		assert.deepStrictEqual(
			await testEdits(
				[
					'function test() {}'
				],
				[{
					text: 'function test(myParam: number) { console.log(myParam); }',
					range: new Range(1, 1, 1, Number.MAX_SAFE_INTEGER)
				}]),
			([{ range: '[1,15 -> 1,15]', text: 'myParam: number' }, { range: '[1,18 -> 1,18]', text: ' console.log(myParam); ' }])
		);
	});

	test('computeHumanReadableDiff 3', async () => {
		assert.deepStrictEqual(
			await testEdits(
				[
					'',
					'',
					'',
					''
				],
				[{
					text: 'function test(myParam: number) { console.log(myParam); }\n\n',
					range: new Range(2, 1, 3, 20)
				}]),
			([{ range: '[2,1 -> 2,1]', text: 'function test(myParam: number) { console.log(myParam); }\n' }])
		);
	});

	test('computeHumanReadableDiff 4', async () => {
		assert.deepStrictEqual(
			await testEdits(
				[
					'function algorithm() {}',
				],
				[{
					text: 'function alm() {}',
					range: new Range(1, 1, 1, Number.MAX_SAFE_INTEGER)
				}]),
			([{ range: "[1,10 -> 1,19]", text: "alm" }])
		);
	});

	test('ICommonModel#getValueInRange, issue #17424', function () {

		const model = worker.addModel([
			'package main',	// 1
			'func foo() {',	// 2
			'}'				// 3
		]);

		const value = model.getValueInRange({ startLineNumber: 3, startColumn: 1, endLineNumber: 4, endColumn: 1 });
		assert.strictEqual(value, '}');
	});


	test('textualSuggest, issue #17785', function () {

		const model = worker.addModel([
			'foobar',	// 1
			'f f'	// 2
		]);

		return worker.textualSuggest([model.uri.toString()], 'f', '[a-z]+', 'img').then((result) => {
			if (!result) {
				assert.ok(false);
			}
			assert.strictEqual(result.words.length, 1);
			assert.strictEqual(typeof result.duration, 'number');
			assert.strictEqual(result.words[0], 'foobar');
		});
	});

	test('get words via iterator, issue #46930', function () {

		const model = worker.addModel([
			'one line',	// 1
			'two line',	// 2
			'',
			'past empty',
			'single',
			'',
			'and now we are done'
		]);

		const words: string[] = [...model.words(/[a-z]+/img)];

		assert.deepStrictEqual(words, ['one', 'line', 'two', 'line', 'past', 'empty', 'single', 'and', 'now', 'we', 'are', 'done']);
	});
});

function applyEdits(text: string, edits: { range: IRange; text: string }[]): string {
	const transformer = new PositionOffsetTransformer(text);
	const offsetEdits = edits.map(e => {
		const range = Range.lift(e.range);
		return ({
			startOffset: transformer.getOffset(range.getStartPosition()),
			endOffset: transformer.getOffset(range.getEndPosition()),
			text: e.text
		});
	});

	offsetEdits.sort((a, b) => b.startOffset - a.startOffset);

	for (const edit of offsetEdits) {
		text = text.substring(0, edit.startOffset) + edit.text + text.substring(edit.endOffset);
	}

	return text;
}

class PositionOffsetTransformer {
	private readonly lineStartOffsetByLineIdx: number[];

	constructor(text: string) {
		this.lineStartOffsetByLineIdx = [];
		this.lineStartOffsetByLineIdx.push(0);
		for (let i = 0; i < text.length; i++) {
			if (text.charAt(i) === '\n') {
				this.lineStartOffsetByLineIdx.push(i + 1);
			}
		}
		this.lineStartOffsetByLineIdx.push(text.length + 1);
	}

	getOffset(position: Position): number {
		const nextLineOffset = this.lineStartOffsetByLineIdx[position.lineNumber];
		return Math.min(this.lineStartOffsetByLineIdx[position.lineNumber - 1] + position.column - 1, nextLineOffset - 1);
	}
}
