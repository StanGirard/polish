.PHONY: install uninstall build clean

# Install globally
install:
	bun install
	bun run build
	npm link

# Uninstall
uninstall:
	npm unlink -g polish-cli

# Build only
build:
	bun run build

# Clean
clean:
	rm -rf dist node_modules
