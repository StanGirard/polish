.PHONY: install uninstall build clean

# Install globally
install:
	bun install
	cd cli && bun run build
	cd cli && npm link

# Uninstall
uninstall:
	cd cli && npm unlink -g polish-cli

# Build only
build:
	cd cli && bun run build

# Clean
clean:
	rm -rf cli/dist cli/node_modules website/node_modules node_modules
