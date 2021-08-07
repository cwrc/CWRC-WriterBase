import { Box, MenuItem, Select, Typography } from '@material-ui/core';
import { Notify } from '@src/@types/types';
import React, { FC, useEffect, useState } from 'react';
import { useAppState } from '../../overmind';
import Notification from '../Notification';
import useSettings from './useSettings';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const AnnotationMode: FC = () => {
  const { editor } = useAppState();
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
    setPreviousValue(editor.annotationMode);

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
          disabled
          onChange={(event) => handleChange(Number(event.target.value))}
          value={editor.annotationMode}
          variant="standard"
        >
          {editor.annotationModes.map(({ value, label, disabled }) => (
            <MenuItem key={value} disabled={disabled} value={value}>
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
