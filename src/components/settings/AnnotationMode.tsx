import { Box, MenuItem, Select, Typography } from '@material-ui/core';
import { Notify } from '@src/@types/types';
import React, { FC, useEffect, useState } from 'react';
import { useApp } from '../../overmind';
import Notification from '../Notification';
import useSettings from './useSettings';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const AnnotationMode: FC = () => {
  const { state } = useApp();
  const { changeAnnotationMode } = useSettings();

  const [notify, setNotify] = useState(notifyDefault);
  const [previousValue, setPreviousValue] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      setNotify(notifyDefault);
      setPreviousValue(null);
    };
  }, []);

  const handleChange = (value: number, isUndo?: boolean) => {
    setPreviousValue(state.editor.annotationMode);

    const response = changeAnnotationMode(value, isUndo);

    setNotify({ open: true, message: response, hasUndo: isUndo ? false : true });
  };

  const handleCloseNotification = () => {
    setPreviousValue(null);
    setNotify(notifyDefault);
  };

  const handleUndo = () => {
    previousValue ? handleChange(previousValue, true) : handleCloseNotification();
  };

  return (
    <Box id="fontSize" sx={{ display: 'flex', my: 1.5 }}>
      <Box sx={{ flex: 1, textAlignLast: 'right', pr: 1.5, pt: 1 }}>
        <Typography>Annotation Mode</Typography>
      </Box>
      <Box sx={{ flex: 2, mt: 0.5, pl: 1 }}>
        <Select
          value={state.editor.annotationMode}
          variant="standard"
          onChange={(event) => handleChange(event.target.value)}
        >
          {state.editor.annotationModes.map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Notification
        message={notify.message}
        onClose={handleCloseNotification}
        open={notify.open}
        actionName={notify.hasUndo ? 'undo' : undefined}
        callback={notify.hasUndo ? handleUndo : undefined}
      />
    </Box>
  );
};

export default AnnotationMode;