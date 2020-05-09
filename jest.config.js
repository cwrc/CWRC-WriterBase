module.exports = {
    browser: true,
    collectCoverage: true,
    collectCoverageFrom: [
      './src/js/**/*',
      '!**/js/tinymce_plugins/**',
      '!**/schema/cwrcEntry/**',
      '!**/schema/orlando/**',
      '!**/schema/teiLite/**'
    ],
    coverageDirectory: './coverage',
    coverageThreshold: {
      global: {
        branches: 35,
        functions: 50,
        lines: 50,
        statements: 50
      }
    },
    moduleNameMapper: {
      '^rdflib$': '<rootDir>/test/mocks/rdflib.js'
    },
    setupFiles: [
      './test/test-env.js'
    ],
    runner: '@jest-runner/electron',
    testEnvironment: '@jest-runner/electron/environment',
    testMatch: [
      '**/test/test.js'
    ],
    transform: {
        '.+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$': 'jest-transform-stub',
        '^.+\\.js$': 'babel-jest'
    },
    verbose: true,
};