/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IViewportRange, IBufferRange, IBufferLine, IBuffer, IBufferCellPosition } from 'xterm';
import { IRange } from 'vs/editor/common/core/range';

/**
 * Converts a possibly wrapped link's range (comprised of string indices) into a buffer range that plays nicely with xterm.js
 *
 * @param lines A single line (not the entire buffer)
 * @param bufferWidth The number of columns in the terminal
 * @param range The link range - string indices
 * @param startLine The absolute y position (on the buffer) of the line
 */
export function convertLinkRangeToBuffer(
	lines: IBufferLine[],
	bufferWidth: number,
	range: IRange,
	startLine: number
): IBufferRange {
	const bufferRange: IBufferRange = {
		start: {
			x: range.startColumn,
			y: range.startLineNumber + startLine
		},
		end: {
			x: range.endColumn - 1,
			y: range.endLineNumber + startLine
		}
	};

	// Shift start range right for each wide character before the link
	let startOffset = 0;
	const startWrappedLineCount = Math.ceil(range.startColumn / bufferWidth);
	for (let y = 0; y < Math.min(startWrappedLineCount); y++) {
		const lineLength = Math.min(bufferWidth, range.startColumn - y * bufferWidth);
		let lineOffset = 0;
		const line = lines[y];
		// Sanity check for line, apparently this can happen but it's not clear under what
		// circumstances this happens. Continue on, skipping the remainder of start offset if this
		// happens to minimize impact.
		if (!line) {
			break;
		}
		for (let x = 0; x < Math.min(bufferWidth, lineLength + lineOffset); x++) {
			const cell = line.getCell(x)!;
			const width = cell.getWidth();
			if (width === 2) {
				lineOffset++;
			}
			const char = cell.getChars();
			if (char.length > 1) {
				lineOffset -= char.length - 1;
			}
		}
		startOffset += lineOffset;
	}

	// Shift end range right for each wide character inside the link
	let endOffset = 0;
	const endWrappedLineCount = Math.ceil(range.endColumn / bufferWidth);
	for (let y = Math.max(0, startWrappedLineCount - 1); y < endWrappedLineCount; y++) {
		const start = (y === startWrappedLineCount - 1 ? (range.startColumn + startOffset) % bufferWidth : 0);
		const lineLength = Math.min(bufferWidth, range.endColumn + startOffset - y * bufferWidth);
		const startLineOffset = (y === startWrappedLineCount - 1 ? startOffset : 0);
		let lineOffset = 0;
		const line = lines[y];
		// Sanity check for line, apparently this can happen but it's not clear under what
		// circumstances this happens. Continue on, skipping the remainder of start offset if this
		// happens to minimize impact.
		if (!line) {
			break;
		}
		for (let x = start; x < Math.min(bufferWidth, lineLength + lineOffset + startLineOffset); x++) {
			const cell = line.getCell(x)!;
			const width = cell.getWidth();
			// Offset for 0 cells following wide characters
			if (width === 2) {
				lineOffset++;
			}
			// Offset for early wrapping when the last cell in row is a wide character
			if (x === bufferWidth - 1 && cell.getChars() === '') {
				lineOffset++;
			}
		}
		endOffset += lineOffset;
	}

	// Apply the width character offsets to the result
	bufferRange.start.x += startOffset;
	bufferRange.end.x += startOffset + endOffset;

	// Convert back to wrapped lines
	while (bufferRange.start.x > bufferWidth) {
		bufferRange.start.x -= bufferWidth;
		bufferRange.start.y++;
	}
	while (bufferRange.end.x > bufferWidth) {
		bufferRange.end.x -= bufferWidth;
		bufferRange.end.y++;
	}

	return bufferRange;
}

export function convertBufferRangeToViewport(bufferRange: IBufferRange, viewportY: number): IViewportRange {
	return {
		start: {
			x: bufferRange.start.x - 1,
			y: bufferRange.start.y - viewportY - 1
		},
		end: {
			x: bufferRange.end.x - 1,
			y: bufferRange.end.y - viewportY - 1
		}
	};
}

export function getXtermLineContent(buffer: IBuffer, lineStart: number, lineEnd: number, cols: number): string {
	let content = '';
	for (let i = lineStart; i <= lineEnd; i++) {
		// Make sure only 0 to cols are considered as resizing when windows mode is enabled will
		// retain buffer data outside of the terminal width as reflow is disabled.
		const line = buffer.getLine(i);
		if (line) {
			content += line.translateToString(true, 0, cols);
		}
	}
	return content;
}

export function positionIsInRange(position: IBufferCellPosition, range: IBufferRange): boolean {
	if (position.y < range.start.y || position.y > range.end.y) {
		return false;
	}
	if (position.y === range.start.y && position.x < range.start.x) {
		return false;
	}
	if (position.y === range.end.y && position.x > range.end.x) {
		return false;
	}
	return true;
}
