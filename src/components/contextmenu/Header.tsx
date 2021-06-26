import { Box, Tooltip, Typography } from '@material-ui/core';
import type { Tag } from 'cwrc-worker-validator';
import React, { FC, useEffect, useState } from 'react';

interface HeaderProps {
  tagName?: string;
  xpath?: string;
  tagMeta?: Tag;
}

const Header: FC<HeaderProps> = ({ tagName = '', xpath = '', tagMeta }) => {
  const [title, setTitle] = useState(tagName);
  const [fullName, setFullName] = useState<string>();

  useEffect(() => {
    if (!tagMeta) return;
    if (!tagMeta.fullName) return;
    setFullName(tagMeta.fullName);
  }, [tagMeta]);

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
        <Typography variant="caption">
          {`<${title}>`}
          {fullName && (
            <Typography component="span" sx={{ textTransform: 'capitalize' }} variant="caption">
              {` ${fullName}`}
            </Typography>
          )}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default Header;
