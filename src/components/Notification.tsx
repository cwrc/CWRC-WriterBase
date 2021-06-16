import { Button, IconButton, Slide, Snackbar } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import React, { FC } from 'react';

interface NotificationProps {
  message: string;
  onClose: () => void;
  open: boolean;
  actionName?: string;
  callback?: () => void;
}

const TransitionRight = (props: any) => {
  return <Slide {...props} direction="right" />;
};

const Notification: FC<NotificationProps> = ({ message, onClose, open, actionName, callback }) => {
  return (
    <Snackbar
      autoHideDuration={60000}
      key={message}
      message={message}
      onClose={onClose}
      open={open}
      TransitionComponent={TransitionRight}
      action={
        <>
          {actionName !== undefined && (
            <Button color="primary" size="small" onClick={callback}>
              {actionName}
            </Button>
          )}
          <IconButton size="small" aria-label="close" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
};

export default Notification;
