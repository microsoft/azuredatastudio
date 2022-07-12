/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAutoClosingPair, StandardAutoClosingPairConditional, LanguageConfiguration, CharacterPair } from 'vs/editor/common/modes/languageConfiguration';
import { ScopedLineTokens } from 'vs/editor/common/modes/supports';

export class CharacterPairSupport {

	static readonly DEFAULT_AUTOCLOSE_BEFORE_LANGUAGE_DEFINED = ';:.,=}])> \n\t';
	static readonly DEFAULT_AUTOCLOSE_BEFORE_WHITESPACE = ' \n\t';

	private readonly _autoClosingPairs: StandardAutoClosingPairConditional[];
	private readonly _surroundingPairs: IAutoClosingPair[];
	private readonly _autoCloseBefore: string;
	private readonly _colorizedBracketPairs: CharacterPair[];

	constructor(config: LanguageConfiguration) {
		if (config.autoClosingPairs) {
			this._autoClosingPairs = config.autoClosingPairs.map(el => new StandardAutoClosingPairConditional(el));
		} else if (config.brackets) {
			this._autoClosingPairs = config.brackets.map(b => new StandardAutoClosingPairConditional({ open: b[0], close: b[1] }));
		} else {
			this._autoClosingPairs = [];
		}

		if (config.colorizedBracketPairs) {
			this._colorizedBracketPairs = filterValidBrackets(config.colorizedBracketPairs.map(b => [b[0], b[1]]));
		} else if (config.brackets) {
			this._colorizedBracketPairs = filterValidBrackets(config.brackets
				.map((b) => [b[0], b[1]] as [string, string])
				// Many languages set < ... > as bracket pair, even though they also use it as comparison operator.
				// This leads to problems when colorizing this bracket, so we exclude it by default.
				// Languages can still override this by configuring `colorizedBracketPairs`
				// https://github.com/microsoft/vscode/issues/132476
				.filter((p) => !(p[0] === '<' && p[1] === '>')));
		} else {
			this._colorizedBracketPairs = [];
		}

		if (config.__electricCharacterSupport && config.__electricCharacterSupport.docComment) {
			const docComment = config.__electricCharacterSupport.docComment;
			// IDocComment is legacy, only partially supported
			this._autoClosingPairs.push(new StandardAutoClosingPairConditional({ open: docComment.open, close: docComment.close || '' }));
		}

		this._autoCloseBefore = typeof config.autoCloseBefore === 'string' ? config.autoCloseBefore : CharacterPairSupport.DEFAULT_AUTOCLOSE_BEFORE_LANGUAGE_DEFINED;

		this._surroundingPairs = config.surroundingPairs || this._autoClosingPairs;
	}

	public getAutoClosingPairs(): StandardAutoClosingPairConditional[] {
		return this._autoClosingPairs;
	}

	public getAutoCloseBeforeSet(): string {
		return this._autoCloseBefore;
	}

	public static shouldAutoClosePair(autoClosingPair: StandardAutoClosingPairConditional, context: ScopedLineTokens, column: number): boolean {
		// Always complete on empty line
		if (context.getTokenCount() === 0) {
			return true;
		}

		const tokenIndex = context.findTokenIndexAtOffset(column - 2);
		const standardTokenType = context.getStandardTokenType(tokenIndex);
		return autoClosingPair.isOK(standardTokenType);
	}

	public getSurroundingPairs(): IAutoClosingPair[] {
		return this._surroundingPairs;
	}

	public getColorizedBrackets(): readonly CharacterPair[] {
		return this._colorizedBracketPairs;
	}
}

function filterValidBrackets(bracketPairs: [string, string][]): [string, string][] {
	return bracketPairs.filter(([open, close]) => open !== '' && close !== '');
}
