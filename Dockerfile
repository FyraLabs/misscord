FROM rust:latest as build-env
RUN apt update
RUN apt install -y libssl-dev
WORKDIR /app
COPY . /app
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
# copy build artifact somewhere accessible so we can copy it in the next stage
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && cp /app/target/release/misscord /app/misscord

FROM redhat/ubi9:latest
RUN useradd -u 1001 misscord
USER 1001
COPY --from=build-env --chown=misscord /app/misscord /usr/bin/misscord
CMD ["chisel-operator"]
