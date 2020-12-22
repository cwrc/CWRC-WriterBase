import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { render } from 'react-dom';
import App from './App';
import { config } from './overmind';

const overmind = createOvermind(config, {
  devtools: true, // defaults to 'localhost:3031'
  logProxies: true,
});

const init = (config) => {
    render(
        <Provider value={overmind}>
            <App config={config}/>
        </Provider>,
        document.querySelector(`#${config.appContainer}`)
    );
};

if (module.hot) module.hot.accept();

export default {
    init
};