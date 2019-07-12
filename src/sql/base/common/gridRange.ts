/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGridPosition, GridPosition } from 'sql/base/common/gridPosition';
import { isNumber } from 'vs/base/common/types';

/**
 * A range in a grid. This interface is suitable for serialization.
 */
export interface IGridRange {
	/**
	 * Row on which the range starts (starts at 1).
	 */
	readonly startRow: number;
	/**
	 * Column on which the range starts in line `startRow` (starts at 1).
	 */
	readonly startColumn: number;
	/**
	 * Row on which the range ends.
	 */
	readonly endRow: number;
	/**
	 * Column on which the range ends in line `endRow`.
	 */
	readonly endColumn: number;
}

/**
 * A range in a grid. (startRow,startColumn) is <= (endRow,endColumn)
 */
export class GridRange {

	/**
	 * Row on which the range starts (starts at 1).
	 */
	public readonly startRow: number;
	/**
	 * Column on which the range starts in line `startRow` (starts at 1).
	 */
	public readonly startColumn: number;
	/**
	 * Row on which the range ends.
	 */
	public readonly endRow: number;
	/**
	 * Column on which the range ends in line `endRow`.
	 */
	public readonly endColumn: number;

	constructor(startRow: number, startColumn: number, endRow?: number, endColumn?: number) {
		this.startRow = isNumber(endRow) ? Math.min(startRow, endRow) : startRow;
		this.startColumn = isNumber(endColumn) ? Math.min(startColumn, endColumn) : startColumn;
		this.endRow = isNumber(endRow) ? Math.max(endRow, startRow) : startRow;
		this.endColumn = isNumber(endColumn) ? Math.max(endColumn, startColumn) : startColumn;
	}

	/**
	 * Test if position is in this range. If the position is at the edges, will return true.
	 */
	public containsPosition(position: IGridPosition): boolean {
		return GridRange.containsPosition(this, position);
	}

	/**
	 * Test if `position` is in `range`. If the position is at the edges, will return true.
	 */
	public static containsPosition(range: IGridRange, position: IGridPosition): boolean {
		return position.row >= range.startRow
			&& position.row <= range.endRow
			&& position.column >= range.startColumn
			&& position.column <= range.endColumn;
	}

	/**
	 * Test if range is in this range. If the range is equal to this range, will return true.
	 */
	public containsRange(range: IGridRange): boolean {
		return GridRange.containsRange(this, range);
	}

	/**
	 * Test if `otherRange` is in `range`. If the ranges are equal, will return true.
	 */
	public static containsRange(range: IGridRange, otherRange: IGridRange): boolean {
		if (otherRange.startRow < range.startRow || otherRange.endRow < range.startRow) {
			return false;
		}
		if (otherRange.startRow > range.endRow || otherRange.endRow > range.endRow) {
			return false;
		}
		if (otherRange.startRow === range.startRow && otherRange.startColumn < range.startColumn) {
			return false;
		}
		if (otherRange.endRow === range.endRow && otherRange.endColumn > range.endColumn) {
			return false;
		}
		return true;
	}

	/**
	 * A reunion of the two ranges.
	 * The smallest position will be used as the start point, and the largest one as the end point.
	 */
	public plusRange(range: IGridRange): GridRange {
		return GridRange.plusRange(this, range);
	}

	/**
	 * A reunion of the two ranges.
	 * The smallest position will be used as the start point, and the largest one as the end point.
	 */
	public static plusRange(a: IGridRange, b: IGridRange): GridRange {
		let startRow = Math.min(a.startRow, b.startRow);
		let startColumn = Math.min(a.startColumn, b.startColumn);
		let endRow = Math.max(a.endRow, b.endRow);
		let endColumn = Math.max(a.endColumn, b.endColumn);

		return new GridRange(startRow, startColumn, endRow, endColumn);
	}

	/**
	 * A intersection of the two ranges.
	 */
	public intersectRanges(range: IGridRange): GridRange | null {
		return GridRange.intersectRanges(this, range);
	}

	/**
	 * A intersection of the two ranges.
	 */
	public static intersectRanges(a: IGridRange, b: IGridRange): GridRange | null {
		let resultStartRow = a.startRow;
		let resultStartColumn = a.startColumn;
		let resultEndRow = a.endRow;
		let resultEndColumn = a.endColumn;
		let otherStartRow = b.startRow;
		let otherStartColumn = b.startColumn;
		let otherEndRow = b.endRow;
		let otherEndColumn = b.endColumn;

		if (resultStartRow < otherStartRow) {
			resultStartRow = otherStartRow;
			resultStartColumn = otherStartColumn;
		} else if (resultStartRow === otherStartRow) {
			resultStartColumn = Math.max(resultStartColumn, otherStartColumn);
		}

		if (resultEndRow > otherEndRow) {
			resultEndRow = otherEndRow;
			resultEndColumn = otherEndColumn;
		} else if (resultEndRow === otherEndRow) {
			resultEndColumn = Math.min(resultEndColumn, otherEndColumn);
		}

		// Check if selection is now empty
		if (resultStartRow > resultEndRow) {
			return null;
		}
		if (resultStartRow === resultEndRow && resultStartColumn > resultEndColumn) {
			return null;
		}
		return new GridRange(resultStartRow, resultStartColumn, resultEndRow, resultEndColumn);
	}

	/**
	 * Test if this range equals other.
	 */
	public equalsRange(other: IGridRange | null): boolean {
		return GridRange.equalsRange(this, other);
	}

