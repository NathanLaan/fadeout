UUID = fadeout@laan.dev
EXTENSION_DIR = $(UUID)
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SYSTEM_INSTALL_DIR = /usr/share/gnome-shell/extensions/$(UUID)
SCHEMA_DIR = $(EXTENSION_DIR)/schemas

.PHONY: all schemas dev install uninstall clean deb

all: schemas

schemas:
	glib-compile-schemas $(SCHEMA_DIR)

dev: schemas
	@mkdir -p $(HOME)/.local/share/gnome-shell/extensions
	@if [ -e "$(INSTALL_DIR)" ] && [ ! -L "$(INSTALL_DIR)" ]; then \
		echo "Error: $(INSTALL_DIR) exists and is not a symlink. Remove it first."; \
		exit 1; \
	fi
	ln -sfn $(CURDIR)/$(EXTENSION_DIR) $(INSTALL_DIR)
	@echo "Symlinked $(EXTENSION_DIR) -> $(INSTALL_DIR)"
	@echo "Restart GNOME Shell (Alt+F2, r, Enter on X11; or log out/in on Wayland)"
	@echo "Then enable: gnome-extensions enable $(UUID)"

install: schemas
	mkdir -p $(INSTALL_DIR)
	cp -r $(EXTENSION_DIR)/* $(INSTALL_DIR)/
	@echo "Installed to $(INSTALL_DIR)"
	@echo "Enable with: gnome-extensions enable $(UUID)"

uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Uninstalled $(UUID)"

clean:
	rm -f $(SCHEMA_DIR)/gschemas.compiled
	rm -f *.deb
	rm -rf _build

deb: schemas
	@command -v dpkg-deb >/dev/null 2>&1 || { echo "dpkg-deb not found"; exit 1; }
	$(eval VERSION := $(shell date +%Y%m%d))
	rm -rf _build
	mkdir -p _build/DEBIAN
	mkdir -p _build$(SYSTEM_INSTALL_DIR)
	cp -r $(EXTENSION_DIR)/* _build$(SYSTEM_INSTALL_DIR)/
	cp debian/control _build/DEBIAN/control
	cp debian/postinst _build/DEBIAN/postinst
	cp debian/postrm _build/DEBIAN/postrm
	chmod 755 _build/DEBIAN/postinst _build/DEBIAN/postrm
	sed -i "s/Version:.*/Version: $(VERSION)/" _build/DEBIAN/control
	dpkg-deb --root-owner-group --build _build gnome-shell-extension-fadeout_$(VERSION)_all.deb
	rm -rf _build
	@echo "Built gnome-shell-extension-fadeout_$(VERSION)_all.deb"
