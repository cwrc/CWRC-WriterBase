module.exports =  {
    presets: [
        ["@babel/preset-env"]
    ],
    env: {
        test: {
            presets: [
                ["@babel/preset-env", {
                    "targets": {
                        "electron": "7"
                    }
                }]
            ]
        }
    }
}
