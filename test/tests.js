QUnit.module("math", function () {
  QUnit.test("adds", function (assert) {
    assert.equal(1 + 1, 2, "1 + 1 = 2");
  });

  QUnit.test("truthy", function (assert) {
    assert.ok(true, "sample pass");
    // assert.ok(false, "uncomment to see a failure");
  });
});
