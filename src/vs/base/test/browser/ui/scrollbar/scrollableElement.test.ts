/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { MouseWheelClassifier } from 'vs/base/browser/ui/scrollbar/scrollableElement';

export type IMouseWheelEvent = [number, number, number];

suite('MouseWheelClassifier', () => {

	test('OSX - Apple Magic Mouse', () => {
		const testData: IMouseWheelEvent[] = [
			[1503409622410, -0.025, 0],
			[1503409622435, -0.175, 0],
			[1503409622446, -0.225, 0],
			[1503409622489, -0.65, 0],
			[1503409622514, -1.225, 0],
			[1503409622537, -1.025, 0],
			[1503409622543, -0.55, 0],
			[1503409622587, -0.75, 0],
			[1503409622623, -1.45, 0],
			[1503409622641, -1.325, 0],
			[1503409622663, -0.6, 0],
			[1503409622681, -1.125, 0],
			[1503409622703, -0.5166666666666667, 0],
			[1503409622721, -0.475, 0],
			[1503409622822, -0.425, 0],
			[1503409622871, -1.9916666666666667, 0],
			[1503409622933, -0.7, 0],
			[1503409622991, -0.725, 0],
			[1503409623032, -0.45, 0],
			[1503409623083, -0.25, 0],
			[1503409623122, -0.4, 0],
			[1503409623176, -0.2, 0],
			[1503409623197, -0.225, 0],
			[1503409623219, -0.05, 0],
			[1503409623249, -0.1, 0],
			[1503409623278, -0.1, 0],
			[1503409623292, -0.025, 0],
			[1503409623315, -0.025, 0],
			[1503409623324, -0.05, 0],
			[1503409623356, -0.025, 0],
			[1503409623415, -0.025, 0],
			[1503409623443, -0.05, 0],
			[1503409623452, -0.025, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, false);
		}
	});

	test('OSX - Apple Touch Pad', () => {
		const testData: IMouseWheelEvent[] = [
			[1503409780792, 0.025, 0],
			[1503409780808, 0.175, -0.025],
			[1503409780811, 0.35, -0.05],
			[1503409780816, 0.55, -0.075],
			[1503409780836, 0.825, -0.1],
			[1503409780840, 0.725, -0.075],
			[1503409780842, 1.5, -0.125],
			[1503409780848, 1.1, -0.1],
			[1503409780877, 2.05, -0.1],
			[1503409780882, 3.9, 0],
			[1503409780908, 3.825, 0],
			[1503409780915, 3.65, 0],
			[1503409780940, 3.45, 0],
			[1503409780949, 3.25, 0],
			[1503409780979, 3.075, 0],
			[1503409780982, 2.9, 0],
			[1503409781016, 2.75, 0],
			[1503409781018, 2.625, 0],
			[1503409781051, 2.5, 0],
			[1503409781071, 2.4, 0],
			[1503409781089, 2.3, 0],
			[1503409781111, 2.175, 0],
			[1503409781140, 3.975, 0],
			[1503409781165, 1.8, 0],
			[1503409781183, 3.3, 0],
			[1503409781202, 1.475, 0],
			[1503409781223, 1.375, 0],
			[1503409781244, 1.275, 0],
			[1503409781269, 2.25, 0],
			[1503409781285, 1.025, 0],
			[1503409781300, 0.925, 0],
			[1503409781303, 0.875, 0],
			[1503409781321, 0.8, 0],
			[1503409781333, 0.725, 0],
			[1503409781355, 0.65, 0],
			[1503409781370, 0.6, 0],
			[1503409781384, 0.55, 0],
			[1503409781410, 0.5, 0],
			[1503409781422, 0.475, 0],
			[1503409781435, 0.425, 0],
			[1503409781454, 0.4, 0],
			[1503409781470, 0.35, 0],
			[1503409781486, 0.325, 0],
			[1503409781501, 0.3, 0],
			[1503409781519, 0.275, 0],
			[1503409781534, 0.25, 0],
			[1503409781553, 0.225, 0],
			[1503409781569, 0.2, 0],
			[1503409781589, 0.2, 0],
			[1503409781601, 0.175, 0],
			[1503409781621, 0.15, 0],
			[1503409781631, 0.15, 0],
			[1503409781652, 0.125, 0],
			[1503409781667, 0.125, 0],
			[1503409781685, 0.125, 0],
			[1503409781703, 0.1, 0],
			[1503409781715, 0.1, 0],
			[1503409781734, 0.1, 0],
			[1503409781753, 0.075, 0],
			[1503409781768, 0.075, 0],
			[1503409781783, 0.075, 0],
			[1503409781801, 0.075, 0],
			[1503409781815, 0.05, 0],
			[1503409781836, 0.05, 0],
			[1503409781850, 0.05, 0],
			[1503409781865, 0.05, 0],
			[1503409781880, 0.05, 0],
			[1503409781899, 0.025, 0],
			[1503409781916, 0.025, 0],
			[1503409781933, 0.025, 0],
			[1503409781952, 0.025, 0],
			[1503409781965, 0.025, 0],
			[1503409781996, 0.025, 0],
			[1503409782015, 0.025, 0],
			[1503409782045, 0.025, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, false);
		}
	});

	test('OSX - Razer Physical Mouse Wheel', () => {
		const testData: IMouseWheelEvent[] = [
			[1503409880776, -1, 0],
			[1503409880791, -1, 0],
			[1503409880810, -4, 0],
			[1503409880820, -5, 0],
			[1503409880848, -6, 0],
			[1503409880876, -7, 0],
			[1503409881319, -1, 0],
			[1503409881387, -1, 0],
			[1503409881407, -2, 0],
			[1503409881443, -4, 0],
			[1503409881444, -5, 0],
			[1503409881470, -6, 0],
			[1503409881496, -7, 0],
			[1503409881812, -1, 0],
			[1503409881829, -1, 0],
			[1503409881850, -4, 0],
			[1503409881871, -5, 0],
			[1503409881896, -13, 0],
			[1503409881914, -16, 0],
			[1503409882551, -1, 0],
			[1503409882589, -1, 0],
			[1503409882625, -2, 0],
			[1503409883035, -1, 0],
			[1503409883098, -1, 0],
			[1503409883143, -2, 0],
			[1503409883217, -2, 0],
			[1503409883270, -3, 0],
			[1503409883388, -3, 0],
			[1503409883531, -3, 0],
			[1503409884095, -1, 0],
			[1503409884122, -1, 0],
			[1503409884160, -3, 0],
			[1503409884208, -4, 0],
			[1503409884292, -4, 0],
			[1503409884447, -1, 0],
			[1503409884788, -1, 0],
			[1503409884835, -1, 0],
			[1503409884898, -2, 0],
			[1503409884965, -3, 0],
			[1503409885085, -2, 0],
			[1503409885552, -1, 0],
			[1503409885619, -1, 0],
			[1503409885670, -1, 0],
			[1503409885733, -2, 0],
			[1503409885784, -4, 0],
			[1503409885916, -3, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, true);
		}
	});

	test('Windows - Microsoft Arc Touch', () => {
		const testData: IMouseWheelEvent[] = [
			[1503418316909, -2, 0],
			[1503418316985, -2, 0],
			[1503418316988, -4, 0],
			[1503418317034, -2, 0],
			[1503418317071, -2, 0],
			[1503418317094, -2, 0],
			[1503418317133, -2, 0],
			[1503418317170, -2, 0],
			[1503418317192, -2, 0],
			[1503418317265, -2, 0],
			[1503418317289, -2, 0],
			[1503418317365, -2, 0],
			[1503418317414, -2, 0],
			[1503418317458, -2, 0],
			[1503418317513, -2, 0],
			[1503418317583, -2, 0],
			[1503418317637, -2, 0],
			[1503418317720, -2, 0],
			[1503418317786, -2, 0],
			[1503418317832, -2, 0],
			[1503418317933, -2, 0],
			[1503418318037, -2, 0],
			[1503418318134, -2, 0],
			[1503418318267, -2, 0],
			[1503418318411, -2, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, true);
		}
	});

	test('Windows - SurfaceBook TouchPad', () => {
		const testData: IMouseWheelEvent[] = [
			[1503418499174, -3.35, 0],
			[1503418499177, -0.9333333333333333, 0],
			[1503418499222, -2.091666666666667, 0],
			[1503418499238, -1.5666666666666667, 0],
			[1503418499242, -1.8, 0],
			[1503418499271, -2.5166666666666666, 0],
			[1503418499283, -0.7666666666666667, 0],
			[1503418499308, -2.033333333333333, 0],
			[1503418499320, -2.85, 0],
			[1503418499372, -1.5333333333333334, 0],
			[1503418499373, -2.8, 0],
			[1503418499411, -1.6166666666666667, 0],
			[1503418499413, -1.9166666666666667, 0],
			[1503418499443, -0.9333333333333333, 0],
			[1503418499446, -0.9833333333333333, 0],
			[1503418499458, -0.7666666666666667, 0],
			[1503418499482, -0.9666666666666667, 0],
			[1503418499485, -0.36666666666666664, 0],
			[1503418499508, -0.5833333333333334, 0],
			[1503418499532, -0.48333333333333334, 0],
			[1503418499541, -0.6333333333333333, 0],
			[1503418499571, -0.18333333333333332, 0],
			[1503418499573, -0.4, 0],
			[1503418499595, -0.15, 0],
			[1503418499608, -0.23333333333333334, 0],
			[1503418499625, -0.18333333333333332, 0],
			[1503418499657, -0.13333333333333333, 0],
			[1503418499674, -0.15, 0],
			[1503418499676, -0.03333333333333333, 0],
			[1503418499691, -0.016666666666666666, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, false);
		}
	});

	test('Windows - Razer physical wheel', () => {
		const testData: IMouseWheelEvent[] = [
			[1503418638271, -2, 0],
			[1503418638317, -2, 0],
			[1503418638336, -2, 0],
			[1503418638350, -2, 0],
			[1503418638360, -2, 0],
			[1503418638366, -2, 0],
			[1503418638407, -2, 0],
			[1503418638694, -2, 0],
			[1503418638742, -2, 0],
			[1503418638744, -2, 0],
			[1503418638746, -2, 0],
			[1503418638780, -2, 0],
			[1503418638782, -2, 0],
			[1503418638810, -2, 0],
			[1503418639127, -2, 0],
			[1503418639168, -2, 0],
			[1503418639194, -2, 0],
			[1503418639197, -4, 0],
			[1503418639244, -2, 0],
			[1503418639248, -2, 0],
			[1503418639586, -2, 0],
			[1503418639653, -2, 0],
			[1503418639667, -4, 0],
			[1503418639677, -2, 0],
			[1503418639681, -2, 0],
			[1503418639728, -2, 0],
			[1503418639997, -2, 0],
			[1503418640034, -2, 0],
			[1503418640039, -2, 0],
			[1503418640065, -2, 0],
			[1503418640080, -2, 0],
			[1503418640097, -2, 0],
			[1503418640141, -2, 0],
			[1503418640413, -2, 0],
			[1503418640456, -2, 0],
			[1503418640490, -2, 0],
			[1503418640492, -4, 0],
			[1503418640494, -2, 0],
			[1503418640546, -2, 0],
			[1503418640781, -2, 0],
			[1503418640823, -2, 0],
			[1503418640824, -2, 0],
			[1503418640829, -2, 0],
			[1503418640864, -2, 0],
			[1503418640874, -2, 0],
			[1503418640876, -2, 0],
			[1503418641168, -2, 0],
			[1503418641203, -2, 0],
			[1503418641224, -2, 0],
			[1503418641240, -2, 0],
			[1503418641254, -4, 0],
			[1503418641270, -2, 0],
			[1503418641546, -2, 0],
			[1503418641612, -2, 0],
			[1503418641625, -6, 0],
			[1503418641634, -2, 0],
			[1503418641680, -2, 0],
			[1503418641961, -2, 0],
			[1503418642004, -2, 0],
			[1503418642016, -4, 0],
			[1503418642044, -2, 0],
			[1503418642065, -2, 0],
			[1503418642083, -2, 0],
			[1503418642349, -2, 0],
			[1503418642378, -2, 0],
			[1503418642390, -2, 0],
			[1503418642408, -2, 0],
			[1503418642413, -2, 0],
			[1503418642448, -2, 0],
			[1503418642468, -2, 0],
			[1503418642746, -2, 0],
			[1503418642800, -2, 0],
			[1503418642814, -4, 0],
			[1503418642816, -2, 0],
			[1503418642857, -2, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, true);
		}
	});

	test('Windows - Logitech physical wheel', () => {
		const testData: IMouseWheelEvent[] = [
			[1503418872930, -2, 0],
			[1503418872952, -2, 0],
			[1503418872969, -2, 0],
			[1503418873022, -2, 0],
			[1503418873042, -2, 0],
			[1503418873076, -2, 0],
			[1503418873368, -2, 0],
			[1503418873393, -2, 0],
			[1503418873404, -2, 0],
			[1503418873425, -2, 0],
			[1503418873479, -2, 0],
			[1503418873520, -2, 0],
			[1503418873758, -2, 0],
			[1503418873759, -2, 0],
			[1503418873762, -2, 0],
			[1503418873807, -2, 0],
			[1503418873830, -4, 0],
			[1503418873850, -2, 0],
			[1503418874076, -2, 0],
			[1503418874116, -2, 0],
			[1503418874136, -4, 0],
			[1503418874148, -2, 0],
			[1503418874150, -2, 0],
			[1503418874409, -2, 0],
			[1503418874452, -2, 0],
			[1503418874472, -2, 0],
			[1503418874474, -4, 0],
			[1503418874543, -2, 0],
			[1503418874566, -2, 0],
			[1503418874778, -2, 0],
			[1503418874780, -2, 0],
			[1503418874801, -2, 0],
			[1503418874822, -2, 0],
			[1503418874832, -2, 0],
			[1503418874845, -2, 0],
			[1503418875122, -2, 0],
			[1503418875158, -2, 0],
			[1503418875180, -2, 0],
			[1503418875195, -4, 0],
			[1503418875239, -2, 0],
			[1503418875260, -2, 0],
			[1503418875490, -2, 0],
			[1503418875525, -2, 0],
			[1503418875547, -4, 0],
			[1503418875556, -4, 0],
			[1503418875630, -2, 0],
			[1503418875852, -2, 0],
			[1503418875895, -2, 0],
			[1503418875935, -2, 0],
			[1503418875941, -4, 0],
			[1503418876198, -2, 0],
			[1503418876242, -2, 0],
			[1503418876270, -4, 0],
			[1503418876279, -2, 0],
			[1503418876333, -2, 0],
			[1503418876342, -2, 0],
			[1503418876585, -2, 0],
			[1503418876609, -2, 0],
			[1503418876623, -2, 0],
			[1503418876644, -2, 0],
			[1503418876646, -2, 0],
			[1503418876678, -2, 0],
			[1503418877330, -2, 0],
			[1503418877354, -2, 0],
			[1503418877368, -2, 0],
			[1503418877397, -2, 0],
			[1503418877411, -2, 0],
			[1503418877748, -2, 0],
			[1503418877756, -2, 0],
			[1503418877778, -2, 0],
			[1503418877793, -2, 0],
			[1503418877807, -2, 0],
			[1503418878091, -2, 0],
			[1503418878133, -2, 0],
			[1503418878137, -4, 0],
			[1503418878181, -2, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, true);
		}
	});

	test('Windows - Microsoft basic v2 physical wheel', () => {
		const testData: IMouseWheelEvent[] = [
			[1503418994564, -2, 0],
			[1503418994643, -2, 0],
			[1503418994676, -2, 0],
			[1503418994691, -2, 0],
			[1503418994727, -2, 0],
			[1503418994799, -2, 0],
			[1503418994850, -2, 0],
			[1503418995259, -2, 0],
			[1503418995321, -2, 0],
			[1503418995328, -2, 0],
			[1503418995343, -2, 0],
			[1503418995402, -2, 0],
			[1503418995454, -2, 0],
			[1503418996052, -2, 0],
			[1503418996095, -2, 0],
			[1503418996107, -2, 0],
			[1503418996120, -2, 0],
			[1503418996146, -2, 0],
			[1503418996471, -2, 0],
			[1503418996530, -2, 0],
			[1503418996549, -2, 0],
			[1503418996561, -2, 0],
			[1503418996571, -2, 0],
			[1503418996636, -2, 0],
			[1503418996936, -2, 0],
			[1503418997002, -2, 0],
			[1503418997006, -2, 0],
			[1503418997043, -2, 0],
			[1503418997045, -2, 0],
			[1503418997092, -2, 0],
			[1503418997357, -2, 0],
			[1503418997394, -2, 0],
			[1503418997410, -2, 0],
			[1503418997426, -2, 0],
			[1503418997442, -2, 0],
			[1503418997486, -2, 0],
			[1503418997757, -2, 0],
			[1503418997807, -2, 0],
			[1503418997813, -2, 0],
			[1503418997850, -2, 0],
		];

		const classifier = new MouseWheelClassifier();
		for (let i = 0, len = testData.length; i < len; i++) {
			const [timestamp, deltaY, deltaX] = testData[i];
			classifier.accept(timestamp, deltaX, deltaY);

			const actual = classifier.isPhysicalMouseWheel();
			assert.strictEqual(actual, true);
		}
	});
});
