# ---------------------------------------------------------------------------------------------
#   Copyright (c) Microsoft Corporation. All rights reserved.
#   Licensed under the MIT License. See License.txt in the project root for license information.
# ---------------------------------------------------------------------------------------------
#
# Visual Studio Code terminal integration for fish
#
# Manual installation:
#
#   (1) Add the following to the end of `$__fish_config_dir/config.fish`:
#
#         string match -q "$TERM_PROGRAM" "vscode"
#         and . (code --locate-shell-integration-path fish)
#
#   (2) Restart fish.

# Don't run in scripts, other terminals, or more than once per session.
status is-interactive
and string match --quiet "$TERM_PROGRAM" "vscode"
and ! set --query VSCODE_SHELL_INTEGRATION
or exit

set --global VSCODE_SHELL_INTEGRATION 1

# Apply any explicit path prefix (see #99878)
if status --is-login; and set -q VSCODE_PATH_PREFIX
	fish_add_path -p $VSCODE_PATH_PREFIX
end
set -e VSCODE_PATH_PREFIX

# Apply EnvironmentVariableCollections if needed
if test -n "$VSCODE_ENV_REPLACE"
	set ITEMS (string split : $VSCODE_ENV_REPLACE)
	for B in $ITEMS
		set split (string split = $B)
		set -gx "$split[1]" (echo -e "$split[2]")
	end
	set -e VSCODE_ENV_REPLACE
end
if test -n "$VSCODE_ENV_PREPEND"
	set ITEMS (string split : $VSCODE_ENV_PREPEND)
	for B in $ITEMS
		set split (string split = $B)
		set -gx "$split[1]" (echo -e "$split[2]")"$$split[1]" # avoid -p as it adds a space
	end
	set -e VSCODE_ENV_PREPEND
end
if test -n "$VSCODE_ENV_APPEND"
	set ITEMS (string split : $VSCODE_ENV_APPEND)
	for B in $ITEMS
		set split (string split = $B)
		set -gx "$split[1]" "$$split[1]"(echo -e "$split[2]") # avoid -a as it adds a space
	end
	set -e VSCODE_ENV_APPEND
end

# Handle the shell integration nonce
if set -q VSCODE_NONCE
	set -l __vsc_nonce $VSCODE_NONCE
	set -e VSCODE_NONCE
end

# Helper function
function __vsc_esc -d "Emit escape sequences for VS Code shell integration"
	builtin printf "\e]633;%s\a" (string join ";" -- $argv)
end

# Sent right before executing an interactive command.
# Marks the beginning of command output.
function __vsc_cmd_executed --on-event fish_preexec
	__vsc_esc C
	__vsc_esc E (__vsc_escape_value "$argv") $__vsc_nonce

	# Creates a marker to indicate a command was run.
	set --global _vsc_has_cmd
end


# Escape a value for use in the 'P' ("Property") or 'E' ("Command Line") sequences.
# Backslashes are doubled and non-alphanumeric characters are hex encoded.
function __vsc_escape_value
	# Escape backslashes and semi-colons
	echo $argv \
	| string replace --all '\\' '\\\\' \
	| string replace --all ';' '\\x3b' \
	;
end

# Sent right after an interactive command has finished executing.
# Marks the end of command output.
function __vsc_cmd_finished --on-event fish_postexec
	__vsc_esc D $status
end

# Sent when a command line is cleared or reset, but no command was run.
# Marks the cleared line with neither success nor failure.
function __vsc_cmd_clear --on-event fish_cancel
	__vsc_esc D
end

# Preserve the user's existing prompt, to wrap in our escape sequences.
function __preserve_fish_prompt --on-event fish_prompt
	if functions --query fish_prompt
		if functions --query __vsc_fish_prompt
			# Erase the fallback so it can be set to the user's prompt
			functions --erase __vsc_fish_prompt
		end
		functions --copy fish_prompt __vsc_fish_prompt
		functions --erase __preserve_fish_prompt
		# Now __vsc_fish_prompt is guaranteed to be defined
		__init_vscode_shell_integration
	else
		if functions --query __vsc_fish_prompt
			functions --erase __preserve_fish_prompt
			__init_vscode_shell_integration
		else
			# There is no fish_prompt set, so stick with the default
			# Now __vsc_fish_prompt is guaranteed to be defined
			function __vsc_fish_prompt
				echo -n (whoami)@(prompt_hostname) (prompt_pwd) '~> '
			end
		end
	end
end

# Sent whenever a new fish prompt is about to be displayed.
# Updates the current working directory.
function __vsc_update_cwd --on-event fish_prompt
	__vsc_esc P Cwd=(__vsc_escape_value "$PWD")

	# If a command marker exists, remove it.
	# Otherwise, the commandline is empty and no command was run.
	if set --query _vsc_has_cmd
		set --erase _vsc_has_cmd
	else
		__vsc_cmd_clear
	end
end

# Sent at the start of the prompt.
# Marks the beginning of the prompt (and, implicitly, a new line).
function __vsc_fish_prompt_start
	__vsc_esc A
end

# Sent at the end of the prompt.
# Marks the beginning of the user's command input.
function __vsc_fish_cmd_start
	__vsc_esc B
end

function __vsc_fish_has_mode_prompt -d "Returns true if fish_mode_prompt is defined and not empty"
	functions fish_mode_prompt | string match -rvq '^ *(#|function |end$|$)'
end

# Preserve and wrap fish_mode_prompt (which appears to the left of the regular
# prompt), but only if it's not defined as an empty function (which is the
# officially documented way to disable that feature).
function __init_vscode_shell_integration
	if __vsc_fish_has_mode_prompt
		functions --copy fish_mode_prompt __vsc_fish_mode_prompt

		function fish_mode_prompt
			__vsc_fish_prompt_start
			__vsc_fish_mode_prompt
			__vsc_fish_cmd_start
		end

		function fish_prompt
			__vsc_fish_prompt
		end
	else
		# No fish_mode_prompt, so put everything in fish_prompt.
		function fish_prompt
			__vsc_fish_prompt_start
			__vsc_fish_prompt
			__vsc_fish_cmd_start
		end
	end
end
__preserve_fish_prompt
