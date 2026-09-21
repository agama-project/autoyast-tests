FROM registry.opensuse.org/systemsmanagement/agama/devel/containers/opensuse/agama-testing:latest

RUN zypper in --no-confirm ruby4.0-rubygem-agama-yast
CMD ["bash", "-c"]
