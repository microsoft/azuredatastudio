/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import { TokenizationResult2 } from 'vs/editor/common/core/token';
import { LanguageAgnosticBracketTokens } from 'vs/editor/common/model/bracketPairs/bracketPairsTree/brackets';
import { Length, lengthAdd, lengthsToRange, lengthZero } from 'vs/editor/common/model/bracketPairs/bracketPairsTree/length';
import { DenseKeyProvider } from 'vs/editor/common/model/bracketPairs/bracketPairsTree/smallImmutableSet';
import { TextBufferTokenizer, Token, Tokenizer, TokenKind } from 'vs/editor/common/model/bracketPairs/bracketPairsTree/tokenizer';
import { TextModel } from 'vs/editor/common/model/textModel';
import { IState, ITokenizationSupport, LanguageId, MetadataConsts, StandardTokenType, TokenizationRegistry } from 'vs/editor/common/modes';
import { LanguageConfigurationRegistry } from 'vs/editor/common/modes/languageConfigurationRegistry';
import { ModesRegistry } from 'vs/editor/common/modes/modesRegistry';
import { IModeService } from 'vs/editor/common/services/modeService';
import { createModelServices, createTextModel2 } from 'vs/editor/test/common/editorTestUtils';
import { TestLanguageConfigurationService } from 'vs/editor/test/common/modes/testLanguageConfigurationService';

suite('Bracket Pair Colorizer - Tokenizer', () => {
	test('Basic', () => {
		const mode1 = 'testMode1';
		const [instantiationService, disposableStore] = createModelServices();
		const modeService = instantiationService.invokeFunction((accessor) => accessor.get(IModeService));
		disposableStore.add(ModesRegistry.registerLanguage({ id: mode1 }));
		const encodedMode1 = modeService.languageIdCodec.encodeLanguageId(mode1);

		const denseKeyProvider = new DenseKeyProvider<string>();

		const tStandard = (text: string) => new TokenInfo(text, encodedMode1, StandardTokenType.Other);
		const tComment = (text: string) => new TokenInfo(text, encodedMode1, StandardTokenType.Comment);
		const document = new TokenizedDocument([
			tStandard(' { } '), tStandard('be'), tStandard('gin end'), tStandard('\n'),
			tStandard('hello'), tComment('{'), tStandard('}'),
		]);

		disposableStore.add(TokenizationRegistry.register(mode1, document.getTokenizationSupport()));
		disposableStore.add(LanguageConfigurationRegistry.register(mode1, {
			brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['begin', 'end']],
		}));

		const model = disposableStore.add(createTextModel2(instantiationService, document.getText(), {}, mode1));
		model.forceTokenization(model.getLineCount());

		const languageConfigService = new TestLanguageConfigurationService();
		const brackets = new LanguageAgnosticBracketTokens(denseKeyProvider, l => languageConfigService.getLanguageConfiguration(l, undefined));

		const tokens = readAllTokens(new TextBufferTokenizer(model, brackets));

		assert.deepStrictEqual(toArr(tokens, model, denseKeyProvider), [
			{ text: ' ', bracketId: null, bracketIds: [], kind: 'Text' },
			{
				text: '{',
				bracketId: 'testMode1:::{',
				bracketIds: ['testMode1:::{'],
				kind: 'OpeningBracket',
			},
			{ text: ' ', bracketId: null, bracketIds: [], kind: 'Text' },
			{
				text: '}',
				bracketId: 'testMode1:::{',
				bracketIds: ['testMode1:::{'],
				kind: 'ClosingBracket',
			},
			{ text: ' ', bracketId: null, bracketIds: [], kind: 'Text' },
			{
				text: 'begin',
				bracketId: 'testMode1:::begin',
				bracketIds: ['testMode1:::begin'],
				kind: 'OpeningBracket',
			},
			{ text: ' ', bracketId: null, bracketIds: [], kind: 'Text' },
			{
				text: 'end',
				bracketId: 'testMode1:::begin',
				bracketIds: ['testMode1:::begin'],
				kind: 'ClosingBracket',
			},
			{ text: '\nhello{', bracketId: null, bracketIds: [], kind: 'Text' },
			{
				text: '}',
				bracketId: 'testMode1:::{',
				bracketIds: ['testMode1:::{'],
				kind: 'ClosingBracket',
			},
		]);

		disposableStore.dispose();
	});
});

