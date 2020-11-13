namespace BatchWrapper
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
            /// Path to the directory containing the sqlpackage exe.
            /// </summary>
            internal const string AppPackagePrefix = "AZ_BATCH_APP_PACKAGE";

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
