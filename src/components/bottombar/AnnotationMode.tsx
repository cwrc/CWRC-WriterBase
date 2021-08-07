import { Box, Button, Menu, MenuItem, Tooltip, Typography } from '@material-ui/core';
import { Notify } from '@src/@types/types';
import { useAppState } from '@src/overmind';
import React, { FC, MouseEvent, useEffect, useState } from 'react';
import Notification from '../Notification';
import useSettings from '../settings/useSettings';

const notifyDefault: Notify = {
  hasUndo: false,
  message: '',
  open: false,
};

const AnnotationMode: FC = () => {
  const { editor } = useAppState();
  const { changeAnnotationMode } = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notify, setNotify] = useState(notifyDefault);
  const [previousValue, setPreviousValue] = useState<number | null>(null);

  const openMenu = Boolean(anchorEl);

  useEffect(() => {
    return () => {
      setNotify(notifyDefault);
      setPreviousValue(null);
    };
  }, []);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (value: number, isUndo?: boolean) => {
    handleMenuClose();
    if (value === editor.annotationMode) return;

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
    <Box>
      {/* <Stack direction="row" spacing={1} alignItems="center"> */}
      {/* <Typography variant="caption" sx={{ cursor: 'default'}}>
        Annotation
      </Typography> */}
      <Tooltip title="Annotation Mode">
        <span>
          <Button
            id="annotation-mode-select"
            aria-controls="annotation-mode-menu"
            aria-expanded={openMenu ? 'true' : undefined}
            aria-haspopup="true"
            // disabled={editor.isReadonly}
            disabled
            onClick={handleButtonClick}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            {editor.annotationModeLabel}
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        id="annotation-mode-menu"
        MenuListProps={{
          sx: {
            py: 0.5,
            borderRadius: 1,
          },
        }}
        onClose={handleMenuClose}
        open={openMenu}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box
          display="flex"
          justifyContent="center"
          mt={-0.5}
          mb={0.5}
          sx={{
            cursor: 'default',
            background: ({ palette }) => palette.action.hover,
          }}
        >
          <Typography sx={{ cursor: 'default' }} variant="caption">
            Annotation
          </Typography>
        </Box>
        {editor.annotationModes.map(({ disabled, label, value }) => (
          <MenuItem
            key={value}
            dense
            disabled={disabled}
            onClick={() => handleChange(value)}
            selected={value === editor.annotationMode}
            sx={{ mx: 0.5, borderRadius: 1 }}
            value={value}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Notification
        message={notify.message}
        onClose={handleCloseNotification}
        open={notify.open}
        actionName={notify.hasUndo ? 'undo' : undefined}
        callback={notify.hasUndo ? handleUndo : undefined}
      />
      {/* </Stack> */}
    </Box>
  );
};

export default AnnotationMode;
