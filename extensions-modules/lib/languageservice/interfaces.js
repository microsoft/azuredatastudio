"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PackageError extends Error {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(message, pkg = undefined, innerError = undefined) {
        super(message);
        this.message = message;
        this.pkg = pkg;
        this.innerError = innerError;
    }
}
exports.PackageError = PackageError;
//# sourceMappingURL=interfaces.js.map