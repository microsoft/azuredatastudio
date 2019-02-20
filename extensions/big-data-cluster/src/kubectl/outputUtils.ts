export type Dictionary<T> = {
    [key: string]: T
};

export module Dictionary {
    export function of<T>(): Dictionary<T> {
        return {};
    }
}

/**
 * Parse column based output which is seperated by whitespace(s) from kubectl or similar sources
 * for example, kubectl get po
 * @param lineOutput raw output with headers from kubectl or similar sources
 * @param columnSeparator a regex for the column separators
 * @return array of objects with key as column header and value
 */
export function parseLineOutput(lineOutput: string[], columnSeparator: RegExp): { [key: string]: string }[] {
    const headers = lineOutput.shift();
    if (!headers) {
        return [];
    }
    const parsedHeaders = headers.toLowerCase().replace(columnSeparator, '|').split('|');
    return lineOutput.map((line) => {
        const lineInfoObject = Dictionary.of<string>();
        const bits = line.replace(columnSeparator, '|').split('|');
        bits.forEach((columnValue, index) => {
            lineInfoObject[parsedHeaders[index].trim()] = columnValue.trim();
        });
        return lineInfoObject;
    });
}
