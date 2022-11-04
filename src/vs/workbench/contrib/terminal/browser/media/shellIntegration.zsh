# ---------------------------------------------------------------------------------------------
#   Copyright (c) Microsoft Corporation. All rights reserved.
#   Licensed under the MIT License. See License.txt in the project root for license information.
# ---------------------------------------------------------------------------------------------
builtin autoload -Uz add-zsh-hook

# Now that the init script is running, unset ZDOTDIR to ensure ~/.zlogout runs as expected as well
# as prevent problems that may occur if the user's init scripts depend on ZDOTDIR not being set.
builtin unset ZDOTDIR

# This variable allows the shell to both detect that VS Code's shell integration is enabled as well
# as disable it by unsetting the variable.
VSCODE_SHELL_INTEGRATION=1


if [[ $options[norcs] = off  && -f ~/.zshrc ]]; then
	. ~/.zshrc
fi

# Shell integration was disabled by the shell, exit without warning assuming either the shell has
# explicitly disabled shell integration as it's incompatible or it implements the protocol.
if [ -z "$VSCODE_SHELL_INTEGRATION" ]; then
	builtin return
fi

__vsc_in_command_execution="1"
__vsc_last_history_id=0

__vsc_prompt_start() {
	builtin printf "\033]633;A\007"
}

__vsc_prompt_end() {
	builtin printf "\033]633;B\007"
}

__vsc_update_cwd() {
	builtin printf "\033]633;P;Cwd=%s\007" "$PWD"
}

__vsc_command_output_start() {
	builtin printf "\033]633;C\007"
}

__vsc_continuation_start() {
	builtin printf "\033]633;F\007"
}

__vsc_continuation_end() {
	builtin printf "\033]633;G\007"
}

__vsc_right_prompt_start() {
	builtin printf "\033]633;H\007"
}

__vsc_right_prompt_end() {
	builtin printf "\033]633;I\007"
}

__vsc_command_complete() {
	builtin local __vsc_history_id=$(builtin history | tail -n1 | awk '{print $1;}')
	if [[ "$__vsc_history_id" == "$__vsc_last_history_id" ]]; then
		builtin printf "\033]633;D\007"
	else
		builtin printf "\033]633;D;%s\007" "$__vsc_status"
		__vsc_last_history_id=$__vsc_history_id
	fi
	__vsc_update_cwd
}

__vsc_update_prompt() {
	__vsc_prior_prompt="$PS1"
	__vsc_in_command_execution=""
	PS1="%{$(__vsc_prompt_start)%}$PREFIX$PS1%{$(__vsc_prompt_end)%}"
	PS2="%{$(__vsc_continuation_start)%}$PS2%{$(__vsc_continuation_end)%}"
	if [ -n "$RPROMPT" ]; then
		__vsc_prior_rprompt="$RPROMPT"
		RPROMPT="%{$(__vsc_right_prompt_start)%}$RPROMPT%{$(__vsc_right_prompt_end)%}"
	fi
}

__vsc_precmd() {
	local __vsc_status="$?"
	if [ -z "${__vsc_in_command_execution-}" ]; then
		# not in command execution
		__vsc_command_output_start
	fi

	__vsc_command_complete "$__vsc_status"

	# in command execution
	if [ -n "$__vsc_in_command_execution" ]; then
		# non null
		__vsc_update_prompt
	fi
}

__vsc_preexec() {
	PS1="$__vsc_prior_prompt"
	if [ -n "$RPROMPT" ]; then
		RPROMPT="$__vsc_prior_rprompt"
	fi
	__vsc_in_command_execution="1"
	__vsc_command_output_start
}
add-zsh-hook precmd __vsc_precmd
add-zsh-hook preexec __vsc_preexec

# Show the welcome message
if [ -z "${VSCODE_SHELL_HIDE_WELCOME-}" ]; then
	builtin echo "\033[1;32mShell integration activated\033[0m"
else
	VSCODE_SHELL_HIDE_WELCOME=""
fi
