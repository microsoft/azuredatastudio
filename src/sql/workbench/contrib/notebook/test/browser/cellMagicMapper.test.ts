/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

import { CellMagicMapper } from 'sql/workbench/contrib/notebook/browser/models/cellMagicMapper';
import { ILanguageMagic } from 'sql/workbench/services/notebook/browser/notebookService';

const sampleLanguageMagicWithoutKernel: ILanguageMagic = {
	language: 'lang',
	magic: 'sampleMagicAllKernels'
};

const sampleLanguageMagicWithKernel: ILanguageMagic = {
	language: 'lang',
	magic: 'sampleMagic',
	kernels: ['kernel1', 'kernel2']
};

const otherLanguageMagicWithKernel: ILanguageMagic = {
	language: 'otherLang',
	magic: 'otherMagic',
	kernels: ['kernel1', 'kernel2']
};

suite('Cell Magic Mapper', function (): void {
	let cellMagicMapper: CellMagicMapper;
	let magic: ILanguageMagic;

	test('Should find no magics when empty array passed into constructor', () => {
		cellMagicMapper = new CellMagicMapper([]);
		magic = cellMagicMapper.toLanguageMagic('', '');
		assert.equal(magic, undefined, 'cell magic should not exist when magic name and kernel is empty string');

		magic = cellMagicMapper.toLanguageMagic('magicName', 'kernel1');
		assert.equal(magic, undefined, 'cell magic should not exist when magic name and kernel strings are not empty');

		magic = cellMagicMapper.toLanguageMagic(undefined, undefined);
		assert.equal(magic, undefined, 'cell magic should not exist when magic name and kernel strings are undefined');
	});

	test('Should find magic when magic is passed into constructor', () => {
		cellMagicMapper = new CellMagicMapper([sampleLanguageMagicWithKernel]);
		magic = cellMagicMapper.toLanguageMagic('sampleMagic', 'kernel1');
		assert.deepEqual(magic, sampleLanguageMagicWithKernel, 'cell magic should match sample magic when looking for first kernel');

		magic = cellMagicMapper.toLanguageMagic('sampleMagic', 'kernel2');
		assert.deepEqual(magic, sampleLanguageMagicWithKernel, 'cell magic should match sample magic when looking for second kernel');
	});

	test('Should not find magic when kernel does not match', () => {
		cellMagicMapper = new CellMagicMapper([sampleLanguageMagicWithKernel]);
		magic = cellMagicMapper.toLanguageMagic('sampleMagic', 'kernel3');
		assert.equal(magic, undefined, 'cell magic be undefined when kernel name does not match');

		magic = cellMagicMapper.toLanguageMagic('sampleMagic', '');
		assert.equal(magic, undefined, 'cell magic be undefined when kernel name is empty string');

		magic = cellMagicMapper.toLanguageMagic('sampleMagic', undefined);
		assert.equal(magic, undefined, 'cell magic be undefined when kernel name is undefined');
	});

	test('Should not find magic when magic name does not match', () => {
		cellMagicMapper = new CellMagicMapper([sampleLanguageMagicWithKernel]);
		magic = cellMagicMapper.toLanguageMagic('sampleMagic1', 'kernel1');
		assert.equal(magic, undefined, 'cell magic be undefined when magic name does not match');

		magic = cellMagicMapper.toLanguageMagic('', 'kernel1');
		assert.equal(magic, undefined, 'cell magic be undefined when magic name is empty string');

		magic = cellMagicMapper.toLanguageMagic(undefined, 'kernel1');
		assert.equal(magic, undefined, 'cell magic be undefined when magic name is undefined');
	});

	test('Should find magic when kernel is not passed in', () => {
		cellMagicMapper = new CellMagicMapper([sampleLanguageMagicWithoutKernel]);
		magic = cellMagicMapper.toLanguageMagic('sampleMagicAllKernels', 'kernel1');
		assert.deepEqual(magic, sampleLanguageMagicWithoutKernel, 'magic should have been found when no kernel was passed in');

		magic = cellMagicMapper.toLanguageMagic('sampleMagic1', 'kernel1');
		assert.equal(magic, undefined, 'magic should not be found, since magic name does not match');
	});

	test('Should find magic multiple magics exist for same kernel', () => {
		cellMagicMapper = new CellMagicMapper([sampleLanguageMagicWithoutKernel, sampleLanguageMagicWithKernel, otherLanguageMagicWithKernel]);
		magic = cellMagicMapper.toLanguageMagic('sampleMagicAllKernels', 'kernel2');
		assert.deepEqual(magic, sampleLanguageMagicWithoutKernel, 'magic should have been found when no kernel was passed in');

		magic = cellMagicMapper.toLanguageMagic('sampleMagic', 'kernel2');
		assert.deepEqual(magic, sampleLanguageMagicWithKernel, 'magic should have been found when kernel was passed in');

		magic = cellMagicMapper.toLanguageMagic('otherMagic', 'kernel2');
		assert.deepEqual(magic, otherLanguageMagicWithKernel, 'magic should have been found for second magic with kernel passed in');
	});
});
