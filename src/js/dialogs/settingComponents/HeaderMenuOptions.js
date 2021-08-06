import { Box, Icon, IconButton } from '@material-ui/core';
import React from 'react';

const HeaderMenuOptions = ({ dialog, helpUrl }) => {
	const helpLink = helpUrl ?? 'https://cwrc.ca/Documentation/CWRC-Writer';
	const openDialog = () => dialog.dialog('open');

	return (
		<Box>
			<IconButton
				aria-label="settings"
				className="settingsLink"
				onClick={openDialog}
				size="small"
				style={{ color: '#ffffff' }}
			>
				<Icon fontSize="small">settings</Icon>
			</IconButton>
			<IconButton
				aria-label="help"
				className="helpLink"
				href={helpLink}
				rel="noopener noreferrer"
				size="small"
				style={{ marginLeft: '8px', color: '#ffffff' }}
				target="_blank"
			>
				<Icon fontSize="small">help</Icon>
			</IconButton>
		</Box>
	);
};

export default HeaderMenuOptions;
