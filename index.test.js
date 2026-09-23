import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import process from "node:process";

const CINAME = process.env.CINAME || "agama-autoyast";
const AGAMA_AUTOYAST_PATH = process.env.AGAMA_AUTOYAST_PATH || "/usr/bin/agama-autoyast";

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
    result.unsupported = JSON.parse(readFileSync(unsupportedFile));
  }

  return result;
};

// Returns a JSON object with the result and the unsupported fields for the given profile.
const expectedResult = (name) => {
  const result = {};
  const filename = path.join("fixtures", name);
  const file = path.parse(path.join("fixtures", name));

  const resultsFilename = path.format({
    ...file,
    base: `${file.name}.json`,
  });

  if (existsSync(resultsFilename)) {
    result.profile = JSON.parse(readFileSync(resultsFilename));
  }

  const unsupportedFilename = path.format({
    ...file,
    base: `${file.name}.unsupported.json`,
  });
  if (existsSync(unsupportedFilename)) {
    result.unsupported = JSON.parse(readFileSync(unsupportedFilename));
  }

  return result;
};

test("dynamic profile using rules", () => {
  const { profile } = convert("", "rules");
  const { profile: expectedProfile } = expectedResult("tw.xml");
  assert.deepEqual(profile, expectedProfile);
});

const PROFILES_EXTENSIONS = [".xml", ".erb"];
const profiles = readdirSync("fixtures").filter((f) =>
  PROFILES_EXTENSIONS.includes(path.extname(f)),
);

profiles.forEach((file) => {
  const { profile: expectedProfile, unsupported: expectedUnsupported } = expectedResult(file);
  if (expectedProfile === undefined) return;

  test(`${file}`, () => {
    const { profile, unsupported } = convert(file);
    assert.deepEqual(expectedProfile, profile);
    if (expectedUnsupported !== undefined) {
      assert.deepEqual(unsupported, expectedUnsupported);
    }
  });
});
