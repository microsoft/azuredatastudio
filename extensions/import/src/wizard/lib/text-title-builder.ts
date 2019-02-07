import {LineRange, SelectionInfo} from './types/selection-info';

export default class TextTitleBuilder {

    build(textInfo: SelectionInfo | null): string {
        if (!textInfo) return 'N/A';

        const suffix = this.lineRangesSuffix(textInfo.lineRanges);
        return `${textInfo.fileName}${suffix}`;
    }

    private lineRangesSuffix(lineRanges: LineRange[]): string {
        return lineRanges.length !== 0
            ? ` (${lineRanges.map(this.lineRangeLabel)})`
            : '';
    }

    private lineRangeLabel(lineRange: LineRange): string {
        const isOneLine = lineRange.start === lineRange.end;
        return isOneLine
            ? `l.${lineRange.start + 1}`
            : `ll.${lineRange.start + 1}-${lineRange.end + 1}`;
    }
}
