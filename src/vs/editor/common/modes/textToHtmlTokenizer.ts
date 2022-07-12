/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CharCode } from 'vs/base/common/charCode';
import * as strings from 'vs/base/common/strings';
import { IViewLineTokens, LineTokens } from 'vs/editor/common/core/lineTokens';
import { TokenizationResult2 } from 'vs/editor/common/core/token';
import { ILanguageIdCodec, IState, LanguageId } from 'vs/editor/common/modes';
import { NULL_STATE, nullTokenize2 } from 'vs/editor/common/modes/nullMode';

export interface IReducedTokenizationSupport {
	getInitialState(): IState;
	tokenize2(line: string, hasEOL: boolean, state: IState, offsetDelta: number): TokenizationResult2;
}

const fallback: IReducedTokenizationSupport = {
	getInitialState: () => NULL_STATE,
	tokenize2: (buffer: string, hasEOL: boolean, state: IState, deltaOffset: number) => nullTokenize2(LanguageId.Null, buffer, state, deltaOffset)
};

export function tokenizeToString(text: string, languageIdCodec: ILanguageIdCodec, tokenizationSupport: IReducedTokenizationSupport = fallback): string {
	return _tokenizeToString(text, languageIdCodec, tokenizationSupport || fallback);
}

export function tokenizeLineToHTML(text: string, viewLineTokens: IViewLineTokens, colorMap: string[], startOffset: number, endOffset: number, tabSize: number, useNbsp: boolean): string {
	let result = `<div>`;
	let charIndex = startOffset;
	let tabsCharDelta = 0;

	let prevIsSpace = true;

	for (let tokenIndex = 0, tokenCount = viewLineTokens.getCount(); tokenIndex < tokenCount; tokenIndex++) {
		const tokenEndIndex = viewLineTokens.getEndOffset(tokenIndex);

		if (tokenEndIndex <= startOffset) {
			continue;
		}

		let partContent = '';

		for (; charIndex < tokenEndIndex && charIndex < endOffset; charIndex++) {
			const charCode = text.charCodeAt(charIndex);

			switch (charCode) {
				case CharCode.Tab:
					let insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
					tabsCharDelta += insertSpacesCount - 1;
					while (insertSpacesCount > 0) {
						if (useNbsp && prevIsSpace) {
							partContent += '&#160;';
							prevIsSpace = false;
						} else {
							partContent += ' ';
							prevIsSpace = true;
						}
						insertSpacesCount--;
					}
					break;

				case CharCode.LessThan:
					partContent += '&lt;';
					prevIsSpace = false;
					break;

				case CharCode.GreaterThan:
					partContent += '&gt;';
					prevIsSpace = false;
					break;

				case CharCode.Ampersand:
					partContent += '&amp;';
					prevIsSpace = false;
					break;

				case CharCode.Null:
					partContent += '&#00;';
					prevIsSpace = false;
					break;

				case CharCode.UTF8_BOM:
				case CharCode.LINE_SEPARATOR:
				case CharCode.PARAGRAPH_SEPARATOR:
				case CharCode.NEXT_LINE:
					partContent += '\ufffd';
					prevIsSpace = false;
					break;

				case CharCode.CarriageReturn:
					// zero width space, because carriage return would introduce a line break
					partContent += '&#8203';
					prevIsSpace = false;
					break;

				case CharCode.Space:
					if (useNbsp && prevIsSpace) {
						partContent += '&#160;';
						prevIsSpace = false;
					} else {
						partContent += ' ';
						prevIsSpace = true;
					}
					break;

				default:
					partContent += String.fromCharCode(charCode);
					prevIsSpace = false;
			}
		}

		result += `<span style="${viewLineTokens.getInlineStyle(tokenIndex, colorMap)}">${partContent}</span>`;

		if (tokenEndIndex > endOffset || charIndex >= endOffset) {
			break;
		}
	}

	result += `</div>`;
	return result;
}

function _tokenizeToString(text: string, languageIdCodec: ILanguageIdCodec, tokenizationSupport: IReducedTokenizationSupport): string {
	let result = `<div class="monaco-tokenized-source">`;
	const lines = strings.splitLines(text);
	let currentState = tokenizationSupport.getInitialState();
	for (let i = 0, len = lines.length; i < len; i++) {
		const line = lines[i];

		if (i > 0) {
			result += `<br/>`;
		}

		const tokenizationResult = tokenizationSupport.tokenize2(line, true, currentState, 0);
		LineTokens.convertToEndOffset(tokenizationResult.tokens, line.length);
		const lineTokens = new LineTokens(tokenizationResult.tokens, line, languageIdCodec);
		const viewLineTokens = lineTokens.inflate();

		let startOffset = 0;
		for (let j = 0, lenJ = viewLineTokens.getCount(); j < lenJ; j++) {
			const type = viewLineTokens.getClassName(j);
			const endIndex = viewLineTokens.getEndOffset(j);
			result += `<span class="${type}">${strings.escape(line.substring(startOffset, endIndex))}</span>`;
			startOffset = endIndex;
		}

		currentState = tokenizationResult.endState;
	}

	result += `</div>`;
	return result;
}
