# AutoYaST examples tests

This directory contains some tooling and a set of AutoYaST profiles to validate Agama support for
AutoYaST. The idea is to run `agama-autoyast` to convert those profiles and check whether the result
is correct.

The tests are defined in the [index.test.js file](./index.test.js) which makes use of
[Node test runner](https://nodejs.org/api/test.html). In a nutshell:

1. Runs `agama-autoyast` to convert a profile.
2. The test can make any assertion on the resulting profile or the list of unsupported elements.

You might want to have a look to the [index.test.js](./index.test.js) file to have a better idea.

## Set up

The first thing you need to do before running the tests is to create a container which includes
`agama-autoyast` (from the `rubygem-agama-yast` package). This repository includes a
[Containerfile](./Containerfile) that you can use. Using `podman build` (or docker) should be
enough:

```text
$ cargo build . -t agama-autoyast
```

## Running the tests

Once the container is built, you can run the tests typing:

```text
$ npm run test
```

For debugging, you can find the result of each test in the `results/` directory.

> [!NOTE] You can override the name of the container by setting the `CINAME` environment variable.

If you want to only run an specific test, you can use the `--test-name-pattern` switch:

```text
$ npm run test -- --test-name-pattern classes.xml
```

## Defining tests

The test suite automatically searches for profiles under `fixtures/` which has the corresponding
JSON file (e.g., `minimal.xml` and `minimal.json`). In that case, converts the AutoYaST profile and
compares the result. If there is an `.unsupported.json` file, it tests it too.

If a profile does not have a corresponding JSON file, it is not automatically processed. That's
useful when we want to write the test ourselves instead of comparing the JSON output. Check the
`rules` example.

## Tested scenarios

- A minimal profile ([minimal.xml](./fixtures/minimal.xml)).
- A dynamic profile which uses a pre-script to set the product name
  ([pre-scripts.xml](./fixtures/pre-scripts.xml)).
- A dynamic profile using rules ([rules/](./fixtures/rules)).
- A profile which uses classes ([classes.xml](./fixtures/classes.xml)).
- A dynamic profile which sets the name of the product using ERB
  ([dynamic.erb](./fixtures/dynamic.erb)).

## Notes

- We are using a container because we need the `agama-autoyast` to run with privileges. In the
  future, we might support pointing to an `agama-autoyast` executable instead.
- Instead of using `podman run` (or `docker`), we could use `podman start` and `podman exec` so
  Agama's D-Bus service might be available. However, as it is not required, we went for the simpler
  solution.
