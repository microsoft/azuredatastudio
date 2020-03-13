/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: how to disable linter for leading whitespace in multi-line strings?

export const newSqlProjectTemplate = `<?xml version="1.0" encoding="utf-8"?>
<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" ToolsVersion="4.0">
\u0020\u0020<PropertyGroup>
\u0020\u0020\u0020\u0020<Configuration Condition=" '$(Configuration)' == '' ">Debug</Configuration>
\u0020\u0020\u0020\u0020<Platform Condition=" '$(Platform)' == '' ">AnyCPU</Platform>
\u0020\u0020\u0020\u0020<Name>@@PROJECT_NAME@@</Name>
\u0020\u0020\u0020\u0020<SchemaVersion>2.0</SchemaVersion>
\u0020\u0020\u0020\u0020<ProjectVersion>4.1</ProjectVersion>
\u0020\u0020\u0020\u0020<ProjectGuid>{@@PROJECT_GUID@@}</ProjectGuid>
\u0020\u0020\u0020\u0020<DSP>Microsoft.Data.Tools.Schema.Sql.Sql130DatabaseSchemaProvider</DSP>
\u0020\u0020\u0020\u0020<OutputType>Database</OutputType>
\u0020\u0020\u0020\u0020<RootPath>
\u0020\u0020\u0020\u0020</RootPath>
\u0020\u0020\u0020\u0020<RootNamespace>@@PROJECT_NAME@@</RootNamespace>
\u0020\u0020\u0020\u0020<AssemblyName>@@PROJECT_NAME@@</AssemblyName>
\u0020\u0020\u0020\u0020<ModelCollation>1033, CI</ModelCollation>
\u0020\u0020\u0020\u0020<DefaultFileStructure>BySchemaAndSchemaType</DefaultFileStructure>
\u0020\u0020\u0020\u0020<DeployToDatabase>True</DeployToDatabase>
\u0020\u0020\u0020\u0020<TargetFrameworkVersion>v4.5</TargetFrameworkVersion>
\u0020\u0020\u0020\u0020<TargetLanguage>CS</TargetLanguage>
\u0020\u0020\u0020\u0020<AppDesignerFolder>Properties</AppDesignerFolder>
\u0020\u0020\u0020\u0020<SqlServerVerification>False</SqlServerVerification>
\u0020\u0020\u0020\u0020<IncludeCompositeObjects>True</IncludeCompositeObjects>
\u0020\u0020\u0020\u0020<TargetDatabaseSet>True</TargetDatabaseSet>
\u0020\u0020</PropertyGroup>
\u0020\u0020<PropertyGroup Condition=" '$(Configuration)|$(Platform)' == 'Release|AnyCPU' ">
\u0020\u0020\u0020\u0020<OutputPath>bin\\Release\\</OutputPath>
\u0020\u0020\u0020\u0020<BuildScriptName>$(MSBuildProjectName).sql</BuildScriptName>
\u0020\u0020\u0020\u0020<TreatWarningsAsErrors>False</TreatWarningsAsErrors>
\u0020\u0020\u0020\u0020<DebugType>pdbonly</DebugType>
\u0020\u0020\u0020\u0020<Optimize>true</Optimize>
\u0020\u0020\u0020\u0020<DefineDebug>false</DefineDebug>
\u0020\u0020\u0020\u0020<DefineTrace>true</DefineTrace>
\u0020\u0020\u0020\u0020<ErrorReport>prompt</ErrorReport>
\u0020\u0020\u0020\u0020<WarningLevel>4</WarningLevel>
\u0020\u0020</PropertyGroup>
\u0020\u0020<PropertyGroup Condition=" '$(Configuration)|$(Platform)' == 'Debug|AnyCPU' ">
\u0020\u0020\u0020\u0020<OutputPath>bin\\Debug\\</OutputPath>
\u0020\u0020\u0020\u0020<BuildScriptName>$(MSBuildProjectName).sql</BuildScriptName>
\u0020\u0020\u0020\u0020<TreatWarningsAsErrors>false</TreatWarningsAsErrors>
\u0020\u0020\u0020\u0020<DebugSymbols>true</DebugSymbols>
\u0020\u0020\u0020\u0020<DebugType>full</DebugType>
\u0020\u0020\u0020\u0020<Optimize>false</Optimize>
\u0020\u0020\u0020\u0020<DefineDebug>true</DefineDebug>
\u0020\u0020\u0020\u0020<DefineTrace>true</DefineTrace>
\u0020\u0020\u0020\u0020<ErrorReport>prompt</ErrorReport>
\u0020\u0020\u0020\u0020<WarningLevel>4</WarningLevel>
\u0020\u0020</PropertyGroup>
\u0020\u0020<PropertyGroup>
\u0020\u0020\u0020\u0020<VisualStudioVersion Condition="'$(VisualStudioVersion)' == ''">11.0</VisualStudioVersion>
\u0020\u0020\u0020\u0020<!-- Default to the v11.0 targets path if the targets file for the current VS version is not found -->
\u0020\u0020\u0020\u0020<SSDTExists Condition="Exists('$(MSBuildExtensionsPath)\\Microsoft\\VisualStudio\\v$(VisualStudioVersion)\\SSDT\\Microsoft.Data.Tools.Schema.SqlTasks.targets')">True</SSDTExists>
\u0020\u0020\u0020\u0020<VisualStudioVersion Condition="'$(SSDTExists)' == ''">11.0</VisualStudioVersion>
\u0020\u0020</PropertyGroup>
\u0020\u0020<Import Condition="'$(SQLDBExtensionsRefPath)' != ''" Project="$(SQLDBExtensionsRefPath)\\Microsoft.Data.Tools.Schema.SqlTasks.targets" />
\u0020\u0020<Import Condition="'$(SQLDBExtensionsRefPath)' == ''" Project="$(MSBuildExtensionsPath)\\Microsoft\\VisualStudio\\v$(VisualStudioVersion)\\SSDT\\Microsoft.Data.Tools.Schema.SqlTasks.targets" />
\u0020\u0020<ItemGroup>
\u0020\u0020\u0020\u0020<Folder Include="Properties" />
\u0020\u0020</ItemGroup>
</Project>
`;
