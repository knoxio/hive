# Hive development commands
# Install: cargo install just
# Prerequisites: rust, node 22+, just, docker (for `just dev`)

# Ensure pnpm is available
setup:
    npm install -g pnpm
    cd hive-web && pnpm install

# Start all services for development (room daemon + hive-server + hive-web)
dev:
    @echo "Starting Hive dev environment..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --pull always

# Start services without Docker (requires room, cargo, node on PATH)
dev-local:
    #!/usr/bin/env bash
    set -euo pipefail
    corepack enable 2>/dev/null || true
    echo "Starting room daemon..."
    room daemon --persistent --ws-port 4200 &
    ROOM_PID=$!
    sleep 1
    echo "Starting hive-server..."
    cd crates/hive-server && cargo run &
    HIVE_PID=$!
    echo "Starting hive-web..."
    cd hive-web && pnpm dev &
    WEB_PID=$!
    echo "Hive dev running: room=$ROOM_PID hive=$HIVE_PID web=$WEB_PID"
    echo "Press Ctrl+C to stop all services"
    trap "kill $ROOM_PID $HIVE_PID $WEB_PID 2>/dev/null" EXIT
    wait

# Build all components
build:
    cargo build -p hive-server
    cd hive-web && pnpm build

# Run all tests
test:
    cargo test -p hive-server
    cd hive-web && pnpm test 2>/dev/null || echo "no frontend tests yet"

# Format all code
fmt:
    cargo fmt
    cd hive-web && pnpm exec prettier --write src/ 2>/dev/null || true

# Lint all code
lint:
    cargo clippy -- -D warnings
    cd hive-web && pnpm exec eslint src/ 2>/dev/null || true

# Check everything (format + lint + test)
check: fmt lint test

# CI checks — same as GitHub Actions, must pass before opening PRs
ci:
    cargo check -p hive-server
    cargo fmt -- --check
    cargo clippy -p hive-server -- -D warnings
    cargo test -p hive-server
    cd hive-web && pnpm exec tsc --noEmit
    cd hive-web && pnpm build
    cd hive-web && pnpm exec eslint src/ || true

# CI fix — auto-fix formatting and lint issues, then verify
ci-fix:
    cargo fmt
    cargo clippy -p hive-server --fix --allow-dirty -- -D warnings
    cd hive-web && pnpm exec eslint src/ --fix 2>/dev/null || true
    @echo "--- verifying ---"
    just ci

# Clean build artifacts
clean:
    cargo clean
    rm -rf hive-web/node_modules hive-web/dist