function readAllTokens(tokenizer: Tokenizer): Token[] {
	const tokens = new Array<Token>();
	while (true) {
		const token = tokenizer.read();
		if (!token) {
			break;
		}
		tokens.push(token);
	}
	return tokens;
}

function toArr(tokens: Token[], model: TextModel, keyProvider: DenseKeyProvider<string>): any[] {
	const result = new Array<any>();
	let offset = lengthZero;
	for (const token of tokens) {
		result.push(tokenToObj(token, offset, model, keyProvider));
		offset = lengthAdd(offset, token.length);
	}
	return result;
}

function tokenToObj(token: Token, offset: Length, model: TextModel, keyProvider: DenseKeyProvider<any>): any {
	return {
		text: model.getValueInRange(lengthsToRange(offset, lengthAdd(offset, token.length))),
		bracketId: keyProvider.reverseLookup(token.bracketId) || null,
		bracketIds: keyProvider.reverseLookupSet(token.bracketIds),
		kind: {
			[TokenKind.ClosingBracket]: 'ClosingBracket',
			[TokenKind.OpeningBracket]: 'OpeningBracket',
			[TokenKind.Text]: 'Text',
		}[token.kind]
	};
}

class TokenizedDocument {
	private readonly tokensByLine: readonly TokenInfo[][];
	constructor(tokens: TokenInfo[]) {
		const tokensByLine = new Array<TokenInfo[]>();
		let curLine = new Array<TokenInfo>();

		for (const token of tokens) {
			const lines = token.text.split('\n');
			let first = true;
			while (lines.length > 0) {
				if (!first) {
					tokensByLine.push(curLine);
					curLine = new Array<TokenInfo>();
				} else {
					first = false;
				}

				if (lines[0].length > 0) {
					curLine.push(token.withText(lines[0]));
				}
				lines.pop();
			}
		}

		tokensByLine.push(curLine);

		this.tokensByLine = tokensByLine;
	}

	getText() {
		return this.tokensByLine.map(t => t.map(t => t.text).join('')).join('\n');
	}

	getTokenizationSupport(): ITokenizationSupport {
		class State implements IState {
			constructor(public readonly lineNumber: number) { }

			clone(): IState {
				return new State(this.lineNumber);
			}

			equals(other: IState): boolean {
				return this.lineNumber === (other as State).lineNumber;
			}
		}

		return {
			getInitialState: () => new State(0),
			tokenize: () => { throw new Error('Method not implemented.'); },
			tokenize2: (line: string, hasEOL: boolean, state: IState, offsetDelta: number): TokenizationResult2 => {
				const state2 = state as State;
				const tokens = this.tokensByLine[state2.lineNumber];
				const arr = new Array<number>();
				let offset = 0;
				for (const t of tokens) {
					arr.push(offset, t.getMetadata());
					offset += t.text.length;
				}

				return new TokenizationResult2(new Uint32Array(arr), new State(state2.lineNumber + 1));
			}
		};
	}
}

class TokenInfo {
	constructor(public readonly text: string, public readonly languageId: LanguageId, public readonly tokenType: StandardTokenType) { }

	getMetadata(): number {
		return (
			(this.languageId << MetadataConsts.LANGUAGEID_OFFSET)
			| (this.tokenType << MetadataConsts.TOKEN_TYPE_OFFSET)
		) >>> 0;
	}

	withText(text: string): TokenInfo {
		return new TokenInfo(text, this.languageId, this.tokenType);
	}
}
