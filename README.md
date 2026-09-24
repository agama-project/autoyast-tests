# AutoYaST examples tests

This directory contains some tooling and a set of AutoYaST profiles to validate Agama support for
AutoYaST. The idea is to run `agama-autoyast` to convert those profiles and check whether the result
is correct.

The tests are defined in the [index.test.js file](./index.test.js) which makes use of
[Node test runner](https://nodejs.org/api/test.html). In a nutshell:

1. Runs `agama-autoyast` to convert a profile.
2. The test can make any assertion on the resulting profile or the list of unsupported elements.

You might want to have a look to the [index.test.js](./index.test.js) file to have a better idea

## Set up

The tests run on a container that includes the dependencies required by `agama-autoyast`. You can
use the [Containerfile](./Containerfile) included in this repositry to build such a container:

```text
$ podman run build
```

Alternatively, if you want to override any parameter when building the container (e.g., the name),
you can use the `podman build` comand:

```text
$ podman build . -t agama-autoyast
```

## Running the tests

Once you have built the container, you have two options to run the tests:

- Use the `rubygem-agama-yast` package included in the testing container.
- Use a local checkout of Agama on top of the container.

> [!NOTE] You can override the name of the container by setting the `CINAME` environment variable.

### Using the package

If you want to run the tests against the `rubygem-agama-yast` package, just type:

```text
$ npm run test
```

For debugging, you can find the result of each test in the `results/` directory.

### Using local sources

To run the tests against a local checkout of Agama, you need to set the `AGAMA_SOURCES` to the root
of the repository (the directory containing the `service/` directory):

```text
$ AGAMA_SOURCES=/path/to/agama npm run test
```

When `AGAMA_SOURCES` is set:

- The whole checkout is bind-mounted into the container.
- Before running any test, `bundle install` is executed to install the dependencies to the `bundle`
  directory, so it acts as a cache for subsequent runs.
- Each test uses `bundle exec` to run `agama-autoyast`.
- As a side effect, running the tests **will modify Gemfile.lock**.

### Running specific tests

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

- We are using a container because we need the `agama-autoyast` to run with privileges.
- A single container is created and started once (before running any test) and each test runs its
  conversion in it via `podman exec`.
- The container is kept alive with a simple `tail -f /dev/null` placeholder process; it does not
  boot the image's init system, so services like D-Bus are not available inside it. This is not a
  problem for these tests.
