# This is the build stage for Atlas Sphere. Here we create the binary.
FROM docker.io/library/rust:1.85-slim as builder

WORKDIR /atlas-sphere
COPY . /atlas-sphere

# Install required dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    clang \
    && rm -rf /var/lib/apt/lists/*

# Install wasm32 target
RUN rustup target add wasm32-unknown-unknown

# Build the Atlas Sphere node
RUN cargo build --release --features default

# This is the 2nd stage: a very small image where we copy the Atlas Sphere binary.
FROM docker.io/library/ubuntu:20.04
LABEL description="Multistage Docker image for Atlas Sphere: EVM-SVM interoperability blockchain" \
	io.parity.image.type="builder" \
	io.parity.image.authors="atlas-sphere-dev" \
	io.parity.image.vendor="Atlas Sphere" \
	io.parity.image.description="Atlas Sphere is a Substrate-based Layer-1 blockchain enabling native interoperability between Ethereum Virtual Machine (EVM) and Solana Virtual Machine (SVM) execution" \
	io.parity.image.source="https://github.com/atlas-sphere/atlas-sphere" \
	io.parity.image.documentation="https://github.com/atlas-sphere/atlas-sphere/"

COPY --from=builder /atlas-sphere/target/release/atlas-sphere-node /usr/local/bin

RUN useradd -m -u 1000 -U -s /bin/sh -d /atlas-sphere atlas && \
	mkdir -p /data /atlas-sphere/.local/share/atlas-sphere && \
	chown -R atlas:atlas /data && \
	ln -s /data /atlas-sphere/.local/share/atlas-sphere && \
# Sanity checks
	ldd /usr/local/bin/atlas-sphere-node && \
# unclutter and minimize the attack surface
	rm -rf /usr/bin /usr/sbin && \
	/usr/local/bin/atlas-sphere-node --version

USER atlas
EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]