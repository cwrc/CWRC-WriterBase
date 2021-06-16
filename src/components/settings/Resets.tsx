import { Box, Button, Typography } from '@material-ui/core';
import { Notify } from '@src/@types/types';
import { useApp } from '@src/overmind';
import React, { FC, useEffect, useState } from 'react';
import Notification from '../Notification';

const notifyDefault: Notify = {
  message: '',
  open: false,
};

const Resets: FC = () => {
  const { actions } = useApp();
  const [notify, setNotify] = useState(notifyDefault);

  useEffect(() => {
    return () => {
      setNotify(notifyDefault);
    };
  }, []);

  const handleResetWarning = () => {
    actions.editor.resetDialogWarnings();

    const message = 'Confirmation dialog preferences have been reset';
    setNotify({ open: true, message });
  };

  const handleResetSettings = () => {
    actions.editor.resetPreferences();

    const message = 'Settings preferences have been reset to default';
    setNotify({ open: true, message });
  };

  const handleCloseNotification = () => setNotify(notifyDefault);

  return (
    <Box id="fontSize" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Preferences</Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          rowGap: 2,
          flex: 2,
          mt: 0.5,
          pl: 1,
        }}
      >
        <Button color="inherit" onClick={handleResetWarning} variant="outlined">
          Reset Dialog Warnings
        </Button>
        <Button color="inherit" onClick={handleResetSettings} variant="outlined">
          Reset Settings
        </Button>
      </Box>
      <Notification message={notify.message} onClose={handleCloseNotification} open={notify.open} />
    </Box>
  );
};

export default Resets;