	/**
	 * Test if range `a` equals `b`.
	 */
	public static equalsRange(a: IGridRange | null, b: IGridRange | null): boolean {
		return (
			!!a &&
			!!b &&
			a.startRow === b.startRow &&
			a.startColumn === b.startColumn &&
			a.endRow === b.endRow &&
			a.endColumn === b.endColumn
		);
	}

	/**
	 * Return the end position (which will be after or equal to the start position)
	 */
	public getEndPosition(): GridPosition {
		return new GridPosition(this.endRow, this.endColumn);
	}

	/**
	 * Return the start position (which will be before or equal to the end position)
	 */
	public getStartPosition(): GridPosition {
		return new GridPosition(this.startRow, this.startColumn);
	}

	/**
	 * Transform to a user presentable string representation.
	 */
	public toString(): string {
		return '[' + this.startRow + ',' + this.startColumn + ' -> ' + this.endRow + ',' + this.endColumn + ']';
	}

	/**
	 * Create a new range using this range's start position, and using endRow and endColumn as the end position.
	 */
	public setEndPosition(endRow: number, endColumn: number): GridRange {
		return new GridRange(this.startRow, this.startColumn, endRow, endColumn);
	}

	/**
	 * Create a new range using this range's end position, and using startRow and startColumn as the start position.
	 */
	public setStartPosition(startRow: number, startColumn: number): GridRange {
		return new GridRange(startRow, startColumn, this.endRow, this.endColumn);
	}

	/**
	 * Create a new empty range using this range's start position.
	 */
	public collapseToStart(): GridRange {
		return GridRange.collapseToStart(this);
	}

	/**
	 * Create a new empty range using this range's start position.
	 */
	public static collapseToStart(range: IGridRange): GridRange {
		return new GridRange(range.startRow, range.startColumn, range.startRow, range.startColumn);
	}

	// ---

	public static fromPositions(start: IGridPosition, end: IGridPosition = start): GridRange {
		return new GridRange(start.row, start.column, end.row, end.column);
	}

	/**
	 * Create a `GridRange` from an `IGridRange`.
	 */
	public static lift(range: undefined | null): null;
	public static lift(range: IGridRange): GridRange;
	public static lift(range: IGridRange | undefined | null): GridRange | null {
		if (!range) {
			return null;
		}
		return new GridRange(range.startRow, range.startColumn, range.endRow, range.endColumn);
	}

	/**
	 * Test if `obj` is an `IGridRange`.
	 */
	public static isIRange(obj: any): obj is IGridRange {
		return (
			obj
			&& (typeof obj.startRow === 'number')
			&& (typeof obj.startColumn === 'number')
			&& (typeof obj.endRow === 'number')
			&& (typeof obj.endColumn === 'number')
		);
	}

	/**
	 * Test if the two ranges are touching in any way.
	 */
	public static areIntersectingOrTouching(a: IGridRange, b: IGridRange): boolean {
		// Check if `a` is before `b`
		if (a.endRow < b.startRow || (a.endRow === b.startRow && a.endColumn < b.startColumn)) {
			return false;
		}

		// Check if `b` is before `a`
		if (b.endRow < a.startRow || (b.endRow === a.startRow && b.endColumn < a.startColumn)) {
			return false;
		}

		// These ranges must intersect
		return true;
	}

	/**
	 * Test if the two ranges are intersecting. If the ranges are touching it returns true.
	 */
	public static areIntersecting(a: IGridRange, b: IGridRange): boolean {
		// Check if `a` is before `b`
		if (a.endRow < b.startRow || (a.endRow === b.startRow && a.endColumn <= b.startColumn)) {
			return false;
		}

		// Check if `b` is before `a`
		if (b.endRow < a.startRow || (b.endRow === a.startRow && b.endColumn <= a.startColumn)) {
			return false;
		}

		// These ranges must intersect
		return true;
	}

	/**
	 * A function that compares ranges, useful for sorting ranges
	 * It will first compare ranges on the startPosition and then on the endPosition
	 */
	public static compareRangesUsingStarts(a: IGridRange | null | undefined, b: IGridRange | null | undefined): number {
		if (a && b) {
			const aStartRow = a.startRow | 0;
			const bStartRow = b.startRow | 0;

			if (aStartRow === bStartRow) {
				const aStartColumn = a.startColumn | 0;
				const bStartColumn = b.startColumn | 0;

				if (aStartColumn === bStartColumn) {
					const aEndRow = a.endRow | 0;
					const bEndRow = b.endRow | 0;

					if (aEndRow === bEndRow) {
						const aEndColumn = a.endColumn | 0;
						const bEndColumn = b.endColumn | 0;
						return aEndColumn - bEndColumn;
					}
					return aEndRow - bEndRow;
				}
				return aStartColumn - bStartColumn;
			}
			return aStartRow - bStartRow;
		}
		const aExists = (a ? 1 : 0);
		const bExists = (b ? 1 : 0);
		return aExists - bExists;
	}

	/**
	 * A function that compares ranges, useful for sorting ranges
	 * It will first compare ranges on the endPosition and then on the startPosition
	 */
	public static compareRangesUsingEnds(a: IGridRange, b: IGridRange): number {
		if (a.endRow === b.endRow) {
			if (a.endColumn === b.endColumn) {
				if (a.startRow === b.startRow) {
					return a.startColumn - b.startColumn;
				}
				return a.startRow - b.startRow;
			}
			return a.endColumn - b.endColumn;
		}
		return a.endRow - b.endRow;
	}

	/**
	 * Test if the range spans multiple lines.
	 */
	public static spansMultipleLines(range: IGridRange): boolean {
		return range.endRow > range.startRow;
	}
}
