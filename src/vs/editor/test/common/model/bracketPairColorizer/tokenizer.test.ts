/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import { DisposableStore } from 'vs/base/common/lifecycle';
import { TokenizationResult2 } from 'vs/editor/common/core/token';
import { LanguageAgnosticBracketTokens } from 'vs/editor/common/model/bracketPairColorizer/brackets';
import { Length, lengthAdd, lengthsToRange, lengthZero } from 'vs/editor/common/model/bracketPairColorizer/length';
import { TextBufferTokenizer, Token, Tokenizer, TokenKind } from 'vs/editor/common/model/bracketPairColorizer/tokenizer';
import { TextModel } from 'vs/editor/common/model/textModel';
import { IState, ITokenizationSupport, LanguageId, LanguageIdentifier, MetadataConsts, StandardTokenType, TokenizationRegistry } from 'vs/editor/common/modes';
import { LanguageConfigurationRegistry } from 'vs/editor/common/modes/languageConfigurationRegistry';
import { createTextModel } from 'vs/editor/test/common/editorTestUtils';

suite('Bracket Pair Colorizer - Tokenizer', () => {
	test('Basic', () => {
		const mode1 = new LanguageIdentifier('testMode1', 2);

		const tStandard = (text: string) => new TokenInfo(text, mode1.id, StandardTokenType.Other);
		const tComment = (text: string) => new TokenInfo(text, mode1.id, StandardTokenType.Comment);
		const document = new TokenizedDocument([
			tStandard(' { } '), tStandard('be'), tStandard('gin end'), tStandard('\n'),
			tStandard('hello'), tComment('{'), tStandard('}'),
		]);

		const disposableStore = new DisposableStore();
		disposableStore.add(TokenizationRegistry.register(mode1.language, document.getTokenizationSupport()));
		disposableStore.add(LanguageConfigurationRegistry.register(mode1, {
			brackets: [['{', '}'], ['[', ']'], ['(', ')']],
		}));

		const brackets = new LanguageAgnosticBracketTokens([['begin', 'end']]);

		const model = createTextModel(document.getText(), {}, mode1);
		model.forceTokenization(model.getLineCount());

		const tokens = readAllTokens(new TextBufferTokenizer(model, brackets));

		assert.deepStrictEqual(toArr(tokens, model), [
			{ category: -1, kind: 'Text', languageId: -1, text: ' ', },
			{ category: 2000, kind: 'OpeningBracket', languageId: 2, text: '{', },
			{ category: -1, kind: 'Text', languageId: -1, text: ' ', },
			{ category: 2000, kind: 'ClosingBracket', languageId: 2, text: '}', },
			{ category: -1, kind: 'Text', languageId: -1, text: ' ', },
			{ category: 2004, kind: 'OpeningBracket', languageId: 2, text: 'begin', },
			{ category: -1, kind: 'Text', languageId: -1, text: ' ', },
			{ category: 2004, kind: 'ClosingBracket', languageId: 2, text: 'end', },
			{ category: -1, kind: 'Text', languageId: -1, text: '\nhello{', },
			{ category: 2000, kind: 'ClosingBracket', languageId: 2, text: '}', }
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

function toArr(tokens: Token[], model: TextModel): any[] {
	const result = new Array<any>();
	let offset = lengthZero;
	for (const token of tokens) {
		result.push(tokenToObj(token, offset, model));
		offset = lengthAdd(offset, token.length);
	}
	return result;
}

function tokenToObj(token: Token, offset: Length, model: TextModel): any {
	return {
		text: model.getValueInRange(lengthsToRange(offset, lengthAdd(offset, token.length))),
		category: token.category,
		kind: {
			[TokenKind.ClosingBracket]: 'ClosingBracket',
			[TokenKind.OpeningBracket]: 'OpeningBracket',
			[TokenKind.Text]: 'Text',
		}[token.kind],
		languageId: token.languageId,
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
