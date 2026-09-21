import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import process from "node:process";

const CINAME = process.env.CINAME || "agama-autoyast";
const AGAMA_AUTOYAST_PATH =
  process.env.AGAMA_AUTOYAST_PATH || "/usr/bin/agama-autoyast";

// Convert an AutoYaST profile into an Agama configuration.
//
// @param {string} relUrl Name relative to the `fixtures` directory.
// @param {string} testName Test name. It can be inferred in most cases.
const convert = (relUrl, testName) => {
  const name = testName || relUrl.replace(/\.[^/.]+$/, "");
  const resultsDir = `/test/results/${name}`;

  const cmd = `${AGAMA_AUTOYAST_PATH} file:///test/fixtures/${relUrl} ${resultsDir}`;
  console.info(`Converting ${relUrl || name}`);

  // Run agama-autoyast in the container.
  execSync(
    `podman run --rm --name ${CINAME} --privileged -v .:/test --entrypoint /bin/bash ${CINAME} -c "${cmd}"`,
  );

  // Read and return the result.
  const result = {
    profile: JSON.parse(readFileSync(`results/${name}/autoinst.json`)),
  };

  const unsupportedFile = `results/${name}/unsupported.json`;
  if (existsSync(unsupportedFile)) {
    result.unsupported = JSON.parse(unsupportedFile);
  }

  return result;
};

// Returns a JSON object with the result for the given test.
const expectedResult = (name) =>
  JSON.parse(readFileSync(`fixtures/${name}.json`));

test("minimal useful profile", () => {
  const { profile } = convert("minimal.xml");
  assert.deepEqual(profile, expectedResult("minimal"));
});

test("run a pre-scripts that modifies the profile in-place", () => {
  const { profile } = convert("pre-scripts.xml");
  assert.equal(profile.product.id, "Tumbleweed");
  assert.equal(profile.scripts.pre, undefined);
  assert.equal(profile.scripts.post.length, 1);
});

test("dynamic profile using rules", () => {
  const { profile } = convert("", "rules");
  assert.deepEqual(profile, expectedResult("tw"));
});

test("dynamic profile using ERB", () => {
  const { profile } = convert("dynamic.erb");
  assert.equal(profile.product.id, "Tumbleweed");
});
