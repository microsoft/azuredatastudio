"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Summary that identifies a unique database connection.
 */
class ConnectionSummary {
}
exports.ConnectionSummary = ConnectionSummary;
/**
 * Connection response format.
 */
class ConnectionCompleteParams {
}
exports.ConnectionCompleteParams = ConnectionCompleteParams;
/**
 * Update event parameters
 */
class IntelliSenseReadyParams {
}
exports.IntelliSenseReadyParams = IntelliSenseReadyParams;
/**
 * Information about a SQL Server instance.
 */
class ServerInfo {
}
exports.ServerInfo = ServerInfo;
class CapabiltiesDiscoveryResult {
}
exports.CapabiltiesDiscoveryResult = CapabiltiesDiscoveryResult;
// Task Services types
var TaskStatus;
(function (TaskStatus) {
    TaskStatus[TaskStatus["notStarted"] = 0] = "notStarted";
    TaskStatus[TaskStatus["inProgress"] = 1] = "inProgress";
    TaskStatus[TaskStatus["succeeded"] = 2] = "succeeded";
    TaskStatus[TaskStatus["succeededWithWarning"] = 3] = "succeededWithWarning";
    TaskStatus[TaskStatus["failed"] = 4] = "failed";
    TaskStatus[TaskStatus["canceled"] = 5] = "canceled";
})(TaskStatus = exports.TaskStatus || (exports.TaskStatus = {}));
var EditRowState;
(function (EditRowState) {
    EditRowState[EditRowState["clean"] = 0] = "clean";
    EditRowState[EditRowState["dirtyInsert"] = 1] = "dirtyInsert";
    EditRowState[EditRowState["dirtyDelete"] = 2] = "dirtyDelete";
    EditRowState[EditRowState["dirtyUpdate"] = 3] = "dirtyUpdate";
})(EditRowState = exports.EditRowState || (exports.EditRowState = {}));
class MetadataQueryParams {
}
exports.MetadataQueryParams = MetadataQueryParams;
/**
 * Used as value version of data.MetadataType THESE SHOULD MIRROR
 */
var MetadataType;
(function (MetadataType) {
    MetadataType[MetadataType["Table"] = 0] = "Table";
    MetadataType[MetadataType["View"] = 1] = "View";
    MetadataType[MetadataType["SProc"] = 2] = "SProc";
    MetadataType[MetadataType["Function"] = 3] = "Function";
})(MetadataType = exports.MetadataType || (exports.MetadataType = {}));
class MetadataQueryResult {
}
exports.MetadataQueryResult = MetadataQueryResult;
class TableMetadata {
}
exports.TableMetadata = TableMetadata;
/**
 * Used as value version of data.ScriptOperation THESE SHOULD BE THE SAME
 */
var ScriptOperation;
(function (ScriptOperation) {
    ScriptOperation[ScriptOperation["Select"] = 0] = "Select";
    ScriptOperation[ScriptOperation["Create"] = 1] = "Create";
    ScriptOperation[ScriptOperation["Insert"] = 2] = "Insert";
    ScriptOperation[ScriptOperation["Update"] = 3] = "Update";
    ScriptOperation[ScriptOperation["Delete"] = 4] = "Delete";
    ScriptOperation[ScriptOperation["Execute"] = 5] = "Execute";
    ScriptOperation[ScriptOperation["Alter"] = 6] = "Alter";
})(ScriptOperation = exports.ScriptOperation || (exports.ScriptOperation = {}));
