import { Box, ThemeProvider, useMediaQuery } from '@material-ui/core';
import React, { FC, useEffect, useState } from 'react';
import BottomBar from './components/bottombar';
import ContextMenu from './components/contextmenu';
import TopBar from './components/Topbar';
import Writer from './js/Writer';
import { useApp } from './overmind';
import theme from './theme';

declare global {
  interface Window {
    writer: any;
  }
}

interface AppProps {
  config: any;
}

const App: FC<AppProps> = ({ config }) => {
  const { state, actions } = useApp();
  const [writer, setWriter] = useState<any>();

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    actions.editor.writerInitSettings(JSON.stringify(config));
    // console.log(containerRef);
    config.container = 'cwrcWriterContainer';
    const _writer = new Writer(config);

    //@ts-ignore
    _writer.overmindState = state;
    //@ts-ignore
    _writer.overmindActions = actions;
    window.writer = _writer;

    //@ts-ignore
    _writer.event('writerInitialized').subscribe(() => {
      //@ts-ignore
      _writer.showLoadDialog();
    });

    setWriter(window.writer);

    return () => {};
  }, []);

  useEffect(() => {
    //@ts-ignore
    // writer.overmindState = state;
    return () => {};
  }, [state]);

  return (
    <ThemeProvider theme={theme(prefersDarkMode)}>
      {/* <CssBaseline /> */}
      <TopBar />
      <Box
        id="cwrcWriterContainer"
        sx={{
          position: 'absolute',
          height: 'calc(100vh - 48px - 32px)',
          width: '100vw',
          top: '48px',
        }}
      />
      {writer && <ContextMenu writer={writer} />}
      <BottomBar />
    </ThemeProvider>
  );
};

export default App;
