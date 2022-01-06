/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotSupportedError } from 'vs/base/common/errors';
import { LineTokens } from 'vs/editor/common/core/lineTokens';
import { ITextModel } from 'vs/editor/common/model';
import { LanguageId, StandardTokenType, TokenMetadata } from 'vs/editor/common/modes';
import { BracketAstNode, TextAstNode } from './ast';
import { BracketTokens, LanguageAgnosticBracketTokens } from './brackets';
import { lengthGetColumnCountIfZeroLineCount, Length, lengthAdd, lengthDiff, lengthToObj, lengthZero, toLength } from './length';

export interface Tokenizer {
	readonly offset: Length;
	readonly length: Length;

	read(): Token | null;
	peek(): Token | null;
	skip(length: Length): void;

	getText(): string;
}

export const enum TokenKind {
	Text = 0,
	OpeningBracket = 1,
	ClosingBracket = 2,
}

export class Token {
	constructor(
		readonly length: Length,
		readonly kind: TokenKind,
		readonly category: number,
		readonly languageId: LanguageId,
		readonly astNode: BracketAstNode | TextAstNode | undefined,
	) { }
}

export class TextBufferTokenizer implements Tokenizer {
	private readonly textBufferLineCount: number;
	private readonly textBufferLastLineLength: number;

	private readonly reader = new NonPeekableTextBufferTokenizer(this.textModel, this.bracketTokens);

	constructor(
		private readonly textModel: ITextModel,
		private readonly bracketTokens: LanguageAgnosticBracketTokens
	) {
		this.textBufferLineCount = textModel.getLineCount();
		this.textBufferLastLineLength = textModel.getLineLength(this.textBufferLineCount);
	}

	private _offset: Length = lengthZero;

	get offset() {
		return this._offset;
	}

	get length() {
		return toLength(this.textBufferLineCount, this.textBufferLastLineLength);
	}

	getText() {
		return this.textModel.getValue();
	}

	skip(length: Length): void {
		this.didPeek = false;
		this._offset = lengthAdd(this._offset, length);
		const obj = lengthToObj(this._offset);
		this.reader.setPosition(obj.lineCount, obj.columnCount);
	}

	private didPeek = false;
	private peeked: Token | null = null;

	read(): Token | null {
		let token: Token | null;
		if (this.peeked) {
			this.didPeek = false;
			token = this.peeked;
		} else {
			token = this.reader.read();
		}
		if (token) {
			this._offset = lengthAdd(this._offset, token.length);
		}
		return token;
	}

	peek(): Token | null {
		if (!this.didPeek) {
			this.peeked = this.reader.read();
			this.didPeek = true;
		}
		return this.peeked;
	}
}

/**
 * Does not support peek.
*/
class NonPeekableTextBufferTokenizer {
	private readonly textBufferLineCount: number;
	private readonly textBufferLastLineLength: number;

	constructor(private readonly textModel: ITextModel, private readonly bracketTokens: LanguageAgnosticBracketTokens) {
		this.textBufferLineCount = textModel.getLineCount();
		this.textBufferLastLineLength = textModel.getLineLength(this.textBufferLineCount);
	}

	private lineIdx = 0;
	private line: string | null = null;
	private lineCharOffset = 0;
	private lineTokens: LineTokens | null = null;
	private lineTokenOffset = 0;

	public setPosition(lineIdx: number, column: number): void {
		// We must not jump into a token!
		if (lineIdx === this.lineIdx) {
			this.lineCharOffset = column;
			this.lineTokenOffset = this.lineCharOffset === 0 ? 0 : this.lineTokens!.findTokenIndexAtOffset(this.lineCharOffset);
		} else {
			this.lineIdx = lineIdx;
			this.lineCharOffset = column;
			this.line = null;
		}
		this.peekedToken = null;
	}

	/** Must be a zero line token. The end of the document cannot be peeked. */
	private peekedToken: Token | null = null;

