import { AppBar, Box, IconButton, Toolbar, Tooltip, Typography, useTheme } from '@material-ui/core';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import SettingsIcon from '@material-ui/icons/Settings';
import React, { FC, MouseEvent, useState } from 'react';
import { useApp } from '../overmind';
import SettingsDialog from './settings';

interface TopBarProps {
  title?: string;
  helpUrl?: string;
}

const TopBar: FC<TopBarProps> = ({
  title = 'CWRC-Writer',
  helpUrl = 'https://cwrc.ca/CWRC-Writer_Documentation/',
}) => {
  const { state } = useApp();
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [anchorProfileEl, setAnchorProfileEl] = useState<HTMLDivElement | undefined>();

  const handleProfileClick = (event: MouseEvent<HTMLDivElement>) => {
    setAnchorProfileEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorProfileEl(undefined);
  };

  const openSettingsDialog = () => setSettingsOpen(true);
  const closeSettingsDialog = () => setSettingsOpen(false);

  return (
    <div>
      <AppBar color="default" elevation={2}>
        <Toolbar variant="dense">
          <Box display="flex" flexDirection="row" alignItems="center" justifyContent="center">
            <img
              src={
                theme.palette.mode === 'light'
                  ? '/images/cwrclogo-black.png'
                  : '/images/cwrclogo-white.png'
              }
              alt="CWRC"
              height={32}
            />
          </Box>
          <Typography component="h1" sx={{ marginLeft: 1, cursor: 'default' }} variant="h6">
            {title}
          </Typography>
          <Box flexGrow={1} />
          {/* <Stack
            display="flex"
            direction="column"
            alignItems="center"
          >
          <Typography
            component="h4"
            variant="caption"
          >
            https://github.com/lucaju/Git-Writer-demos/blob/master/letter-sample2.xml
          </Typography>
          <Typography
            component="h3"
            variant="subtitle2"
          >
            Sample TEI letter.xml
          </Typography>
          </Stack> */}
          <Box flexGrow={1} />
          <Box display="flex" flexDirection="row" alignItems="center" justifyContent="flex-end">
            <Tooltip title="Settings">
              <IconButton aria-label="settings" onClick={openSettingsDialog}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Help">
              <IconButton
                aria-label="help"
                href={helpUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>
            {/* {state.session.user && (
              <Avatar
                sx={{
                  cursor: 'pointer',
                  height: 4,
                  width: 4,
                }}
                onClick={handleProfileClick}
                src={
                  state.session.user.avatarUrl &&
                  `${APP_URL}/uploads/assets${state.session.user.avatarUrl}`
                }
              >
                {!state.session.user.avatarUrl && <AccountCircleIcon />}
              </Avatar>
            )} */}
          </Box>
        </Toolbar>
        {/* {anchorProfileEl && <Profile anchor={anchorProfileEl} handleClose={handleProfileClose} />} */}
        <SettingsDialog open={settingsOpen} handleClose={closeSettingsDialog} />
      </AppBar>
    </div>
  );
};

export default TopBar;
