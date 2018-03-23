const test = require('tape');

test.onFinish(()=>{
    console.log('# coverage:', JSON.stringify(window.__coverage__))
    window.close()
});

test('someting', function(assert) {assert.plan(1); assert.true(true)})