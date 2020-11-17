namespace SqlPackageWrapper
{
    /// <summary>
    /// Constants for the batch wrapper.
    /// </summary>
    public static class Constants
    {
        /// <summary>
        /// Environment variable names present or needed during the batch task execution.
        /// </summary>
        public static class EnvironmentVariableNames
        {
            /// <summary>
            /// Path to the directory containing the batch wrapper exe.
            /// </summary>
            public const string WrapperLocation = "AZ_BATCH_APP_PACKAGE_BATCHWRAPPER";

            /// <summary>
            /// Path to the directory containing the sqlpackage exe.
            /// </summary>
            internal const string SqlPackageLocation = "AZ_BATCH_APP_PACKAGE_SQLPACKAGE";

            /// <summary>
            /// Path to the working directory assigned to the batch task.
            /// </summary>
            internal const string TaskWorkingDir = "AZ_BATCH_TASK_WORKING_DIR";

            /// <summary>
            /// Path to the working directory assigned to the batch task.
            /// </summary>
            internal const string AzBatchTaskId = "AZ_BATCH_TASK_ID";

            /// <summary>
            /// Path to the working directory assigned to the batch task.
            /// </summary>
            internal const string JobContainerUrl = "JOB_CONTAINER_URL";
        }
    }
}