	public read(): Token | null {
		if (this.peekedToken) {
			const token = this.peekedToken;
			this.peekedToken = null;
			this.lineCharOffset += lengthGetColumnCountIfZeroLineCount(token.length);
			return token;
		}

		if (this.lineIdx > this.textBufferLineCount - 1 || (this.lineIdx === this.textBufferLineCount - 1 && this.lineCharOffset >= this.textBufferLastLineLength)) {
			// We are after the end
			return null;
		}

		if (this.line === null) {
			this.lineTokens = this.textModel.getLineTokens(this.lineIdx + 1);
			this.line = this.lineTokens.getLineContent();
			this.lineTokenOffset = this.lineCharOffset === 0 ? 0 : this.lineTokens!.findTokenIndexAtOffset(this.lineCharOffset);
		}

		const startLineIdx = this.lineIdx;
		const startLineCharOffset = this.lineCharOffset;

		// limits the length of text tokens.
		// If text tokens get too long, incremental updates will be slow
		let lengthHeuristic = 0;
		while (lengthHeuristic < 1000) {
			const lineTokens = this.lineTokens!;
			const tokenCount = lineTokens.getCount();

			let peekedBracketToken: Token | null = null;

			if (this.lineTokenOffset < tokenCount) {
				let tokenMetadata = lineTokens.getMetadata(this.lineTokenOffset);
				while (this.lineTokenOffset + 1 < tokenCount && tokenMetadata === lineTokens.getMetadata(this.lineTokenOffset + 1)) {
					// Skip tokens that are identical.
					// Sometimes, (bracket) identifiers are split up into multiple tokens.
					this.lineTokenOffset++;
				}

				const isOther = TokenMetadata.getTokenType(tokenMetadata) === StandardTokenType.Other;

				const endOffset = lineTokens.getEndOffset(this.lineTokenOffset);
				// Is there a bracket token next? Only consume text.
				if (isOther && endOffset !== this.lineCharOffset) {
					const languageId = lineTokens.getLanguageId(this.lineTokenOffset);
					const text = this.line.substring(this.lineCharOffset, endOffset);

					const brackets = this.bracketTokens.getSingleLanguageBracketTokens(languageId);
					const regexp = brackets.regExpGlobal;
					if (regexp) {
						regexp.lastIndex = 0;
						const match = regexp.exec(text);
						if (match) {
							peekedBracketToken = brackets.getToken(match[0])!;
							if (peekedBracketToken) {
								// Consume leading text of the token
								this.lineCharOffset += match.index;
							}
						}
					}
				}

				lengthHeuristic += endOffset - this.lineCharOffset;

				if (peekedBracketToken) {
					// Don't skip the entire token, as a single token could contain multiple brackets.

					if (startLineIdx !== this.lineIdx || startLineCharOffset !== this.lineCharOffset) {
						// There is text before the bracket
						this.peekedToken = peekedBracketToken;
						break;
					} else {
						// Consume the peeked token
						this.lineCharOffset += lengthGetColumnCountIfZeroLineCount(peekedBracketToken.length);
						return peekedBracketToken;
					}
				} else {
					// Skip the entire token, as the token contains no brackets at all.
					this.lineTokenOffset++;
					this.lineCharOffset = endOffset;
				}
			} else {
				if (this.lineIdx === this.textBufferLineCount - 1) {
					break;
				}
				this.lineIdx++;
				this.lineTokens = this.textModel.getLineTokens(this.lineIdx + 1);
				this.lineTokenOffset = 0;
				this.line = this.lineTokens.getLineContent();
				this.lineCharOffset = 0;

				lengthHeuristic++;
			}
		}

		const length = lengthDiff(startLineIdx, startLineCharOffset, this.lineIdx, this.lineCharOffset);
		return new Token(length, TokenKind.Text, -1, -1, new TextAstNode(length));
	}
}

export class FastTokenizer implements Tokenizer {
	private _offset: Length = lengthZero;
	private readonly tokens: readonly Token[];
	private idx = 0;

	constructor(private readonly text: string, brackets: BracketTokens) {
		const regExpStr = brackets.getRegExpStr();
		const regexp = regExpStr ? new RegExp(brackets.getRegExpStr() + '|\n', 'g') : null;

		const tokens: Token[] = [];

		let match: RegExpExecArray | null;
		let curLineCount = 0;
		let lastLineBreakOffset = 0;

		let lastTokenEndOffset = 0;
		let lastTokenEndLine = 0;

		const smallTextTokens0Line = new Array<Token>();
		for (let i = 0; i < 60; i++) {
			smallTextTokens0Line.push(
				new Token(
					toLength(0, i), TokenKind.Text, -1, -1,
					new TextAstNode(toLength(0, i))
				)
			);
		}

		const smallTextTokens1Line = new Array<Token>();
		for (let i = 0; i < 60; i++) {
			smallTextTokens1Line.push(
				new Token(
					toLength(1, i), TokenKind.Text, -1, -1,
					new TextAstNode(toLength(1, i))
				)
			);
		}

		if (regexp) {
			regexp.lastIndex = 0;
			while ((match = regexp.exec(text)) !== null) {
				const curOffset = match.index;
				const value = match[0];
				if (value === '\n') {
					curLineCount++;
					lastLineBreakOffset = curOffset + 1;
				} else {
					if (lastTokenEndOffset !== curOffset) {
						let token: Token;
						if (lastTokenEndLine === curLineCount) {
							const colCount = curOffset - lastTokenEndOffset;
							if (colCount < smallTextTokens0Line.length) {
								token = smallTextTokens0Line[colCount];
							} else {
								const length = toLength(0, colCount);
								token = new Token(length, TokenKind.Text, -1, -1, new TextAstNode(length));
							}
						} else {
							const lineCount = curLineCount - lastTokenEndLine;
							const colCount = curOffset - lastLineBreakOffset;
							if (lineCount === 1 && colCount < smallTextTokens1Line.length) {
								token = smallTextTokens1Line[colCount];
							} else {
								const length = toLength(lineCount, colCount);
								token = new Token(length, TokenKind.Text, -1, -1, new TextAstNode(length));
							}
						}
						tokens.push(token);
					}

					// value is matched by regexp, so the token must exist
					tokens.push(brackets.getToken(value)!);

					lastTokenEndOffset = curOffset + value.length;
					lastTokenEndLine = curLineCount;
				}
			}
		}

		const offset = text.length;

		if (lastTokenEndOffset !== offset) {
			const length = (lastTokenEndLine === curLineCount)
				? toLength(0, offset - lastTokenEndOffset)
				: toLength(curLineCount - lastTokenEndLine, offset - lastLineBreakOffset);
			tokens.push(new Token(length, TokenKind.Text, -1, -1, new TextAstNode(length)));
		}

		this.length = toLength(curLineCount, offset - lastLineBreakOffset);
		this.tokens = tokens;
	}

	get offset(): Length {
		return this._offset;
	}

	readonly length: Length;

	read(): Token | null {
		return this.tokens[this.idx++] || null;
	}

	peek(): Token | null {
		return this.tokens[this.idx] || null;
	}

	skip(length: Length): void {
		throw new NotSupportedError();
	}

	getText(): string {
		return this.text;
	}
}
