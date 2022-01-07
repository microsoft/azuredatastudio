/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { createKeybinding, createSimpleKeybinding, KeyChord, KeyCode, KeyMod, SimpleKeybinding } from 'vs/base/common/keyCodes';
import { OS } from 'vs/base/common/platform';
import { ContextKeyExpr, ContextKeyExpression, IContext } from 'vs/platform/contextkey/common/contextkey';
import { KeybindingResolver } from 'vs/platform/keybinding/common/keybindingResolver';
import { ResolvedKeybindingItem } from 'vs/platform/keybinding/common/resolvedKeybindingItem';
import { USLayoutResolvedKeybinding } from 'vs/platform/keybinding/common/usLayoutResolvedKeybinding';

function createContext(ctx: any) {
	return {
		getValue: (key: string) => {
			return ctx[key];
		}
	};
}

suite('KeybindingResolver', () => {

	function kbItem(keybinding: number, command: string, commandArgs: any, when: ContextKeyExpression | undefined, isDefault: boolean): ResolvedKeybindingItem {
		const resolvedKeybinding = (keybinding !== 0 ? new USLayoutResolvedKeybinding(createKeybinding(keybinding, OS)!, OS) : undefined);
		return new ResolvedKeybindingItem(
			resolvedKeybinding,
			command,
			commandArgs,
			when,
			isDefault,
			null,
			false
		);
	}

	function getDispatchStr(runtimeKb: SimpleKeybinding): string {
		return USLayoutResolvedKeybinding.getDispatchStr(runtimeKb)!;
	}

	test('resolve key', function () {
		let keybinding = KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_Z;
		let runtimeKeybinding = createSimpleKeybinding(keybinding, OS);
		let contextRules = ContextKeyExpr.equals('bar', 'baz');
		let keybindingItem = kbItem(keybinding, 'yes', null, contextRules, true);

		assert.strictEqual(KeybindingResolver.contextMatchesRules(createContext({ bar: 'baz' }), contextRules), true);
		assert.strictEqual(KeybindingResolver.contextMatchesRules(createContext({ bar: 'bz' }), contextRules), false);

		let resolver = new KeybindingResolver([keybindingItem], [], () => { });
		assert.strictEqual(resolver.resolve(createContext({ bar: 'baz' }), null, getDispatchStr(runtimeKeybinding))!.commandId, 'yes');
		assert.strictEqual(resolver.resolve(createContext({ bar: 'bz' }), null, getDispatchStr(runtimeKeybinding)), null);
	});

	test('resolve key with arguments', function () {
		let commandArgs = { text: 'no' };
		let keybinding = KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_Z;
		let runtimeKeybinding = createSimpleKeybinding(keybinding, OS);
		let contextRules = ContextKeyExpr.equals('bar', 'baz');
		let keybindingItem = kbItem(keybinding, 'yes', commandArgs, contextRules, true);

		let resolver = new KeybindingResolver([keybindingItem], [], () => { });
		assert.strictEqual(resolver.resolve(createContext({ bar: 'baz' }), null, getDispatchStr(runtimeKeybinding))!.commandArgs, commandArgs);
	});

	test('KeybindingResolver.combine simple 1', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), false),
		]);
	});

	test('KeybindingResolver.combine simple 2', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_C, 'yes3', null, ContextKeyExpr.equals('3', 'c'), false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true),
			kbItem(KeyCode.KEY_C, 'yes3', null, ContextKeyExpr.equals('3', 'c'), false),
		]);
	});

	test('KeybindingResolver.combine removal with not matching when', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_A, '-yes1', null, ContextKeyExpr.equals('1', 'b'), false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('KeybindingResolver.combine removal with not matching keybinding', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_B, '-yes1', null, ContextKeyExpr.equals('1', 'a'), false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('KeybindingResolver.combine removal with matching keybinding and when', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_A, '-yes1', null, ContextKeyExpr.equals('1', 'a'), false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('KeybindingResolver.combine removal with unspecified keybinding', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(0, '-yes1', null, ContextKeyExpr.equals('1', 'a'), false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('KeybindingResolver.combine removal with unspecified when', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_A, '-yes1', null, null!, false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('KeybindingResolver.combine removal with unspecified when and unspecified keybinding', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, 'yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(0, '-yes1', null, null!, false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('issue #612#issuecomment-222109084 cannot remove keybindings for commands with ^', function () {
		let defaults = [
			kbItem(KeyCode.KEY_A, '^yes1', null, ContextKeyExpr.equals('1', 'a'), true),
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		];
		let overrides = [
			kbItem(KeyCode.KEY_A, '-yes1', null, null!, false)
		];
		let actual = KeybindingResolver.combine(defaults, overrides);
		assert.deepStrictEqual(actual, [
			kbItem(KeyCode.KEY_B, 'yes2', null, ContextKeyExpr.equals('2', 'b'), true)
		]);
	});

	test('contextIsEntirelyIncluded', () => {
		const toContextKeyExpression = (expr: ContextKeyExpression | string | null) => {
			if (typeof expr === 'string' || !expr) {
				return ContextKeyExpr.deserialize(expr as string); // {{SQL CARBON EDIT}} strict-null compilation
			}
			return expr;
		};
		const assertIsIncluded = (a: ContextKeyExpression | string | null, b: ContextKeyExpression | string | null) => {
			assert.strictEqual(KeybindingResolver.whenIsEntirelyIncluded(toContextKeyExpression(a), toContextKeyExpression(b)), true);
		};
		const assertIsNotIncluded = (a: ContextKeyExpression | string | null, b: ContextKeyExpression | string | null) => {
			assert.strictEqual(KeybindingResolver.whenIsEntirelyIncluded(toContextKeyExpression(a), toContextKeyExpression(b)), false);
		};

		assertIsIncluded(null, null);
		assertIsIncluded(null, ContextKeyExpr.true());
		assertIsIncluded(ContextKeyExpr.true(), null);
		assertIsIncluded(ContextKeyExpr.true(), ContextKeyExpr.true());
		assertIsIncluded('key1', null);
		assertIsIncluded('key1', '');
		assertIsIncluded('key1', 'key1');
		assertIsIncluded('key1', ContextKeyExpr.true());
		assertIsIncluded('!key1', '');
		assertIsIncluded('!key1', '!key1');
		assertIsIncluded('key2', '');
		assertIsIncluded('key2', 'key2');
		assertIsIncluded('key1 && key1 && key2 && key2', 'key2');
		assertIsIncluded('key1 && key2', 'key2');
		assertIsIncluded('key1 && key2', 'key1');
		assertIsIncluded('key1 && key2', '');
		assertIsIncluded('key1', 'key1 || key2');
		assertIsIncluded('key1 || !key1', 'key2 || !key2');
		assertIsIncluded('key1', 'key1 || key2 && key3');

		assertIsNotIncluded('key1', '!key1');
		assertIsNotIncluded('!key1', 'key1');
		assertIsNotIncluded('key1 && key2', 'key3');
		assertIsNotIncluded('key1 && key2', 'key4');
		assertIsNotIncluded('key1', 'key2');
		assertIsNotIncluded('key1 || key2', 'key2');
		assertIsNotIncluded('', 'key2');
		assertIsNotIncluded(null, 'key2');
	});

	test('resolve command', function () {

		function _kbItem(keybinding: number, command: string, when: ContextKeyExpression | undefined): ResolvedKeybindingItem {
			return kbItem(keybinding, command, null, when, true);
		}

		let items = [
			// This one will never match because its "when" is always overwritten by another one
			_kbItem(
				KeyCode.KEY_X,
				'first',
				ContextKeyExpr.and(
					ContextKeyExpr.equals('key1', true),
					ContextKeyExpr.notEquals('key2', false)
				)
			),
			// This one always overwrites first
			_kbItem(
				KeyCode.KEY_X,
				'second',
				ContextKeyExpr.equals('key2', true)
			),
			// This one is a secondary mapping for `second`
			_kbItem(
				KeyCode.KEY_Z,
				'second',
				null!
			),
			// This one sometimes overwrites first
			_kbItem(
				KeyCode.KEY_X,
				'third',
				ContextKeyExpr.equals('key3', true)
			),
			// This one is always overwritten by another one
			_kbItem(
				KeyMod.CtrlCmd | KeyCode.KEY_Y,
				'fourth',
				ContextKeyExpr.equals('key4', true)
			),
			// This one overwrites with a chord the previous one
			_kbItem(
				KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_Y, KeyCode.KEY_Z),
				'fifth',
				null!
			),
			// This one has no keybinding
			_kbItem(
				0,
				'sixth',
				null!
			),
			_kbItem(
				KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_U),
				'seventh',
				null!
			),
			_kbItem(
				KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_K),
				'seventh',
				null!
			),
			_kbItem(
				KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_U),
				'uncomment lines',
				null!
			),
			_kbItem(
				KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_C),
				'comment lines',
				null!
			),
			_kbItem(
				KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_G, KeyMod.CtrlCmd | KeyCode.KEY_C),
				'unreachablechord',
				null!
			),
			_kbItem(
				KeyMod.CtrlCmd | KeyCode.KEY_G,
				'eleven',
				null!
			)
		];

		let resolver = new KeybindingResolver(items, [], () => { });

		let testKey = (commandId: string, expectedKeys: number[]) => {
			// Test lookup
			let lookupResult = resolver.lookupKeybindings(commandId);
			assert.strictEqual(lookupResult.length, expectedKeys.length, 'Length mismatch @ commandId ' + commandId + '; GOT: ' + JSON.stringify(lookupResult, null, '\t'));
			for (let i = 0, len = lookupResult.length; i < len; i++) {
				const expected = new USLayoutResolvedKeybinding(createKeybinding(expectedKeys[i], OS)!, OS);

				assert.strictEqual(lookupResult[i].resolvedKeybinding!.getUserSettingsLabel(), expected.getUserSettingsLabel(), 'value mismatch @ commandId ' + commandId);
			}
		};

		let testResolve = (ctx: IContext, _expectedKey: number, commandId: string) => {
			const expectedKey = createKeybinding(_expectedKey, OS)!;

			let previousPart: (string | null) = null;
			for (let i = 0, len = expectedKey.parts.length; i < len; i++) {
				let part = getDispatchStr(expectedKey.parts[i]);
				let result = resolver.resolve(ctx, previousPart, part);
				if (i === len - 1) {
					// if it's the final part, then we should find a valid command,
					// and there should not be a chord.
					assert.ok(result !== null, `Enters chord for ${commandId} at part ${i}`);
					assert.strictEqual(result!.commandId, commandId, `Enters chord for ${commandId} at part ${i}`);
					assert.strictEqual(result!.enterChord, false, `Enters chord for ${commandId} at part ${i}`);
				} else {
					// if it's not the final part, then we should not find a valid command,
					// and there should be a chord.
					assert.ok(result !== null, `Enters chord for ${commandId} at part ${i}`);
					assert.strictEqual(result!.commandId, null, `Enters chord for ${commandId} at part ${i}`);
					assert.strictEqual(result!.enterChord, true, `Enters chord for ${commandId} at part ${i}`);
				}
				previousPart = part;
			}
		};

		testKey('first', []);

		testKey('second', [KeyCode.KEY_Z, KeyCode.KEY_X]);
		testResolve(createContext({ key2: true }), KeyCode.KEY_X, 'second');
		testResolve(createContext({}), KeyCode.KEY_Z, 'second');

		testKey('third', [KeyCode.KEY_X]);
		testResolve(createContext({ key3: true }), KeyCode.KEY_X, 'third');

		testKey('fourth', []);

		testKey('fifth', [KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_Y, KeyCode.KEY_Z)]);
		testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_Y, KeyCode.KEY_Z), 'fifth');

		testKey('seventh', [KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_K)]);
		testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_K), 'seventh');

		testKey('uncomment lines', [KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_U)]);
		testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_U), 'uncomment lines');

		testKey('comment lines', [KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_C)]);
		testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_C), 'comment lines');

		testKey('unreachablechord', []);

		testKey('eleven', [KeyMod.CtrlCmd | KeyCode.KEY_G]);
		testResolve(createContext({}), KeyMod.CtrlCmd | KeyCode.KEY_G, 'eleven');

		testKey('sixth', []);
	});
});
