module.exports = {
	presets: ['@babel/preset-env', '@babel/preset-react'],
	plugins: ['@babel/plugin-proposal-class-properties'],
	env: {
		test: {
			presets: [
				[
					'@babel/preset-env',
					{
						targets: {
							electron: '13',
						},
					},
				],
			],
		},
	},
};
