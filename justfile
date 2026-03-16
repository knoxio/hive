# Hive development commands
# Install: cargo install just

# Start all services for development (room daemon + hive-server + hive-web)
dev:
    @echo "Starting Hive dev environment..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Start services without Docker (requires room, cargo, pnpm on PATH)
dev-local:
    #!/usr/bin/env bash
    set -euo pipefail
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

# Clean build artifacts
clean:
    cargo clean
    rm -rf hive-web/node_modules hive-web/dist
