/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A position in a grid. This interface is suitable for serialization.
 */
export interface IGridPosition {
	/**
	 * line number (starts at 1)
	 */
	readonly row: number;
	/**
	 * column
	 */
	readonly column: number;
}

/**
 * A position in a grid.
 */
export class GridPosition {
	/**
	 * row (starts at 1)
	 */
	public readonly row: number;
	/**
	 * column
	 */
	public readonly column: number;

	constructor(row: number, column: number) {
		this.row = row;
		this.column = column;
	}

	/**
	 * Create a new postion from this position.
	 *
	 * @param newRow new row
	 * @param newColumn new column
	 */
	with(newRow: number = this.row, newColumn: number = this.column): GridPosition {
		if (newRow === this.row && newColumn === this.column) {
			return this;
		} else {
			return new GridPosition(newRow, newColumn);
		}
	}

	/**
	 * Derive a new grid position from this grid position.
	 *
	 * @param deltaRow row delta
	 * @param deltaColumn column delta
	 */
	delta(deltaRow: number = 0, deltaColumn: number = 0): GridPosition {
		return this.with(this.row + deltaRow, this.column + deltaColumn);
	}

	/**
	 * Test if this grid position equals other grid position
	 */
	public equals(other: IGridPosition): boolean {
		return GridPosition.equals(this, other);
	}

	/**
	 * Test if grid position `a` equals grid position `b`
	 */
	public static equals(a: IGridPosition | null, b: IGridPosition | null): boolean {
		if (!a && !b) {
			return true;
		}
		return (
			!!a &&
			!!b &&
			a.row === b.row &&
			a.column === b.column
		);
	}

	/**
	 * Test if this grid position is before other grid position.
	 * If the two grid positions are equal, the result will be false.
	 */
	public isBefore(other: IGridPosition): boolean {
		return GridPosition.isBefore(this, other);
	}

	/**
	 * Test if grid position `a` is before grid position `b`.
	 * If the two grid positions are equal, the result will be false.
	 */
	public static isBefore(a: IGridPosition, b: IGridPosition): boolean {
		if (a.row < b.row) {
			return true;
		}
		if (b.row < a.row) {
			return false;
		}
		return a.column < b.column;
	}

	/**
	 * Test if this grid position is before other grid position.
	 * If the two grid positions are equal, the result will be true.
	 */
	public isBeforeOrEqual(other: IGridPosition): boolean {
		return GridPosition.isBeforeOrEqual(this, other);
	}

	/**
	 * Test if grid position `a` is before grid position `b`.
	 * If the two grid positions are equal, the result will be true.
	 */
	public static isBeforeOrEqual(a: IGridPosition, b: IGridPosition): boolean {
		if (a.row < b.row) {
			return true;
		}
		if (b.row < a.row) {
			return false;
		}
		return a.column <= b.column;
	}

	/**
	 * A function that compares grid positions, useful for sorting
	 */
	public static compare(a: IGridPosition, b: IGridPosition): number {
		let aRow = a.row | 0;
		let bRow = b.row | 0;

		if (aRow === bRow) {
			let aColumn = a.column | 0;
			let bColumn = b.column | 0;
			return aColumn - bColumn;
		}

		return aRow - bRow;
	}

	/**
	 * Clone this grid position.
	 */
	public clone(): GridPosition {
		return new GridPosition(this.row, this.column);
	}

	/**
	 * Convert to a human-readable representation.
	 */
	public toString(): string {
		return '(' + this.row + ',' + this.column + ')';
	}

	// ---

	/**
	 * Create a `GridPosition` from an `IGridPosition`.
	 */
	public static lift(pos: IGridPosition): GridPosition {
		return new GridPosition(pos.row, pos.column);
	}

	/**
	 * Test if `obj` is an `IGridPosition`.
	 */
	public static isIGridPosition(obj: any): obj is IGridPosition {
		return (
			obj
			&& (typeof obj.row === 'number')
			&& (typeof obj.column === 'number')
		);
	}
}
