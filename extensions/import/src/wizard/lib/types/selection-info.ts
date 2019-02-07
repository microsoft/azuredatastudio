
export interface SelectionInfo {
    text: string;
    fileName: string;
    lineRanges: LineRange[];
}

export type LineRange = {
    start: number;
    end: number;
};
