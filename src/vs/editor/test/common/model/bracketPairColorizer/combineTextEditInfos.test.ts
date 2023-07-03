/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ISingleEditOperation } from 'vs/editor/common/core/editOperation';
import { Range } from 'vs/editor/common/core/range';
import { TextEditInfo } from 'vs/editor/common/model/bracketPairsTextModelPart/bracketPairsTree/beforeEditPositionMapper';
import { combineTextEditInfos } from 'vs/editor/common/model/bracketPairsTextModelPart/bracketPairsTree/combineTextEditInfos';
import { lengthAdd, lengthToObj, lengthToPosition, positionToLength, toLength } from 'vs/editor/common/model/bracketPairsTextModelPart/bracketPairsTree/length';
import { TextModel } from 'vs/editor/common/model/textModel';
import { createTextModel } from 'vs/editor/test/common/testTextModel';

suite('combineTextEditInfos', () => {
	for (let seed = 0; seed < 50; seed++) {
		test('test' + seed, () => {
			runTest(seed);
		});
	}
});

function runTest(seed: number) {
	const rng = new MersenneTwister(seed);

	const str = 'abcde\nfghij\nklmno\npqrst\n';
	const textModelS0 = createTextModel(str);

	const edits1 = getRandomEditInfos(textModelS0, rng.nextIntRange(1, 4), rng);
	const textModelS1 = createTextModel(textModelS0.getValue());
	textModelS1.applyEdits(edits1.map(e => toEdit(e)));

	const edits2 = getRandomEditInfos(textModelS1, rng.nextIntRange(1, 4), rng);
	const textModelS2 = createTextModel(textModelS1.getValue());
	textModelS2.applyEdits(edits2.map(e => toEdit(e)));

	const combinedEdits = combineTextEditInfos(edits1, edits2);
	for (const edit of combinedEdits) {
		const range = Range.fromPositions(lengthToPosition(edit.startOffset), lengthToPosition(lengthAdd(edit.startOffset, edit.newLength)));
		const value = textModelS2.getValueInRange(range);
		if (!value.match(/^(L|C|\n)*$/)) {
			throw new Error('Invalid edit: ' + value);
		}
		textModelS2.applyEdits([{
			range,
			text: textModelS0.getValueInRange(Range.fromPositions(lengthToPosition(edit.startOffset), lengthToPosition(edit.endOffset))),
		}]);
	}

	assert.deepStrictEqual(textModelS2.getValue(), textModelS0.getValue());

	textModelS0.dispose();
	textModelS1.dispose();
	textModelS2.dispose();
}

function getRandomEditInfos(textModel: TextModel, count: number, rng: MersenneTwister): TextEditInfo[] {
	const edits: TextEditInfo[] = [];
	let i = 0;
	for (let j = 0; j < count; j++) {
		edits.push(getRandomEdit(textModel, i, rng));
		i = textModel.getOffsetAt(lengthToPosition(edits[j].endOffset));
	}
	return edits;
}

function getRandomEdit(textModel: TextModel, rangeOffsetStart: number, rng: MersenneTwister): TextEditInfo {
	const textModelLength = textModel.getValueLength();
	const offsetStart = rng.nextIntRange(rangeOffsetStart, textModelLength);
	const offsetEnd = rng.nextIntRange(offsetStart, textModelLength);

	const lineCount = rng.nextIntRange(0, 3);
	const columnCount = rng.nextIntRange(0, 5);

	return new TextEditInfo(positionToLength(textModel.getPositionAt(offsetStart)), positionToLength(textModel.getPositionAt(offsetEnd)), toLength(lineCount, columnCount));
}

function toEdit(editInfo: TextEditInfo): ISingleEditOperation {
	const l = lengthToObj(editInfo.newLength);
	let text = '';

	for (let i = 0; i < l.lineCount; i++) {
		text += 'LLL\n';
	}
	for (let i = 0; i < l.columnCount; i++) {
		text += 'C';
	}

	return {
		range: Range.fromPositions(
			lengthToPosition(editInfo.startOffset),
			lengthToPosition(editInfo.endOffset)
		),
		text
	};
}

// Generated by copilot
class MersenneTwister {
	private readonly mt = new Array(624);
	private index = 0;

	constructor(seed: number) {
		this.mt[0] = seed >>> 0;
		for (let i = 1; i < 624; i++) {
			const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
			this.mt[i] = (((((s & 0xffff0000) >>> 16) * 0x6c078965) << 16) + (s & 0x0000ffff) * 0x6c078965 + i) >>> 0;
		}
	}

	public nextInt() {
		if (this.index === 0) {
			this.generateNumbers();
		}

		let y = this.mt[this.index];
		y = y ^ (y >>> 11);
		y = y ^ ((y << 7) & 0x9d2c5680);
		y = y ^ ((y << 15) & 0xefc60000);
		y = y ^ (y >>> 18);

		this.index = (this.index + 1) % 624;

		return y >>> 0;
	}

	public nextIntRange(start: number, endExclusive: number) {
		const range = endExclusive - start;
		return Math.floor(this.nextInt() / (0x100000000 / range)) + start;
	}

	private generateNumbers() {
		for (let i = 0; i < 624; i++) {
			const y = (this.mt[i] & 0x80000000) + (this.mt[(i + 1) % 624] & 0x7fffffff);
			this.mt[i] = this.mt[(i + 397) % 624] ^ (y >>> 1);
			if ((y % 2) !== 0) {
				this.mt[i] = this.mt[i] ^ 0x9908b0df;
			}
		}
	}
}
