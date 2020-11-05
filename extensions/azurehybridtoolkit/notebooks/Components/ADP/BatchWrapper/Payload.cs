﻿namespace BatchWrapper
{
    /// <summary>
    /// The top-level object stored in the key vault for an import/export operation.
    /// </summary>
    public sealed class Payload
    {
        /// <summary>
        /// The Name of sqlpackage to use for performing the import/export operation.
        /// </summary>
        public string ApplicatonPackageName{ get; set; }

        /// <summary>
        /// The Version of sqlpackage to use for performing the import/export operation.
        /// </summary>
        public string ApplicatonPackageVersion { get; set; }

        /// <summary>
        /// The type of sqlpackage action to perform.
        /// </summary>
        public ActionType Action { get; set; }

        /// <summary>
        /// The logical server name to export from or import to.
        /// </summary>
        public string LogicalServerName { get; set; }

        /// <summary>
        /// The database name to export from or import to.
        /// </summary>
        public string DatabaseName { get; set; }

        /// <summary>
        /// The server admin username.
        /// </summary>
        public string AccessToken { get; set; }
    }
}
