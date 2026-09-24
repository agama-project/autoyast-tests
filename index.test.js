import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import process from "node:process";

// Name of the container image.
const CINAME = process.env.CINAME || "agama-autoyast";

// When set, it must point to the root of a full Agama repository checkout (the one containing
// the `service/` directory and `.git`).
const AGAMA_SOURCES = process.env.AGAMA_SOURCES
  ? path.resolve(process.env.AGAMA_SOURCES)
  : undefined;

if (AGAMA_SOURCES) {
  const agamaAutoyastBin = path.join(AGAMA_SOURCES, "service", "bin", "agama-autoyast");
  if (!existsSync(agamaAutoyastBin)) {
    throw new Error(
      `AGAMA_SOURCES is set to "${AGAMA_SOURCES}", but "${agamaAutoyastBin}" was not found. ` +
        "It must point to the root of a full Agama repository checkout.",
    );
  }
}

const AGAMA_AUTOYAST_PATH =
  process.env.AGAMA_AUTOYAST_PATH ||
  (AGAMA_SOURCES ? "/agama-src/service/bin/agama-autoyast" : "/usr/bin/agama-autoyast");

// When running from AGAMA_SOURCES, `agama-autoyast` must be run through `bundle exec`. The script
// itself also calls `require "bundler/setup"`, but running it without `bundle exec` first makes
// Ruby activate whatever default gems it ships with (e.g. "forwardable") before Bundler gets a
// chance to run, which then conflicts with the versions pinned in Gemfile.lock.
const AGAMA_AUTOYAST_CMD = AGAMA_SOURCES
  ? `bundle exec ${AGAMA_AUTOYAST_PATH}`
  : AGAMA_AUTOYAST_PATH;

// Directory used to cache the gems installed by Bundler across test runs.
const BUNDLE_CACHE_DIR = path.resolve("bundle");

// Extra volume mounts and environment needed to run `agama-autoyast` from AGAMA_SOURCES.
const AGAMA_SOURCES_MOUNTS = AGAMA_SOURCES
  ? `-v ${AGAMA_SOURCES}:/agama-src:z -v ${BUNDLE_CACHE_DIR}:/agama-bundle:z`
  : "";
const AGAMA_SOURCES_ENV = AGAMA_SOURCES
  ? "export BUNDLE_GEMFILE=/agama-src/service/Gemfile BUNDLE_PATH=/agama-bundle " +
    "BUNDLE_APP_CONFIG=/agama-bundle/.bundle; "
  : "";

before(() => {
  // Remove any stale container left over from a previous, interrupted run. `-t 0` skips the
  // graceful-stop grace period.
  try {
    execSync(`podman rm -f -t 0 ${CINAME}`, { stdio: "ignore" });
  } catch {
    // There was no leftover container. Nothing to do.
  }

  if (AGAMA_SOURCES) {
    mkdirSync(BUNDLE_CACHE_DIR, { recursive: true });
  }

  execSync(
    `podman create --name ${CINAME} --privileged -v .:/test ${AGAMA_SOURCES_MOUNTS} --entrypoint tail ${CINAME} -f /dev/null`,
  );
  execSync(`podman start ${CINAME}`);

  if (AGAMA_SOURCES) {
    console.info(`Installing dependencies from ${AGAMA_SOURCES} (bundle install)`);

    const cmd =
      "git config --global --add safe.directory /agama-src; " +
      `${AGAMA_SOURCES_ENV}bundle install`;

    execSync(`podman exec ${CINAME} bash -c "${cmd}"`, { stdio: "inherit" });
  }
});

after(() => {
  execSync(`podman rm -f -t 0 ${CINAME}`);
});

// Convert an AutoYaST profile into an Agama configuration.
//
// @param {string} relUrl Name relative to the `fixtures` directory.
// @param {string} testName Test name. It can be inferred in most cases.
const convert = (relUrl, testName) => {
  const name = testName || relUrl.replace(/\.[^/.]+$/, "");
  const resultsDir = `/test/results/${name}`;

  const cmd = `${AGAMA_SOURCES_ENV}${AGAMA_AUTOYAST_CMD} file:///test/fixtures/${relUrl} ${resultsDir}`;
  console.info(`Converting ${relUrl || name}`);

  // Run agama-autoyast in the container.
  execSync(`podman exec ${CINAME} bash -c "${cmd}"`);

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
