import React, { FC } from 'react';
import { Box, Tooltip, Typography } from '@material-ui/core';

interface HeaderProps {
  tagName?: string;
  xpath?: string;
}

const Header: FC<HeaderProps> = ({ tagName = '', xpath = '' }) => {
  return (
    <Tooltip enterDelay={2500} placement="top" title={xpath}>
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
        <Typography variant="caption">{tagName}</Typography>
      </Box>
    </Tooltip>
  );
};

export default Header;
