import { Box, Link, Paper, Stack } from '@material-ui/core';
import pkg from '@src/../package.json';
import React, { FC } from 'react';
import AnnotationMode from './AnnotationMode';
import EditorMode from './EditorMode';
import Schema from './Schema';

const BottomBar: FC = () => {
  const version = pkg.version;

  return (
    <Box bottom={0} position="fixed" width="100vw">
      <Paper elevation={8} square>
        <Stack direction="row" alignItems="center" spacing={2} px={2}>
          <EditorMode />
          <AnnotationMode />
          <Schema />

          <Box flexGrow={1} />

          <Link
            color="text.secondary"
            variant="caption"
            href={`https://github.com/cwrc/CWRC-WriterBase/releases/tag/v${version}`}
            rel="noopener"
            target="_blank"
            title="GitHub Release Notes"
          >
            {`CWRC-Writer ${version}`}
          </Link>
          <Link
            color="text.secondary"
            variant="caption"
            href="https://www.tiny.cloud"
            target="_blank"
            rel="noopener"
            title="Powered by Tiny"
          >
            Powered by Tiny
          </Link>
        </Stack>
      </Paper>
    </Box>
  );
};

export default BottomBar;
