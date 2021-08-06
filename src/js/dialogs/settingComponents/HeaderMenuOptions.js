import { Box, Icon, IconButton } from '@material-ui/core';
import React, { Component } from 'react';

export default class HeaderMenuOptions extends Component {
	helpLink = this.props.helpUrl ?? 'https://cwrc.ca/Documentation/CWRC-Writer';
	openDialog = () => this.props.dialog.dialog('open');

	render() {
		return (
			<Box>
				<IconButton
					aria-label="settings"
					className="settingsLink"
					onClick={this.openDialog}
					size="small"
					style={{ color: '#ffffff' }}
				>
					<Icon fontSize="small">settings</Icon>
				</IconButton>
				<IconButton
					aria-label="help"
					className="helpLink"
					href={this.helpLink}
					rel="noopener noreferrer"
					size="small"
					style={{ marginLeft: '8px', color: '#ffffff' }}
					target="_blank"
				>
					<Icon fontSize="small">help</Icon>
				</IconButton>
			</Box>
		);
	}
}
